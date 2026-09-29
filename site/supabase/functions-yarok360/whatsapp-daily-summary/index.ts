const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWhatsApp } from '../../_shared/messaging.ts'

const ZACHI_PHONE = '0544552202'
const ORIT_PHONE = '0503771149'

function getClosingByTime(): string {
  const now = new Date()
  const israelHour = (now.getUTCHours() + 3) % 24
  return israelHour >= 17 ? 'תודה והמשך ערב נעים !' : 'המשך יום נעים ועבודה נעימה !'
}

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
    const closing = getClosingByTime()

    const buildSummary = async (
      title: string,
      filterRoles: string[] | null,
      excludeNames: string[] = []
    ) => {
      let userIds: string[] = []

      if (filterRoles) {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', filterRoles)
        userIds = (roleRows || []).map((r: any) => r.user_id)
      } else {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id')
        userIds = [...new Set((roleRows || []).map((r: any) => r.user_id))]
      }

      if (userIds.length === 0) {
        return `${title}\n📅 ${todayStr}\n\nאין משתמשים במערכת.\n\n${closing}`
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)

      const profileMap: Record<string, string> = {}
      for (const p of profiles || []) {
        profileMap[p.user_id] = p.full_name || 'ללא שם'
      }

      if (excludeNames.length > 0) {
        const excludeSet = new Set(excludeNames)
        const excludedIds = Object.entries(profileMap)
          .filter(([_, name]) => excludeSet.has(name))
          .map(([id]) => id)
        userIds = userIds.filter(id => !excludedIds.includes(id))
      }

      if (userIds.length === 0) {
        return `${title}\n📅 ${todayStr}\n\nאין משימות או שירותים פתוחים כרגע ✅\n\n${closing}`
      }

      // --- Tasks ---
      const { data: openTasks } = await supabase
        .from('tasks')
        .select('id, work_type, start_date, due_date, assigned_to, branches(name, networks(name))')
        .in('assigned_to', userIds)
        .not('status', 'in', '(completed,cancelled)')
        .order('assigned_to')

      const tasksByUser: Record<string, any[]> = {}
      for (const task of openTasks || []) {
        const name = profileMap[task.assigned_to!] || 'לא משויך'
        if (!tasksByUser[name]) tasksByUser[name] = []
        tasksByUser[name].push(task)
      }

      // --- Services ---
      const { data: activeServices } = await supabase
        .from('services')
        .select('id, network_name, branch_name, action_type, assigned_to, date_option, specific_date, status')
        .in('assigned_to', userIds)
        .not('status', 'in', '(completed,cancelled)')
        .order('assigned_to')

      const servicesByUser: Record<string, any[]> = {}
      for (const svc of activeServices || []) {
        const name = profileMap[svc.assigned_to!] || 'לא משויך'
        if (!servicesByUser[name]) servicesByUser[name] = []
        servicesByUser[name].push(svc)
      }

      const allNames = [...new Set([...Object.keys(tasksByUser), ...Object.keys(servicesByUser)])]

      let message = `${title}\n📅 ${todayStr}\n\n`

      if (allNames.length === 0) {
        message += 'אין משימות או שירותים פתוחים כרגע ✅'
      } else {
        for (const name of allNames) {
          message += `*${name}:*\n`

          for (const t of tasksByUser[name] || []) {
            const networkName = (t as any).branches?.networks?.name || ''
            const branchName = (t as any).branches?.name || ''
            const date = t.due_date || t.start_date
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
      }

      message += `\n${closing}`
      return message
    }

    const zachiMessage = await buildSummary(
      '📊 *סיכום יומי — משימות ושירותים פתוחים למשתמשי מערכת*',
      ['team_leader'],
      ['אהרון']
    )

    const oritMessage = await buildSummary(
      '📊 *סיכום יומי — משימות ושירותים פתוחים לכל המשתמשים*',
      null,
      []
    )

    const sendSummary = async (phone: string, name: string, message: string) => {
      if (!allowOnSaturday(phone)) { console.log('Saturday skip', name); return 0 }
      const response = await sendWhatsApp(phone, message)

      await supabase.from('whatsapp_log').insert({
        recipient_name: name,
        recipient_phone: phone,
        message_type: 'summary',
        message_body: message,
        webhook_status: response.status,
      })

      return response.status
    }

    const zachiStatus = await sendSummary(ZACHI_PHONE, 'צחי', zachiMessage)
    const oritStatus = await sendSummary(ORIT_PHONE, 'אורית', oritMessage)

    console.log(`Daily summary sent. Zachi: ${zachiStatus}, Orit: ${oritStatus}`)

    return new Response(
      JSON.stringify({ success: true, zachi_status: zachiStatus, orit_status: oritStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('whatsapp-daily-summary error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
