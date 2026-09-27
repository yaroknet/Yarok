const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/md8gs9li8vv3do9p9ynogsp80ksnd8yb'

// Users in the personal tasks board
const BOARD_USERS: Record<string, string> = {
  'd0175b71-1a13-4a93-93b2-d984738cf346': 'אורית עדן',
  '78e34772-303e-469e-9771-a38aa93ddc2c': 'מאיה קורן',
  '5a5d0194-6ce1-448b-a1a7-da4466fcdffc': 'עוזי זלכה',
}

function getIsraelHour(): number {
  const now = new Date()
  return (now.getUTCHours() + 3) % 24
}

function getIsraelMinutes(): number {
  return new Date().getUTCMinutes()
}

function shouldSendReminder(
  frequency: string,
  lastSent: string | null,
): boolean {
  const now = new Date()
  const israelHour = getIsraelHour()
  const israelMinutes = getIsraelMinutes()

  // Don't send between 22:00-07:00
  if (israelHour >= 22 || israelHour < 7) return false

  const lastSentDate = lastSent ? new Date(lastSent) : null

  // "every_X[m|h|d|w]" — interval-based
  if (frequency.startsWith('every_')) {
    const raw = frequency.replace('every_', '')
    let intervalMs = 0
    if (raw.endsWith('m')) {
      intervalMs = parseFloat(raw.replace('m', '')) * 60 * 1000
    } else if (raw.endsWith('w')) {
      intervalMs = parseFloat(raw.replace('w', '')) * 7 * 24 * 60 * 60 * 1000
    } else if (raw.endsWith('d')) {
      intervalMs = parseFloat(raw.replace('d', '')) * 24 * 60 * 60 * 1000
    } else if (raw.endsWith('h')) {
      intervalMs = parseFloat(raw.replace('h', '')) * 60 * 60 * 1000
    } else {
      // Legacy: plain number = hours
      intervalMs = parseFloat(raw) * 60 * 60 * 1000
    }
    if (isNaN(intervalMs) || intervalMs <= 0) return false
    if (!lastSentDate) return true
    return (now.getTime() - lastSentDate.getTime()) >= intervalMs
  }

  // "at_HH:MM" — specific time, once per day
  if (frequency.startsWith('at_')) {
    const time = frequency.replace('at_', '')
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h)) return false
    const targetMinute = m || 0
    // Check if current time is within 30 min window of target
    const nowMin = israelHour * 60 + israelMinutes
    const targetMin = h * 60 + targetMinute
    if (nowMin < targetMin || nowMin > targetMin + 30) return false
    // Check not sent today
    if (!lastSentDate) return true
    const lastSentIsrael = new Date(lastSentDate.getTime() + 3 * 60 * 60 * 1000)
    return lastSentIsrael.toISOString().split('T')[0] !== now.toISOString().split('T')[0]
  }

  // "daily_HH:MM" — once per day at specific time
  if (frequency.startsWith('daily_')) {
    const time = frequency.replace('daily_', '')
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h)) return false
    const targetMinute = m || 0
    const nowMin = israelHour * 60 + israelMinutes
    const targetMin = h * 60 + targetMinute
    if (nowMin < targetMin || nowMin > targetMin + 30) return false
    if (!lastSentDate) return true
    const lastSentIsrael = new Date(lastSentDate.getTime() + 3 * 60 * 60 * 1000)
    return lastSentIsrael.toISOString().split('T')[0] !== now.toISOString().split('T')[0]
  }

  // "weekly_0,1,2,3,4_HH:MM" — specific days of week at specific time
  // Days: 0=Sunday, 1=Monday, ..., 6=Saturday
  if (frequency.startsWith('weekly_')) {
    const parts = frequency.replace('weekly_', '')
    const lastUnderscore = parts.lastIndexOf('_')
    if (lastUnderscore === -1) return false
    const daysStr = parts.substring(0, lastUnderscore)
    const timeStr = parts.substring(lastUnderscore + 1)
    const allowedDays = daysStr.split(',').map(Number)
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h)) return false
    const targetMinute = m || 0

    // Check if today is an allowed day (Israel time)
    const israelTime = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const todayDay = israelTime.getUTCDay()
    if (!allowedDays.includes(todayDay)) return false

    // Check time window
    const nowMin = israelHour * 60 + israelMinutes
    const targetMin = h * 60 + targetMinute
    if (nowMin < targetMin || nowMin > targetMin + 30) return false

    // Check not sent today
    if (!lastSentDate) return true
    const lastSentIsrael = new Date(lastSentDate.getTime() + 3 * 60 * 60 * 1000)
    return lastSentIsrael.toISOString().split('T')[0] !== israelTime.toISOString().split('T')[0]
  }

  // Legacy formats
  if (frequency === 'every_hour') {
    if (!lastSentDate) return true
    return (now.getTime() - lastSentDate.getTime()) >= 60 * 60 * 1000
  }
  if (frequency === 'every_3_hours') {
    if (!lastSentDate) return true
    return (now.getTime() - lastSentDate.getTime()) >= 3 * 60 * 60 * 1000
  }
  if (frequency === 'every_5_hours') {
    if (!lastSentDate) return true
    return (now.getTime() - lastSentDate.getTime()) >= 5 * 60 * 60 * 1000
  }
  if (frequency === 'at_14') {
    if (israelHour !== 14) return false
    if (!lastSentDate) return true
    const lastSentIsrael = new Date(lastSentDate.getTime() + 3 * 60 * 60 * 1000)
    return lastSentIsrael.toISOString().split('T')[0] !== now.toISOString().split('T')[0]
  }
  if (frequency === 'daily') {
    if (israelHour !== 9) return false
    if (!lastSentDate) return true
    const lastSentIsrael = new Date(lastSentDate.getTime() + 3 * 60 * 60 * 1000)
    return lastSentIsrael.toISOString().split('T')[0] !== now.toISOString().split('T')[0]
  }

  return false
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

    // ── PART 1: Handle recurring tasks ──
    // Get today's day of month in Israel time
    const nowUtc = new Date()
    const israelTime = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000)
    const todayDay = israelTime.getUTCDate()
    const todayStr = israelTime.toISOString().split('T')[0]

    // Find recurring tasks that match today's day
    const { data: recurringTasks } = await supabase
      .from('personal_tasks')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_day', todayDay)

    let recurringCreated = 0
    for (const rt of recurringTasks || []) {
      // Check if already created today
      if (rt.last_recurrence_created) {
        const lastCreated = new Date(rt.last_recurrence_created)
        const lastCreatedIsrael = new Date(lastCreated.getTime() + 3 * 60 * 60 * 1000)
        if (lastCreatedIsrael.toISOString().split('T')[0] === todayStr) continue
      }

      // Reset the recurring task: mark as not done for this month
      await supabase
        .from('personal_tasks')
        .update({
          is_done: false,
          done_at: null,
          last_recurrence_created: nowUtc.toISOString(),
          last_reminder_sent: null,
        })
        .eq('id', rt.id)

      recurringCreated++

      // Notify assignee about recurring task
      const assignedName = BOARD_USERS[rt.assigned_to] || 'משתמש'
      const creatorName = BOARD_USERS[rt.created_by] || 'משתמש'
      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', rt.assigned_to)
        .single()

      if (assigneeProfile?.phone && allowOnSaturday(assigneeProfile.phone)) {
        const msg = `🔄 *משימה חוזרת התחדשה!*\n\n📌 *${rt.title}*\n👤 נוצרה ע"י: ${creatorName}\n\nהמשימה חזרה כפתוחה לטיפולך. 🙏`
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: null, service_id: null,
            message_type: 'personal_recurring',
            work_type: 'משימה אישית',
            status: 'pending', branch_name: '', network_name: '',
            employee_name: assignedName,
            employee_phone: assigneeProfile.phone,
            whatsapp_message: msg,
          }),
        })
      }
    }

    console.log(`Recurring tasks reset: ${recurringCreated}`)

    // ── PART 2: Handle reminders for important tasks ──
    // Get all important, undone tasks with a reminder frequency
    const { data: tasks, error } = await supabase
      .from('personal_tasks')
      .select('*')
      .eq('is_important', true)
      .eq('is_done', false)
      .not('reminder_frequency', 'is', null)

    if (error) throw error

    // Get phone numbers for board users
    const userIds = Object.keys(BOARD_USERS)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', userIds)

    const phoneMap: Record<string, string> = {}
    const nameMap: Record<string, string> = {}
    for (const p of profiles || []) {
      phoneMap[p.user_id] = p.phone || ''
      nameMap[p.user_id] = p.full_name || ''
    }

    let remindersSent = 0
    let creatorAlertsSent = 0

    // Group due reminders per assignee + per creator (consolidated single message)
    const dueByAssignee: Record<string, any[]> = {}
    const dueByCreator: Record<string, any[]> = {}

    for (const task of tasks || []) {
      if (!task.reminder_frequency) continue
      if (!shouldSendReminder(task.reminder_frequency, task.last_reminder_sent)) continue
      if (!phoneMap[task.assigned_to]) continue

      if (!dueByAssignee[task.assigned_to]) dueByAssignee[task.assigned_to] = []
      dueByAssignee[task.assigned_to].push(task)

      if (task.created_by !== task.assigned_to && phoneMap[task.created_by]) {
        if (!dueByCreator[task.created_by]) dueByCreator[task.created_by] = []
        dueByCreator[task.created_by].push(task)
      }
    }

    // Send ONE consolidated message per assignee
    for (const [userId, userTasks] of Object.entries(dueByAssignee)) {
      const assignedName = nameMap[userId] || BOARD_USERS[userId] || 'משתמש'
      const assignedPhone = phoneMap[userId]
      const lines = userTasks.map((t: any) => {
        const creator = nameMap[t.created_by] || BOARD_USERS[t.created_by] || 'משתמש'
        const notesPart = t.notes ? `\n     📝 ${t.notes}` : ''
        return `  • *${t.title}* — נוצרה ע"י ${creator}${notesPart}`
      }).join('\n')

      const message = userTasks.length === 1
        ? `⏰ *תזכורת משימה חשובה* ⏰\n\nהיי ${assignedName},\nמשימה שטרם בוצעה:\n\n${lines}\n\nאנא טפל/י בהקדם! 🙏`
        : `⏰ *תזכורת מרוכזת — ${userTasks.length} משימות חשובות* ⏰\n\nהיי ${assignedName},\nמשימות שטרם בוצעו:\n\n${lines}\n\nאנא טפל/י בהקדם! 🙏`

      if (!allowOnSaturday(assignedPhone)) { console.log('Saturday skip', assignedName); continue }
      const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: null,
          service_id: null,
          message_type: 'personal_reminder',
          work_type: 'משימה אישית',
          status: 'pending',
          branch_name: '',
          network_name: '',
          employee_name: assignedName,
          employee_phone: assignedPhone,
          whatsapp_message: message,
        }),
      })

      await supabase.from('whatsapp_log').insert({
        recipient_name: assignedName,
        recipient_phone: assignedPhone,
        message_type: 'personal_reminder',
        message_body: message,
        webhook_status: makeResponse.status,
      })

      remindersSent++

      // Update last_reminder_sent for all tasks in this batch
      const ids = userTasks.map((t: any) => t.id)
      await supabase
        .from('personal_tasks')
        .update({ last_reminder_sent: new Date().toISOString() })
        .in('id', ids)
    }

    // Send ONE consolidated alert per creator
    for (const [creatorId, createdTasks] of Object.entries(dueByCreator)) {
      const creatorName = nameMap[creatorId] || BOARD_USERS[creatorId] || 'משתמש'
      const creatorPhone = phoneMap[creatorId]
      const lines = createdTasks.map((t: any) => {
        const assignee = nameMap[t.assigned_to] || BOARD_USERS[t.assigned_to] || 'משתמש'
        return `  • *${t.title}* — הוקצתה ל${assignee}`
      }).join('\n')

      const creatorMessage = createdTasks.length === 1
        ? `📋 *חיווי מעקב* 📋\n\nהיי ${creatorName},\nמשימה חשובה שהקצית טרם בוצעה:\n\n${lines}\n\nתזכורת נשלחה גם לאחראי/ת.`
        : `📋 *חיווי מעקב מרוכז — ${createdTasks.length} משימות* 📋\n\nהיי ${creatorName},\nמשימות חשובות שהקצית וטרם בוצעו:\n\n${lines}\n\nתזכורות נשלחו גם לאחראים.`

      if (!creatorPhone || !allowOnSaturday(creatorPhone)) { console.log('Saturday skip creator', creatorName); continue }
      const creatorResponse = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: null,
          service_id: null,
          message_type: 'personal_creator_alert',
          work_type: 'משימה אישית',
          status: 'pending',
          branch_name: '',
          network_name: '',
          employee_name: creatorName,
          employee_phone: creatorPhone,
          whatsapp_message: creatorMessage,
        }),
      })

      await supabase.from('whatsapp_log').insert({
        recipient_name: creatorName,
        recipient_phone: creatorPhone,
        message_type: 'personal_creator_alert',
        message_body: creatorMessage,
        webhook_status: creatorResponse.status,
      })

      creatorAlertsSent++
    }

    console.log(`Personal task reminders: ${remindersSent} sent, ${creatorAlertsSent} creator alerts`)

    // ── PART 3: Handle team_tasks reminders ──
    const { data: teamTasks } = await supabase
      .from('team_tasks')
      .select('*')
      .not('status', 'eq', 'done')
      .not('reminder_frequency', 'is', null)

    let teamRemindersSent = 0

    // Group due team tasks per phone number (consolidated single message per recipient)
    const teamDueByPhone: Record<string, any[]> = {}
    for (const tt of teamTasks || []) {
      if (!tt.reminder_frequency) continue
      if (!shouldSendReminder(tt.reminder_frequency, tt.last_reminder_sent)) continue
      if (!tt.employee_phone) continue
      if (!teamDueByPhone[tt.employee_phone]) teamDueByPhone[tt.employee_phone] = []
      teamDueByPhone[tt.employee_phone].push(tt)
    }

    const statusLabel: Record<string, string> = {
      in_progress: 'בטיפול',
      not_done: 'לא בוצע',
      follow_up: 'בהמשך מעקב',
    }

    for (const [phone, items] of Object.entries(teamDueByPhone)) {
      const employeeName = items[0].employee_name

      // Build creator name lookup once
      const creatorIds = [...new Set(items.map((t: any) => t.created_by))]
      const { data: creatorProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', creatorIds)
      const creatorNameMap: Record<string, string> = {}
      for (const p of creatorProfiles || []) creatorNameMap[p.user_id] = p.full_name || ''

      const lines = items.map((tt: any) => {
        const creatorLabel = creatorNameMap[tt.created_by] || BOARD_USERS[tt.created_by] || 'משתמש'
        return `  • *${tt.task_description}*\n     📊 ${statusLabel[tt.status] || tt.status} | 👤 ${creatorLabel}`
      }).join('\n')

      const msg = items.length === 1
        ? `⏰ *תזכורת משימה* ⏰\n\nהיי ${employeeName},\n\n${lines}\n\nאנא טפל/י בהקדם! 🙏`
        : `⏰ *תזכורת מרוכזת — ${items.length} משימות* ⏰\n\nהיי ${employeeName},\n\n${lines}\n\nאנא טפל/י בהקדם! 🙏`

      if (!allowOnSaturday(phone)) { console.log('Saturday skip', employeeName); continue }
      const resp = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: null, service_id: null,
          message_type: 'team_task_reminder',
          work_type: 'משימת עובד',
          status: 'pending',
          branch_name: '', network_name: '',
          employee_name: employeeName,
          employee_phone: phone,
          whatsapp_message: msg,
        }),
      })

      await supabase.from('whatsapp_log').insert({
        recipient_name: employeeName,
        recipient_phone: phone,
        message_type: 'team_task_reminder',
        message_body: msg,
        webhook_status: resp.status,
      })

      const ids = items.map((t: any) => t.id)
      await supabase
        .from('team_tasks')
        .update({ last_reminder_sent: new Date().toISOString() })
        .in('id', ids)

      teamRemindersSent++
    }

    console.log(`Team task reminders: ${teamRemindersSent} sent`)

    return new Response(
      JSON.stringify({
        success: true,
        recurring_reset: recurringCreated,
        reminders_sent: remindersSent,
        creator_alerts_sent: creatorAlertsSent,
        team_reminders_sent: teamRemindersSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('personal-task-reminder error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
