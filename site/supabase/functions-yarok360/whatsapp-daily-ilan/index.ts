const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/md8gs9li8vv3do9p9ynogsp80ksnd8yb'

const ILAN_PHONE = '0524810420'
const AHARON_PHONE = '0505362497'

const RECIPIENTS: Array<{ name: string; phone: string }> = [
  { name: 'אילן', phone: ILAN_PHONE },
  { name: 'אהרון', phone: AHARON_PHONE },
]

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
    const todayStart = todayStr + 'T00:00:00Z'

    // Get all tasks created today
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('id, work_type, start_date, due_date, specific_dates, assigned_to, created_at, branches(name, networks(name))')
      .gte('created_at', todayStart)
      .not('status', 'in', '(completed,cancelled)')
      .order('assigned_to')

    // Get all services created today
    const { data: todayServices } = await supabase
      .from('services')
      .select('id, network_name, branch_name, action_type, assigned_to, specific_date, created_at')
      .gte('created_at', todayStart)
      .not('status', 'in', '(completed,cancelled)')
      .order('assigned_to')

    const hasTasks = todayTasks && todayTasks.length > 0
    const hasServices = todayServices && todayServices.length > 0

    let message = ''

    if (!hasTasks && !hasServices) {
      message = `ערב טוב אילן, אין משימות להיום.\n\nתודה והמשך ערב נעים !`
    } else {
      // Get all assigned user IDs
      const allUserIds = [...new Set([
        ...(todayTasks || []).map(t => t.assigned_to).filter(Boolean),
        ...(todayServices || []).map(s => s.assigned_to).filter(Boolean),
      ])] as string[]

      const profileMap: Record<string, string> = {}
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', allUserIds)
        for (const p of profiles || []) {
          profileMap[p.user_id] = p.full_name || 'ללא שם'
        }
      }

      // Group tasks by user
      const tasksByUser: Record<string, any[]> = {}
      for (const t of todayTasks || []) {
        const name = t.assigned_to ? (profileMap[t.assigned_to] || 'לא משויך') : 'לא משויך'
        if (!tasksByUser[name]) tasksByUser[name] = []
        tasksByUser[name].push(t)
      }

      // Group services by user
      const servicesByUser: Record<string, any[]> = {}
      for (const s of todayServices || []) {
        const name = s.assigned_to ? (profileMap[s.assigned_to] || 'לא משויך') : 'לא משויך'
        if (!servicesByUser[name]) servicesByUser[name] = []
        servicesByUser[name].push(s)
      }

      const allNames = [...new Set([...Object.keys(tasksByUser), ...Object.keys(servicesByUser)])]

      message = `📊 *סיכום יומי — משימות ושירותים שנפתחו היום*\n📅 ${todayStr}\n\n`

      for (const name of allNames) {
        message += `*${name}:*\n`

        for (const t of tasksByUser[name] || []) {
          const networkName = (t as any).branches?.networks?.name || ''
          const branchName = (t as any).branches?.name || ''
          const date = t.specific_dates?.length ? t.specific_dates.join(', ') : (t.due_date || t.start_date)
          const datePart = date ? ` | ${date}` : ''
          message += `  📋 ${t.work_type} | ${networkName} — ${branchName}${datePart}\n`
        }

        for (const s of servicesByUser[name] || []) {
          const actionLabel = s.action_type === 'start' ? '🟢 התחלה' : s.action_type === 'update' ? '🔄 עדכון' : '🔴 הפסקה'
          const date = s.specific_date || ''
          const datePart = date ? ` | ${date}` : ''
          message += `  🔧 ${actionLabel} | ${s.network_name} — ${s.branch_name}${datePart}\n`
        }

        message += '\n'
      }

      const totalCount = (todayTasks?.length || 0) + (todayServices?.length || 0)
      message += `סה"כ: ${totalCount} פריטים נפתחו היום.\n\nתודה והמשך ערב נעים !`
    }

    // Send to Ilan + Aharon (mirrored)
    const statuses: Record<string, number> = {}
    for (const r of RECIPIENTS) {
      if (!allowOnSaturday(r.phone)) { console.log('Saturday skip', r.name); continue }
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_type: 'summary',
          employee_name: r.name,
          employee_phone: r.phone,
          whatsapp_message: message,
        }),
      })

      await supabase.from('whatsapp_log').insert({
        recipient_name: r.name,
        recipient_phone: r.phone,
        message_type: 'summary',
        message_body: message,
        webhook_status: response.status,
      })

      statuses[r.name] = response.status
      console.log(`Daily evening summary sent to ${r.name}: ${response.status}`)
    }

    return new Response(
      JSON.stringify({ success: true, statuses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('whatsapp-daily-ilan error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
