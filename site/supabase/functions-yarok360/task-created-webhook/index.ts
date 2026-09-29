const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWhatsApp } from '../../_shared/messaging.ts'

// Users excluded from immediate notifications (they get scheduled summaries)
const EXCLUDED_USER_IDS = new Set([
  '77903c3d-0545-4018-8999-58e66b59f7e0', // צחי
  'aa174194-bda3-4638-96f9-02923683fd1a', // אהרון
  '3249f481-4e2c-4550-badd-e342cc16e1d5', // פיני
])

const ORIT_PHONE = '0503771149'
const ORIT_NAME = 'אורית עדן'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const eventType = payload.type // INSERT, UPDATE, DELETE
    const source = payload.source || 'task' // 'task' or 'service'
    const record = payload.record
    const oldRecord = payload.old_record

    if (!record && !oldRecord) {
      return new Response(JSON.stringify({ error: 'No record in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const isTask = source === 'task'
    const isService = source === 'service'
    let notifyType = ''
    let data = record || oldRecord

    if (eventType === 'INSERT') {
      notifyType = 'new'
    } else if (eventType === 'DELETE') {
      notifyType = 'cancelled'
      data = oldRecord
    } else if (eventType === 'UPDATE') {
      if (isTask) {
        if (record.status === 'cancelled' && oldRecord?.status !== 'cancelled') {
          notifyType = 'cancelled'
        } else if (record.status === 'completed') {
          return new Response(JSON.stringify({ skipped: true, reason: 'completed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          const fieldsToCheck = ['work_type', 'branch_id', 'start_date', 'end_date', 'due_date',
            'assigned_to', 'sides_required', 'frequency', 'admin_notes', 'requires_photo', 'requires_video',
            'total_client_price', 'total_contractor_price']
          const hasChanges = fieldsToCheck.some(f => record[f] !== oldRecord?.[f])
          if (hasChanges) notifyType = 'updated'
        }
      } else if (isService) {
        if (record.status === 'cancelled' && oldRecord?.status !== 'cancelled') {
          notifyType = 'cancelled'
        } else if (record.status === 'completed') {
          return new Response(JSON.stringify({ skipped: true, reason: 'completed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          const fieldsToCheck = ['action_type', 'assigned_to', 'branch_name', 'network_name',
            'days_per_week', 'hours_per_visit', 'specific_date', 'date_option', 'logistics', 'notes', 'status']
          const hasChanges = fieldsToCheck.some(f => JSON.stringify(record[f]) !== JSON.stringify(oldRecord?.[f]))
          if (hasChanges) notifyType = 'updated'
        }
      }
    }

    if (!notifyType) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_meaningful_change' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- Check if assigned user is excluded ---
    const assignedTo = data.assigned_to
    if (assignedTo && EXCLUDED_USER_IDS.has(assignedTo) && notifyType !== 'cancelled') {
      console.log(`Skipping immediate notification for excluded user: ${assignedTo}`)
      // Still check duplicates even for excluded users
      if (isTask && notifyType === 'new') {
        await checkAndNotifyDuplicates(supabase, supabaseUrl, serviceRoleKey, data)
      }
      return new Response(JSON.stringify({ skipped: true, reason: 'excluded_user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- Duplicate detection (point 7) ---
    if (isTask && notifyType === 'new') {
      await checkAndNotifyDuplicates(supabase, supabaseUrl, serviceRoleKey, data)
    }
    if (isService && notifyType === 'new') {
      await checkAndNotifyServiceDuplicates(supabase, supabaseUrl, serviceRoleKey, data)
    }

    // --- Send notification via whatsapp-notify ---
    const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: notifyType,
        task: isTask ? data : undefined,
        service: isService ? data : undefined,
        old_record: oldRecord,
        source,
      }),
    })

    const result = await notifyResponse.json()
    console.log(`task-created-webhook: ${source}/${eventType} -> ${notifyType}, result:`, result)

    return new Response(JSON.stringify({ success: true, notify_type: notifyType, source, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// --- Duplicate detection for tasks (branch_id + work_type) ---
async function checkAndNotifyDuplicates(supabase: any, supabaseUrl: string, serviceRoleKey: string, task: any) {
  try {
    const { data: duplicates } = await supabase
      .from('tasks')
      .select('id, work_type, branch_id, status, branches(name, networks(name))')
      .eq('branch_id', task.branch_id)
      .eq('work_type', task.work_type)
      .not('status', 'in', '(completed,cancelled)')
      .neq('id', task.id)

    if (duplicates && duplicates.length > 0) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name, networks(name)')
        .eq('id', task.branch_id)
        .single()

      const networkName = (branch as any)?.networks?.name || ''
      const branchName = branch?.name || ''
      const msg = `⚠️ *התראת כפילות — משימות* ⚠️\n\nשלום ${ORIT_NAME},\nזוהתה כפילות אפשרית:\n\n📌 *${task.work_type}*\n📍 ${networkName} — ${branchName}\n\nקיימות ${duplicates.length + 1} משימות זהות (סניף + סוג עבודה) במערכת.\nנא לבדוק ולטפל.\n\nתודה! 🙏`

      const sendResult = await sendWhatsApp(ORIT_PHONE, msg)

      await supabase.from('whatsapp_log').insert({
        task_id: task.id,
        recipient_name: ORIT_NAME,
        recipient_phone: ORIT_PHONE,
        message_type: 'duplicate_alert',
        message_body: msg,
        webhook_status: sendResult.status,
      })

      console.log(`Duplicate alert sent for task ${task.id}`)
    }
  } catch (e) {
    console.error('Duplicate check error:', e)
  }
}

// --- Duplicate detection for services (network_name + branch_name + action_type) ---
async function checkAndNotifyServiceDuplicates(supabase: any, supabaseUrl: string, serviceRoleKey: string, service: any) {
  try {
    const { data: duplicates } = await supabase
      .from('services')
      .select('id, network_name, branch_name, action_type, status')
      .eq('network_name', service.network_name)
      .eq('branch_name', service.branch_name)
      .eq('action_type', service.action_type)
      .not('status', 'in', '(completed,cancelled)')
      .neq('id', service.id)

    if (duplicates && duplicates.length > 0) {
      const actionLabel = service.action_type === 'start' ? 'התחלת שירות' : service.action_type === 'update' ? 'עדכון שירות' : 'הפסקת שירות'
      const msg = `⚠️ *התראת כפילות — בקשות שירות* ⚠️\n\nשלום ${ORIT_NAME},\nזוהתה כפילות אפשרית:\n\n🔧 *${actionLabel}*\n📍 ${service.network_name} — ${service.branch_name}\n\nקיימות ${duplicates.length + 1} בקשות זהות במערכת.\nנא לבדוק ולטפל.\n\nתודה! 🙏`

      const sendResult = await sendWhatsApp(ORIT_PHONE, msg)

      await supabase.from('whatsapp_log').insert({
        service_id: service.id,
        recipient_name: ORIT_NAME,
        recipient_phone: ORIT_PHONE,
        message_type: 'duplicate_alert',
        message_body: msg,
        webhook_status: sendResult.status,
      })

      console.log(`Duplicate alert sent for service ${service.id}`)
    }
  } catch (e) {
    console.error('Service duplicate check error:', e)
  }
}
