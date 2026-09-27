const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/md8gs9li8vv3do9p9ynogsp80ksnd8yb'

const SHAINA_NAME = 'שיינא צור'
const SHAINA_PHONE = '0505621149'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Saturday block: NO WhatsApp on Saturday (Israel). Only service-management messages allowed (handled in whatsapp-notify only). ---
    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000)
    if (nowIL.getUTCDay() === 6) {
      console.log('Saturday block: skipping all scheduled WhatsApp')
      return new Response(JSON.stringify({ skipped: true, reason: 'saturday' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const allowOnSaturday = (_phone: string) => true
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Calculate 14 days ago for bi-weekly window
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const twoWeeksAgoStr = twoWeeksAgo.toISOString()

    // Fetch vitrine-related services created or updated in the last 2 weeks
    // We look for services where work relates to וטרינות/ויטרינות
    const { data: allServices, error: svcError } = await supabase
      .from('services')
      .select('*')
      .or('network_name.ilike.%ויטרינ%,branch_name.ilike.%ויטרינ%,network_name.ilike.%וטרינ%,branch_name.ilike.%וטרינ%,notes.ilike.%ויטרינ%,notes.ilike.%וטרינ%')
      .gte('updated_at', twoWeeksAgoStr)
      .order('updated_at', { ascending: false })

    if (svcError) {
      console.error('Error fetching services:', svcError)
    }

    // Also fetch ALL services and filter by work type containing ויטרינ/וטרינ
    // Since the work type might be in notes or other fields, also get recently changed services
    const { data: recentServices } = await supabase
      .from('services')
      .select('*')
      .gte('updated_at', twoWeeksAgoStr)
      .order('updated_at', { ascending: false })

    // Filter for vitrine-related
    const vitrineKeywords = ['ויטרינ', 'וטרינ', 'vitrin']
    const isVitrineRelated = (svc: any): boolean => {
      const searchFields = [
        svc.network_name || '',
        svc.branch_name || '',
        svc.notes || '',
      ].join(' ').toLowerCase()
      return vitrineKeywords.some(kw => searchFields.includes(kw))
    }

    // Merge and deduplicate
    const allIds = new Set<string>()
    const vitrineServices: any[] = []
    
    for (const svc of [...(allServices || []), ...(recentServices || [])]) {
      if (allIds.has(svc.id)) continue
      if (isVitrineRelated(svc)) {
        allIds.add(svc.id)
        vitrineServices.push(svc)
      }
    }

    // Categorize
    const newServices = vitrineServices.filter(s => s.action_type === 'start')
    const stoppedServices = vitrineServices.filter(s => s.action_type === 'stop')
    const updatedServices = vitrineServices.filter(s => s.action_type === 'update')

    // Build message
    let message = `📊 *סיכום דו-שבועי — וטרינות*\n📅 ${todayStr}\n\n`

    if (vitrineServices.length === 0) {
      message += 'לא היו שינויים בוטרינות בשבועיים האחרונים ✅\n'
    } else {
      if (newServices.length > 0) {
        message += `🟢 *וטרינות חדשות (${newServices.length}):*\n`
        for (const s of newServices) {
          const date = s.specific_date || s.created_at?.split('T')[0] || ''
          const statusLabel = s.status === 'active' ? '⏳ פעיל' : s.status === 'completed' ? '✅ הושלם' : s.status
          message += `  • ${s.network_name} — ${s.branch_name} | ${date} | ${statusLabel}\n`
          if (s.days_per_week && s.hours_per_visit) {
            message += `    ${s.days_per_week} ימים/שבוע × ${s.hours_per_visit} שעות\n`
          }
        }
        message += '\n'
      }

      if (stoppedServices.length > 0) {
        message += `🔴 *וטרינות שהופסקו (${stoppedServices.length}):*\n`
        for (const s of stoppedServices) {
          const date = s.specific_date || s.updated_at?.split('T')[0] || ''
          message += `  • ${s.network_name} — ${s.branch_name} | ${date}\n`
        }
        message += '\n'
      }

      if (updatedServices.length > 0) {
        message += `🔄 *עדכוני תקן בוטרינות (${updatedServices.length}):*\n`
        for (const s of updatedServices) {
          const date = s.specific_date || s.updated_at?.split('T')[0] || ''
          message += `  • ${s.network_name} — ${s.branch_name} | ${date}\n`
          if (s.days_per_week && s.hours_per_visit) {
            message += `    ${s.days_per_week} ימים/שבוע × ${s.hours_per_visit} שעות\n`
          }
        }
        message += '\n'
      }
    }

    message += `\nתודה והמשך יום נעים! 🙏`

    if (!allowOnSaturday(SHAINA_PHONE)) {
      console.log('Saturday skip Shaina')
      return new Response(JSON.stringify({ skipped: true, reason: 'saturday' }), { headers: { 'Content-Type': 'application/json' } })
    }
    // Send to Shaina via Make webhook
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_type: 'summary',
        employee_name: SHAINA_NAME,
        employee_phone: SHAINA_PHONE,
        whatsapp_message: message,
      }),
    })

    // Log
    await supabase.from('whatsapp_log').insert({
      recipient_name: SHAINA_NAME,
      recipient_phone: SHAINA_PHONE,
      message_type: 'summary',
      message_body: message,
      webhook_status: response.status,
    })

    console.log(`Shaina vitrines summary sent: ${response.status}`)

    return new Response(
      JSON.stringify({ success: true, status: response.status, services_found: vitrineServices.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('whatsapp-shaina-vitrines error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
