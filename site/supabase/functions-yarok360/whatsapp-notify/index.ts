const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWhatsApp } from '../../_shared/messaging.ts'

// Users excluded from immediate notifications
const EXCLUDED_USER_IDS = new Set([
  '77903c3d-0545-4018-8999-58e66b59f7e0', // צחי
  'aa174194-bda3-4638-96f9-02923683fd1a', // אהרון
  '3249f481-4e2c-4550-badd-e342cc16e1d5', // פיני
])

// On Saturday, only these users still receive WhatsApp (other than service-management messages which are always allowed)
const SATURDAY_ALLOWED_USER_IDS = new Set([
  '77903c3d-0545-4018-8999-58e66b59f7e0', // צחי
  'aa174194-bda3-4638-96f9-02923683fd1a', // אהרון
  '3249f481-4e2c-4550-badd-e342cc16e1d5', // פיני
])

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

function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    one_time: 'חד פעמי', monthly: 'חודשי', quarterly: 'רבעוני',
    weekly: 'שבועי', daily: 'יומי', biweekly: 'דו-שבועי',
  }
  return map[freq] || freq || 'חד פעמי'
}

function actionTypeLabel(action: string): string {
  return action === 'start' ? 'התחלת שירות' : action === 'update' ? 'עדכון שירות' : 'הפסקת שירות'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json()
    const { type, task, service, old_record } = payload

    const isTask = !!task
    const isService = !!service

    // --- Saturday flag: filter recipients per-user later (service messages always go through) ---
    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const isSaturdayIL = nowIL.getUTCDay() === 6
    const record = task || service
    if (!record) {
      return new Response(JSON.stringify({ error: 'No record provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- Check stop condition ---
    if (isTask && type !== 'cancelled') {
      const { data: currentTask } = await supabase.from('tasks').select('status').eq('id', record.id).single()
      if (!currentTask || currentTask.status === 'completed' || currentTask.status === 'cancelled') {
        return new Response(JSON.stringify({ skipped: true, reason: 'task_completed_or_cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    if (isService && type !== 'cancelled') {
      const { data: currentService } = await supabase.from('services').select('status').eq('id', record.id).single()
      if (!currentService || currentService.status === 'completed' || currentService.status === 'cancelled') {
        return new Response(JSON.stringify({ skipped: true, reason: 'service_completed_or_cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // --- Get employee info + partners ---
    const assignedTo = record.assigned_to
    let employeeName = ''
    let employeePhone = ''
    const recipients: { name: string; phone: string; userId: string }[] = []

    if (assignedTo) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', assignedTo)
        .single()
      if (profile) {
        employeeName = profile.full_name || ''
        employeePhone = profile.phone || ''
        if (!EXCLUDED_USER_IDS.has(assignedTo)) {
          recipients.push({ name: employeeName, phone: employeePhone, userId: assignedTo })
        }
      }

      // Find partners
      const { data: partnerships } = await supabase
        .from('contractor_workers')
        .select('contractor_id, worker_id')
        .or(`contractor_id.eq.${assignedTo},worker_id.eq.${assignedTo}`)

      if (partnerships && partnerships.length > 0) {
        const partnerIds = partnerships.map(p =>
          p.contractor_id === assignedTo ? p.worker_id : p.contractor_id
        ).filter(id => id !== assignedTo)

        for (const partnerId of partnerIds) {
          if (EXCLUDED_USER_IDS.has(partnerId)) continue
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', partnerId)
            .single()
          if (partnerProfile && partnerProfile.phone) {
            recipients.push({ name: partnerProfile.full_name || '', phone: partnerProfile.phone, userId: partnerId })
          }
        }
      }
    }

    // --- Get branch/network info ---
    let branchName = ''
    let networkName = ''
    let branchAddress = ''
    let branchCity = ''

    if (isTask && record.branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name, address, city, networks(name)')
        .eq('id', record.branch_id)
        .single()
      if (branch) {
        branchName = branch.name || ''
        branchAddress = branch.address || ''
        branchCity = branch.city || ''
        networkName = (branch as any).networks?.name || ''
      }
    } else if (isService) {
      networkName = record.network_name || ''
      branchName = record.branch_name || ''
    }

    const greeting = getGreeting()
    const closing = getClosing()

    // --- Build message ---
    let whatsappMessage = ''

    if (type === 'summary') {
      whatsappMessage = record.message_body || ''
    } else if (isTask) {
      whatsappMessage = buildTaskMessage(type, record, employeeName, networkName, branchName, branchAddress, branchCity, greeting, closing)
    } else if (isService) {
      whatsappMessage = buildServiceMessage(type, record, employeeName, networkName, branchName, greeting, closing)
    }

    // Save message to task
    if (isTask && whatsappMessage && type !== 'summary' && type !== 'reminder') {
      await supabase.from('tasks').update({ whatsapp_message: whatsappMessage }).eq('id', record.id)
    }

    // --- Send to ALL recipients via WhatsApp ---
    const results: { name: string; status: number }[] = []

    // Saturday: block all non-service messages entirely (no allowed users)
    if (isSaturdayIL && !isService) {
      console.log('Saturday block — non-service message')
      return new Response(JSON.stringify({ skipped: true, reason: 'saturday_non_service' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const recipient of recipients) {
      if (!recipient.phone) continue

      // Personalize greeting for each recipient
      let personalMessage = whatsappMessage
      if (recipient.name !== employeeName) {
        personalMessage = whatsappMessage.replace(
          new RegExp(`(${greeting})\\s+${escapeRegex(employeeName)}`),
          `$1 ${recipient.name}`
        )
      }

      const sendResult = await sendWhatsApp(recipient.phone, personalMessage)

      results.push({ name: recipient.name, status: sendResult.status })

      await supabase.from('whatsapp_log').insert({
        task_id: isTask ? record.id : null,
        service_id: isService ? record.id : null,
        recipient_name: recipient.name,
        recipient_phone: recipient.phone,
        message_type: type,
        message_body: personalMessage,
        webhook_status: sendResult.status,
      })
    }

    console.log('WhatsApp sent to recipients:', JSON.stringify(results))

    return new Response(JSON.stringify({ success: true, recipients: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('whatsapp-notify error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ====== TASK MESSAGES ======
function buildTaskMessage(type: string, record: any, employeeName: string, networkName: string, branchName: string, branchAddress: string, branchCity: string, greeting: string, closing: string): string {
  const name = employeeName || 'מבצע/ת'
  const address = [branchAddress, branchCity].filter(Boolean).join(', ')
  const freq = frequencyLabel(record.frequency)

  // Build details block - only include fields that have values
  const details: string[] = []
  details.push(`*סוג עבודה:* ${record.work_type}`)
  details.push(`*רשת:* ${networkName}`)
  details.push(`*סניף:* ${branchName}`)
  if (address) details.push(`*כתובת:* ${address}`)
  if (record.specific_dates && Array.isArray(record.specific_dates) && record.specific_dates.length > 0) {
    details.push(`*ימים שנבחרו:* ${record.specific_dates.join(', ')}`)
  } else {
    if (record.start_date) details.push(`*תאריך התחלה:* ${record.start_date}`)
    if (record.end_date) details.push(`*תאריך סיום:* ${record.end_date}`)
    if (record.due_date) details.push(`*תאריך יעד:* ${record.due_date}`)
  }
  details.push(`*תדירות:* ${freq}`)

  // Show sides only for relevant work types
  const workType = (record.work_type || '').toLowerCase()
  if (workType.includes('ויטרינ') || workType.includes('וטרינ')) {
    details.push(`*צדדים נדרשים:* ${record.sides_required || 1}`)
  }

  const extras: string[] = []
  if (record.admin_notes) extras.push(record.admin_notes)
  if (record.requires_photo) extras.push('📸 נדרש צילום תמונה')
  if (record.requires_video) extras.push('🎥 נדרש צילום וידאו')

  if (type === 'new') {
    let msg = `🆕 *משימה חדשה* 🆕\n\n${greeting} ${name} 👋\nלפניך פרטי משימה חדשה שהוזנה עבורך:\n\n`
    msg += details.join('\n')
    if (extras.length > 0) msg += `\n\n*הנחיות נוספות:*\n${extras.join('\n')}`
    msg += `\n\n${closing}`
    return msg
  }

  if (type === 'updated') {
    let msg = `🔔 *עדכון למשימה קיימת* 🔔\n\n${greeting} ${name} 👋\nלתשומת לבך — חל שינוי בפרטי המשימה הבאה:\n\n`
    msg += details.join('\n')
    if (extras.length > 0) msg += `\n\n*דגשים נוספים:*\n${extras.join('\n')}`
    msg += `\n\n${closing}`
    return msg
  }

  if (type === 'cancelled') {
    let msg = `❌ *ביטול משימה* ❌\n\n${greeting} ${name},\nהמשימה הבאה בוטלה:\n\n`
    msg += `*סוג עבודה:* ${record.work_type}\n*רשת:* ${networkName}\n*סניף:* ${branchName}`
    msg += `\n\nאין צורך להגיע. במידה ויש שאלות, נא ליצור קשר.\n\n${closing}`
    return msg
  }

  if (type === 'reminder') {
    let msg = `⏰ *תזכורת משימה* ⏰\n\n${greeting} ${name},\nזוהי תזכורת לשליחת דו"חות ביצוע:\n\n`
    msg += details.join('\n')
    msg += `\n\nאשמח לטיפולך המהיר, תודה! 🙏\n\n${closing}`
    return msg
  }

  return ''
}

// ====== SERVICE MESSAGES ======
function buildServiceMessage(type: string, record: any, employeeName: string, networkName: string, branchName: string, greeting: string, closing: string): string {
  const name = employeeName || 'מבצע/ת'
  const actionLabel = actionTypeLabel(record.action_type)
  const isStart = record.action_type === 'start'
  const isStop = record.action_type === 'stop'
  const isUpdate = record.action_type === 'update'

  // Build details
  const details: string[] = []
  details.push(`*סוג פעולה:* ${actionLabel}`)
  details.push(`*רשת:* ${networkName}`)
  details.push(`*סניף:* ${branchName}`)
  if (record.days_per_week) details.push(`*ימי שירות בשבוע:* ${record.days_per_week}`)
  if (record.hours_per_visit) details.push(`*שעות בביקור:* ${record.hours_per_visit}`)
  const weeklyTotal = record.weekly_total || (record.days_per_week * record.hours_per_visit)
  if (weeklyTotal) details.push(`*סה"כ שעות שבועיות:* ${weeklyTotal}`)
  if (record.contact_person) details.push(`*איש קשר:* ${record.contact_person}`)
  if (record.contact_phone) details.push(`*טלפון איש קשר:* ${record.contact_phone}`)

  // Date info
  if (record.date_option === 'specific' && record.specific_date) {
    details.push(`*מועד ביצוע:* ${record.specific_date}`)
  } else if (record.date_option === 'immediate') {
    details.push(`*מועד ביצוע:* מיידי`)
  } else if (record.date_option === 'asap') {
    details.push(`*מועד ביצוע:* בהקדם`)
  } else if (record.date_option === 'coordinate') {
    details.push(`*מועד ביצוע:* בתיאום מול איש קשר`)
  }

  if (record.notes) details.push(`*הערות:* ${record.notes}`)

  if (type === 'cancelled') {
    let msg = `❌ *ביטול ${actionLabel}* ❌\n\n${greeting} ${name},\nבקשת ה${actionLabel} הבאה בוטלה:\n\n`
    msg += `*רשת:* ${networkName}\n*סניף:* ${branchName}`
    msg += `\n\nאין צורך בפעולה. במידה ויש שאלות, נא ליצור קשר.\n\n${closing}`
    return msg
  }

  const label = type === 'new' ? 'בקשה חדשה' : 'עדכון בקשה'
  const emoji = type === 'new' ? '🆕' : '🔔'

  let msg = `${emoji} *${label} — ${actionLabel}* ${emoji}\n\n${greeting} ${name} 👋\n\n`
  msg += details.join('\n')

  // --- Point 3a: Service start instructions ---
  if (isStart && (type === 'new' || type === 'updated')) {
    msg += `\n\n📋 *דגשים חשובים לתחילת שירות:*`
    msg += `\n• הגעה למקום להתרשמות ותיאום ציפיות עם הלקוח`
    msg += `\n• התחלת שירות בזמן`
    msg += `\n• הגעה עם עובד לחפיפה במשמרת הראשונה`
    msg += `\n• בדיקה מול הלקוח שהוא מרוצה`
    // Logistics only if defined
    if (record.logistics && record.logistics.length > 0) {
      msg += `\n• השלמת ציוד וחומרים: ${record.logistics.join(', ')}`
    }
    msg += `\n• השלמת ברקוד — צילום והעלאה לטופס`
    msg += `\n• צילום משולש אזהרה מוצב — צילום והעלאה לטופס`
  }

  // --- Point 5: Service stop instructions ---
  if (isStop && (type === 'new' || type === 'updated')) {
    msg += `\n\n⚠️ *דגשים חשובים להפסקת שירות:*`
    msg += `\n• איסוף כלל החומרים מהאתר`
    msg += `\n• איסוף משולש אזהרה`
    msg += `\n• איסוף שואב אבק`
    msg += `\n• איסוף ציוד נוסף במידה וקיים`
  }

  // --- Point 4: Service update reminder note ---
  if (isUpdate && (type === 'new' || type === 'updated')) {
    msg += `\n\n📌 *נא להקפיד על התקן החדש.*`
  }

  msg += `\n\n${closing}`
  return msg
}
