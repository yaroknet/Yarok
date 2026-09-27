const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/md8gs9li8vv3do9p9ynogsp80ksnd8yb'

const ORIT_USER_ID = 'd0175b71-1a13-4a93-93b2-d984738cf346'
const ORIT_PHONE = '0503771149'
const ORIT_NAME = 'אורית עדן'
const ILAN_PHONE = '0524810420'
const ILAN_NAME = 'אילן'
const TZACHI_PHONE = '0544552202'
const TZACHI_NAME = 'צחי'

function getGreeting(): string {
  const now = new Date()
  const israelHour = (now.getUTCHours() + 3) % 24
  if (israelHour >= 5 && israelHour < 12) return 'בוקר טוב'
  if (israelHour >= 12 && israelHour < 17) return 'צהריים טובים'
  return 'ערב טוב'
}

function getClosing(): string {
  const now = new Date()
  const israelHour = (now.getUTCHours() + 3) % 24
  return israelHour >= 17 ? 'תודה והמשך ערב נעים !' : 'המשך יום נעים ועבודה נעימה !'
}

function daysDiff(d1: Date, d2: Date): number {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))
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

    const now = new Date()
    const israelTime = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const todayStr = israelTime.toISOString().split('T')[0]
    const greeting = getGreeting()
    const closing = getClosing()

    let remindersSent = 0

    // Helper: check if reminder was already sent today for this record+type
    async function wasReminderSentToday(taskId: string | null, serviceId: string | null, msgType: string): Promise<boolean> {
      const query = supabase
        .from('whatsapp_log')
        .select('id')
        .eq('message_type', msgType)
        .gte('sent_at', todayStr + 'T00:00:00Z')
        .limit(1)

      if (taskId) query.eq('task_id', taskId)
      if (serviceId) query.eq('service_id', serviceId)

      const { data } = await query
      return (data && data.length > 0) || false
    }

    // Helper: send WhatsApp message
    async function sendWhatsApp(phone: string, name: string, message: string, taskId: string | null, serviceId: string | null, msgType: string) {
      if (!allowOnSaturday(phone)) { console.log('Saturday skip', name); return false }
      const already = await wasReminderSentToday(taskId, serviceId, msgType)
      if (already) return false

      const resp = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_type: msgType,
          employee_name: name,
          employee_phone: phone,
          whatsapp_message: message,
        }),
      })

      await supabase.from('whatsapp_log').insert({
        task_id: taskId,
        service_id: serviceId,
        recipient_name: name,
        recipient_phone: phone,
        message_type: msgType,
        message_body: message,
        webhook_status: resp.status,
      })

      remindersSent++
      return true
    }

    // Helper: get profile
    async function getProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', userId)
        .single()
      return data
    }

    // Helper: get partner IDs
    async function getPartnerIds(userId: string): Promise<string[]> {
      const { data } = await supabase
        .from('contractor_workers')
        .select('contractor_id, worker_id')
        .or(`contractor_id.eq.${userId},worker_id.eq.${userId}`)

      if (!data) return []
      return data.map(p => p.contractor_id === userId ? p.worker_id : p.contractor_id)
        .filter(id => id !== userId)
    }

    // Helper: send reminder to user + partners
    async function sendToUserAndPartners(userId: string, message: string, taskId: string | null, serviceId: string | null, msgType: string) {
      const profile = await getProfile(userId)
      if (profile?.phone) {
        await sendWhatsApp(profile.phone, profile.full_name || '', message, taskId, serviceId, msgType)
      }

      const partnerIds = await getPartnerIds(userId)
      for (const pid of partnerIds) {
        const partnerProfile = await getProfile(pid)
        if (partnerProfile?.phone) {
          const personalMsg = message.replace(profile?.full_name || '', partnerProfile.full_name || '')
          await sendWhatsApp(partnerProfile.phone, partnerProfile.full_name || '', personalMsg, taskId, serviceId, msgType)
        }
      }
    }

    // ================================================================
    // POINT 3b: Service start ASAP/immediate — every 2 days until proof submitted
    // CONSOLIDATED: one summary message per user
    // ================================================================
    const { data: asapServices } = await supabase
      .from('services')
      .select('*')
      .eq('action_type', 'start')
      .not('status', 'in', '(completed,cancelled)')
      .or('date_option.eq.asap,date_option.eq.immediate,date_option.eq.coordinate')

    // Get existing proofs
    const asapServiceIds = (asapServices || []).map(s => s.id)
    let proofsSet = new Set<string>()
    if (asapServiceIds.length > 0) {
      const { data: proofs } = await supabase
        .from('service_start_proofs')
        .select('service_id')
        .in('service_id', asapServiceIds)
      proofsSet = new Set((proofs || []).map(p => p.service_id))
    }

    // Group by user
    const asapByUser: Record<string, any[]> = {}
    for (const svc of asapServices || []) {
      if (!svc.assigned_to || proofsSet.has(svc.id)) continue
      const createdAt = new Date(svc.created_at)
      const daysSince = daysDiff(now, createdAt)
      if (daysSince > 0 && daysSince % 2 === 0) {
        if (!asapByUser[svc.assigned_to]) asapByUser[svc.assigned_to] = []
        asapByUser[svc.assigned_to].push(svc)
      }
    }

    for (const [userId, svcs] of Object.entries(asapByUser)) {
      const profile = await getProfile(userId)
      const lines = svcs.map(s => `• 📍 *${s.network_name} — ${s.branch_name}*`).join('\n')
      const msg = `⏰ *תזכורת מרוכזת — תחילת שירות (${svcs.length})* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\nבקשות תחילת שירות שטרם עודכנו:\n\n${lines}\n\nנא לעדכן בסטטוס ולאשר שאכן התחלת לספק שירות.\nבמידה ולא התחלת — נא לעדכן בהקדם.\n\n📸 יש להעלות לטופס:\n• צילום משולש אזהרה מוצב\n• צילום ברקוד\n\n${closing}`
      // Use a daily marker so we send once per day max (taskId=null, serviceId=null, custom dedupe via message_type)
      const alreadySent = await wasReminderSentToday(null, null, `service_start_followup_summary_${userId}`)
      if (!alreadySent && profile?.phone) {
        await sendWhatsApp(profile.phone, profile.full_name || '', msg, null, null, `service_start_followup_summary_${userId}`)
        // Also send to partners
        const partnerIds = await getPartnerIds(userId)
        for (const pid of partnerIds) {
          const pp = await getProfile(pid)
          if (pp?.phone) {
            const personalMsg = msg.replace(profile?.full_name || '', pp.full_name || '')
            await sendWhatsApp(pp.phone, pp.full_name || '', personalMsg, null, null, `service_start_followup_summary_${userId}`)
          }
        }
      }
    }

    // ================================================================
    // POINT 3c: Service start specific date — remind 7 days and 1 day before
    // ================================================================
    const { data: specificDateServices } = await supabase
      .from('services')
      .select('*')
      .eq('action_type', 'start')
      .eq('date_option', 'specific')
      .not('specific_date', 'is', null)
      .not('status', 'in', '(completed,cancelled)')

    for (const svc of specificDateServices || []) {
      if (!svc.assigned_to) continue
      const svcDate = new Date(svc.specific_date + 'T00:00:00Z')
      const daysUntil = daysDiff(svcDate, now)

      if (daysUntil === 7 || daysUntil === 1) {
        const profile = await getProfile(svc.assigned_to)
        const daysText = daysUntil === 7 ? 'שבוע' : 'יום אחד'
        const msg = `⏰ *תזכורת — תחילת שירות בעוד ${daysText}* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\nתחילת שירות מתוכננת ל-${svc.specific_date}:\n📍 *${svc.network_name} — ${svc.branch_name}*\n\n📋 *דגשים:*\n• הגעה למקום להתרשמות ותיאום ציפיות\n• התחלה בזמן עם עובד לחפיפה\n• השלמת ברקוד ומשולש אזהרה (צילום והעלאה לטופס)\n\n${closing}`
        await sendToUserAndPartners(svc.assigned_to, msg, null, svc.id, 'service_start_reminder')
      }
    }

    // ================================================================
    // POINT 4: Service update >2 weeks — remind 7 days and 1 day before
    // ================================================================
    const { data: updateServices } = await supabase
      .from('services')
      .select('*')
      .eq('action_type', 'update')
      .eq('date_option', 'specific')
      .not('specific_date', 'is', null)
      .not('status', 'in', '(completed,cancelled)')

    for (const svc of updateServices || []) {
      if (!svc.assigned_to) continue
      const svcDate = new Date(svc.specific_date + 'T00:00:00Z')
      const daysUntil = daysDiff(svcDate, now)
      // Only remind if the date is >2 weeks from creation
      const createdAt = new Date(svc.created_at)
      const totalSpan = daysDiff(svcDate, createdAt)
      if (totalSpan < 14) continue

      if (daysUntil === 7 || daysUntil === 1) {
        const profile = await getProfile(svc.assigned_to)
        const daysText = daysUntil === 7 ? 'שבוע' : 'מחר'
        const msg = `⏰ *תזכורת — עדכון שירות ${daysText}* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\nעדכון שירות מתוכנן ל-${svc.specific_date}:\n📍 *${svc.network_name} — ${svc.branch_name}*\n\n📌 נא להקפיד על התקן החדש.\n\n${closing}`
        await sendToUserAndPartners(svc.assigned_to, msg, null, svc.id, 'service_update_reminder')
      }
    }

    // ================================================================
    // POINT 5: Service stop specific date — remind 7 days and 1 day before
    // ================================================================
    const { data: stopServices } = await supabase
      .from('services')
      .select('*')
      .eq('action_type', 'stop')
      .eq('date_option', 'specific')
      .not('specific_date', 'is', null)
      .not('status', 'in', '(completed,cancelled)')

    for (const svc of stopServices || []) {
      if (!svc.assigned_to) continue
      const svcDate = new Date(svc.specific_date + 'T00:00:00Z')
      const daysUntil = daysDiff(svcDate, now)

      if (daysUntil === 7 || daysUntil === 1) {
        const profile = await getProfile(svc.assigned_to)
        const daysText = daysUntil === 7 ? 'שבוע' : 'מחר'
        const msg = `⏰ *תזכורת — הפסקת שירות ${daysText}* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\nהפסקת שירות מתוכננת ל-${svc.specific_date}:\n📍 *${svc.network_name} — ${svc.branch_name}*\n\n⚠️ *דגשים חשובים:*\n• איסוף כלל החומרים מהאתר\n• איסוף משולש אזהרה\n• איסוף שואב אבק\n• איסוף ציוד נוסף במידה וקיים\n\n${closing}`
        await sendToUserAndPartners(svc.assigned_to, msg, null, svc.id, 'service_stop_reminder')
      }
    }

    // ================================================================
    // POINT 6: Staffing/reinforcement tasks — 7 days before, 1 day before, daily during
    // ================================================================
    const { data: reinforcementTasks } = await supabase
      .from('tasks')
      .select('*, branches(name, networks(name))')
      .or(`work_type.ilike.%תגבור%,work_type.ilike.%כ"א%,work_type.ilike.%כוח אדם%`)
      .not('status', 'in', '(completed,cancelled)')
      .not('start_date', 'is', null)

    for (const task of reinforcementTasks || []) {
      if (!task.assigned_to) continue
      const startDate = new Date(task.start_date + 'T00:00:00Z')
      const daysUntilStart = daysDiff(startDate, now)
      const networkName = (task as any).branches?.networks?.name || ''
      const branchName = (task as any).branches?.name || ''

      // 7 days before
      if (daysUntilStart === 7) {
        const profile = await getProfile(task.assigned_to)
        const msg = `⏰ *תזכורת — משימת תגבור בעוד שבוע* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\n📌 *${task.work_type}*\n📍 ${networkName} — ${branchName}\n📅 תאריך: ${task.start_date}\n\nנא להיערך בהתאם.\n\n${closing}`
        await sendToUserAndPartners(task.assigned_to, msg, task.id, null, 'reinforcement_reminder')
      }

      // 1 day before
      if (daysUntilStart === 1) {
        const profile = await getProfile(task.assigned_to)
        const msg = `⏰ *תזכורת — משימת תגבור מחר!* ⏰\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\n📌 *${task.work_type}*\n📍 ${networkName} — ${branchName}\n📅 מחר: ${task.start_date}\n\nנא לוודא הגעה כמתוכנן.\n\n${closing}`
        await sendToUserAndPartners(task.assigned_to, msg, task.id, null, 'reinforcement_reminder')
      }

      // Multi-day: daily during the period (start_date to end_date/due_date)
      if (task.end_date || task.due_date) {
        const endDate = new Date((task.end_date || task.due_date) + 'T00:00:00Z')
        if (now >= startDate && now <= endDate) {
          // We're in the execution period — send daily
          const profile = await getProfile(task.assigned_to)
          const msg = `📋 *עדכון יומי — משימת תגבור* 📋\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\n📌 *${task.work_type}*\n📍 ${networkName} — ${branchName}\n\nנא לעדכן את אילן/צחי בהקדם במידה ואתה חווה קשיים במתן שירות.\n\n${closing}`
          await sendToUserAndPartners(task.assigned_to, msg, task.id, null, 'reinforcement_daily')
        }
      }
    }

    // ================================================================
    // POINT 9: Daily 14:00 — if Orit didn't enter anything today
    // ================================================================
    const israelHour = (now.getUTCHours() + 3) % 24
    if (israelHour >= 14 && israelHour < 15) {
      // Check if any tasks or services were created today by anyone
      const todayStart = todayStr + 'T00:00:00Z'
      const { data: todayTasks } = await supabase
        .from('tasks')
        .select('id')
        .gte('created_at', todayStart)
        .limit(1)
      const { data: todayServices } = await supabase
        .from('services')
        .select('id')
        .gte('created_at', todayStart)
        .limit(1)

      const nothingToday = (!todayTasks || todayTasks.length === 0) && (!todayServices || todayServices.length === 0)

      if (nothingToday) {
        const msg = `🔔 *תזכורת יומית* 🔔\n\n${greeting} ${ORIT_NAME},\n\nלא הוזנו משימות או בקשות ניהול שירות היום.\nהאם הכל תקין או ששכחת להזין?\n\nתודה! 🙏`
        await sendWhatsApp(ORIT_PHONE, ORIT_NAME, msg, null, null, 'daily_input_reminder')
      }
    }

    // ================================================================
    // CONSOLIDATED TASK REMINDERS (one-time / monthly / quarterly)
    // Group all per-user pending task reminders into a single summary message
    // ================================================================
    const dayOfMonth = israelTime.getUTCDate()
    const month = israelTime.getUTCMonth() + 1
    const quarterLastMonths = [3, 6, 9, 12]

    // Aggregator: userId -> { oneTime: [], monthly: [], quarterly: [] }
    const taskAgg: Record<string, { oneTime: any[], monthly: any[], quarterly: any[] }> = {}

    // 1) One-time without due_date (after 14 days, every 7 days)
    const { data: oneTimeTasks } = await supabase
      .from('tasks')
      .select('*, branches(name, networks(name))')
      .eq('frequency', 'one_time')
      .is('due_date', null)
      .not('status', 'in', '(completed,cancelled)')

    for (const task of oneTimeTasks || []) {
      if (!task.assigned_to) continue
      const createdAt = new Date(task.created_at)
      const daysSinceCreation = daysDiff(now, createdAt)
      if (daysSinceCreation >= 14 && (daysSinceCreation - 14) % 7 === 0) {
        if (!taskAgg[task.assigned_to]) taskAgg[task.assigned_to] = { oneTime: [], monthly: [], quarterly: [] }
        taskAgg[task.assigned_to].oneTime.push(task)
      }
    }

    // 2) Monthly tasks (from 20th, every 3 days)
    if (dayOfMonth >= 20 && (dayOfMonth - 20) % 3 === 0) {
      const { data: monthlyTasks } = await supabase
        .from('tasks')
        .select('*, branches(name, networks(name))')
        .eq('frequency', 'monthly')
        .not('status', 'in', '(completed,cancelled)')

      for (const task of monthlyTasks || []) {
        if (!task.assigned_to) continue
        if (!taskAgg[task.assigned_to]) taskAgg[task.assigned_to] = { oneTime: [], monthly: [], quarterly: [] }
        taskAgg[task.assigned_to].monthly.push(task)
      }
    }

    // 3) Quarterly tasks (last month of quarter, weekly)
    if (quarterLastMonths.includes(month) && (dayOfMonth - 1) % 7 === 0) {
      const { data: quarterlyTasks } = await supabase
        .from('tasks')
        .select('*, branches(name, networks(name))')
        .eq('frequency', 'quarterly')
        .not('status', 'in', '(completed,cancelled)')

      for (const task of quarterlyTasks || []) {
        if (!task.assigned_to) continue
        if (!taskAgg[task.assigned_to]) taskAgg[task.assigned_to] = { oneTime: [], monthly: [], quarterly: [] }
        taskAgg[task.assigned_to].quarterly.push(task)
      }
    }

    // Send ONE consolidated message per user (deduped per day)
    for (const [userId, groups] of Object.entries(taskAgg)) {
      const total = groups.oneTime.length + groups.monthly.length + groups.quarterly.length
      if (total === 0) continue

      const profile = await getProfile(userId)
      const fmt = (t: any) => {
        const networkName = (t as any).branches?.networks?.name || ''
        const branchName = (t as any).branches?.name || ''
        return `  • ${t.work_type} — ${networkName} / ${branchName}`
      }

      let body = `📋 *תזכורת מרוכזת — משימות שטרם בוצעו (${total})* 📋\n\n${greeting} ${profile?.full_name || 'מבצע/ת'},\n\n`

      if (groups.oneTime.length > 0) {
        body += `*משימות חד-פעמיות (${groups.oneTime.length}):*\n${groups.oneTime.map(fmt).join('\n')}\n\n`
      }
      if (groups.monthly.length > 0) {
        body += `*משימות חודשיות — נא לבצע לפני סוף החודש (${groups.monthly.length}):*\n${groups.monthly.map(fmt).join('\n')}\n\n`
      }
      if (groups.quarterly.length > 0) {
        body += `*משימות רבעוניות — נא לבצע לפני סוף הרבעון (${groups.quarterly.length}):*\n${groups.quarterly.map(fmt).join('\n')}\n\n`
      }

      body += `אשמח לטיפולך המהיר, תודה! 🙏\n\n${closing}`

      const dedupeType = `task_summary_${userId}`
      const already = await wasReminderSentToday(null, null, dedupeType)
      if (already) continue

      if (profile?.phone) {
        await sendWhatsApp(profile.phone, profile.full_name || '', body, null, null, dedupeType)
      }
      const partnerIds = await getPartnerIds(userId)
      for (const pid of partnerIds) {
        const pp = await getProfile(pid)
        if (pp?.phone) {
          const personalMsg = body.replace(profile?.full_name || '', pp.full_name || '')
          await sendWhatsApp(pp.phone, pp.full_name || '', personalMsg, null, null, dedupeType)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: remindersSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('whatsapp-scheduler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
