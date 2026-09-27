import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/md8gs9li8vv3do9p9ynogsp80ksnd8yb'

Deno.serve(async (_req) => {
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

    // Get all active "start" services that don't have a proof yet
    const { data: startServices } = await supabase
      .from('services')
      .select('id, network_name, branch_name, assigned_to, created_at')
      .eq('action_type', 'start')
      .eq('status', 'active')

    if (!startServices || startServices.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending services' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get existing proofs
    const { data: proofs } = await supabase
      .from('service_start_proofs')
      .select('service_id')
      .in('service_id', startServices.map((s: any) => s.id))

    const proofsSet = new Set((proofs || []).map((p: any) => p.service_id))
    const pending = startServices.filter((s: any) => !proofsSet.has(s.id))

    if (pending.length === 0) {
      return new Response(JSON.stringify({ message: 'All forms completed' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get assignee profiles
    const assigneeIds = [...new Set(pending.map((s: any) => s.assigned_to).filter(Boolean))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', assigneeIds)

    const profileMap: Record<string, any> = {}
    for (const p of profiles || []) {
      profileMap[p.user_id] = p
    }

    // Orit's phone
    const oritPhone = '0503771149'
    const oritName = 'אורית'

    const sentMessages: string[] = []

    // Group pending by assignee
    const byAssignee: Record<string, any[]> = {}
    for (const s of pending) {
      const key = s.assigned_to || 'unassigned'
      if (!byAssignee[key]) byAssignee[key] = []
      byAssignee[key].push(s)
    }

    for (const [userId, services] of Object.entries(byAssignee)) {
      const profile = profileMap[userId]
      if (!profile?.phone) continue

      const lines = services.map((s: any) =>
        `🔧 ${s.network_name} — ${s.branch_name}`
      )

      const assigneeMsg = `שלום ${profile.full_name},\n\nתזכורת: יש לך ${services.length} טופס/י תחילת שירות שטרם מולאו:\n\n${lines.join('\n')}\n\nנא להיכנס למערכת ולמלא את הטפסים.\nתודה והמשך ערב נעים !`

      // Send to assignee
      if (allowOnSaturday(profile.phone)) try {
        const resp = await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: profile.phone, message: assigneeMsg }),
        })
        sentMessages.push(`Sent to ${profile.full_name} (${profile.phone}): ${resp.status}`)

        // Log
        await supabase.from('whatsapp_log').insert({
          message_type: 'service_form_reminder',
          message_body: assigneeMsg,
          recipient_name: profile.full_name,
          recipient_phone: profile.phone,
          webhook_status: resp.status,
        })
      } catch (e) {
        sentMessages.push(`Error sending to ${profile.full_name}: ${e}`)
      }

      // Send to Orit
      const oritMsg = `שלום ${oritName},\n\nתזכורת: ${profile.full_name} טרם מילא/ה ${services.length} טופס/י תחילת שירות:\n\n${lines.join('\n')}\n\nתודה והמשך ערב נעים !`

      if (allowOnSaturday(oritPhone)) try {
        const resp = await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: oritPhone, message: oritMsg }),
        })
        sentMessages.push(`Sent to Orit (${oritPhone}): ${resp.status}`)

        await supabase.from('whatsapp_log').insert({
          message_type: 'service_form_reminder',
          message_body: oritMsg,
          recipient_name: oritName,
          recipient_phone: oritPhone,
          webhook_status: resp.status,
        })
      } catch (e) {
        sentMessages.push(`Error sending to Orit: ${e}`)
      }
    }

    return new Response(JSON.stringify({ sent: sentMessages }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
