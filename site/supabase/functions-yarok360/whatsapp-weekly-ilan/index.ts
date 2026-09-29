const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWhatsApp } from '../../_shared/messaging.ts'

const ILAN_USER_ID = 'c9b7036f-5bb2-4ffc-8e54-ff8f41b5ddc5'
const ILAN_PHONE = '0524810420'
const AHARON_USER_ID = 'aa174194-bda3-4638-96f9-02923683fd1a'
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
    const closing = 'תודה והמשך ערב נעים !'

    const buildSummary = async (title: string, userIds: string[]) => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)

      const profileMap: Record<string, string> = {}
      for (const p of profiles || []) {
        profileMap[p.user_id] = p.full_name || 'ללא שם'
      }

      // --- Tasks ---
      const { data: openTasks } = await supabase
        .from('tasks')
        .select('id, work_type, start_date, due_date, specific_dates, assigned_to, branches(name, networks(name))')
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
        .select('id, network_name, branch_name, action_type, assigned_to, date_option, specific_date, days_per_week, hours_per_visit, status')
        .in('assigned_to', userIds)
        .not('status', 'in', '(completed,cancelled)')
        .order('assigned_to')

      const servicesByUser: Record<string, any[]> = {}
      for (const svc of activeServices || []) {
        const name = profileMap[svc.assigned_to!] || 'לא משויך'
        if (!servicesByUser[name]) servicesByUser[name] = []
        servicesByUser[name].push(svc)
      }

      // Also get services without assigned_to (unassigned)
      const { data: unassignedServices } = await supabase
        .from('services')
        .select('id, network_name, branch_name, action_type, date_option, specific_date, days_per_week, hours_per_visit, status')
        .is('assigned_to', null)
        .not('status', 'in', '(completed,cancelled)')

      const allNames = [...new Set([...Object.keys(tasksByUser), ...Object.keys(servicesByUser)])]

      let message = `${title}\n📅 ${todayStr}\n\n`

      if (allNames.length === 0 && (!unassignedServices || unassignedServices.length === 0)) {
        message += 'אין משימות או שירותים פתוחים כרגע ✅'
      } else {
        for (const name of allNames) {
          message += `*${name}:*\n`

          // Tasks
          const userTasks = tasksByUser[name] || []
          for (const t of userTasks) {
            const networkName = (t as any).branches?.networks?.name || ''
            const branchName = (t as any).branches?.name || ''
            const date = t.specific_dates?.length ? t.specific_dates.join(', ') : (t.due_date || t.start_date)
            const datePart = date ? ` | ${date}` : ''
            message += `  📋 ${t.work_type} | ${networkName} — ${branchName}${datePart}\n`
          }

          // Services
          const userServices = servicesByUser[name] || []
          for (const s of userServices) {
            const actionLabel = s.action_type === 'start' ? '🟢 התחלה' : s.action_type === 'update' ? '🔄 עדכון' : '🔴 הפסקה'
            const date = s.specific_date || ''
            const datePart = date ? ` | ${date}` : ''
            message += `  🔧 ${actionLabel} | ${s.network_name} — ${s.branch_name}${datePart}\n`
          }

          message += '\n'
        }

        // Unassigned services
        if (unassignedServices && unassignedServices.length > 0) {
          message += `*לא משויך:*\n`
          for (const s of unassignedServices) {
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

    // --- Message 1: Ilan + Aharon only ---
    const personalMessage = await buildSummary(
      '📊 *סיכום שבועי — משימות ושירותים פתוחים שלך ושל אהרון*',
      [ILAN_USER_ID, AHARON_USER_ID]
    )

    // --- Message 2: All system users ---
    const { data: teamLeaderRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'team_leader')
    const teamLeaderIds = (teamLeaderRoles || []).map((r: any) => r.user_id)

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['office_manager', 'super_admin'])
    const adminIds = (adminRoles || []).map((r: any) => r.user_id)

    const allUserIds = [...new Set([...teamLeaderIds, ...adminIds])]

    const allUsersMessage = await buildSummary(
      '📊 *סיכום שבועי — משימות ושירותים פתוחים לכל משתמשי המערכת*',
      allUserIds
    )

    // --- Send both messages to Ilan + Aharon (mirrored) ---
    const sendSummary = async (message: string, label: string) => {
      const statuses: Record<string, number> = {}
      for (const r of RECIPIENTS) {
        if (!allowOnSaturday(r.phone)) { console.log('Saturday skip', r.name); continue }
        const response = await sendWhatsApp(r.phone, message)

        await supabase.from('whatsapp_log').insert({
          recipient_name: r.name,
          recipient_phone: r.phone,
          message_type: 'summary',
          message_body: message,
          webhook_status: response.status,
        })

        statuses[r.name] = response.status
        console.log(`${label} sent to ${r.name}: ${response.status}`)
      }
      return statuses
    }

    const personalStatuses = await sendSummary(personalMessage, 'Personal summary')
    const allUsersStatuses = await sendSummary(allUsersMessage, 'All users summary')

    return new Response(
      JSON.stringify({ success: true, personal: personalStatuses, all_users: allUsersStatuses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('whatsapp-weekly-ilan error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
