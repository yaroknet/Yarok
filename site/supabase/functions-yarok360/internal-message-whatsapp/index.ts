const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWhatsApp } from '../../_shared/messaging.ts'

// Users who receive WhatsApp on Saturday too (their internal messages still go via WhatsApp on Saturday)
const SATURDAY_ALLOWED_USER_IDS = new Set([
  '77903c3d-0545-4018-8999-58e66b59f7e0', // צחי
  'aa174194-bda3-4638-96f9-02923683fd1a', // אהרון
  '3249f481-4e2c-4550-badd-e342cc16e1d5', // פיני
])

function getGreeting(): string {
  const israelHour = (new Date().getUTCHours() + 3) % 24
  if (israelHour >= 5 && israelHour < 12) return 'בוקר טוב'
  if (israelHour >= 12 && israelHour < 17) return 'צהריים טובים'
  return 'ערב טוב'
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
    // Trigger payload from pg net.http_post
    const message = payload.record || payload.message || payload
    if (!message?.recipient_id || !message?.body) {
      return new Response(JSON.stringify({ skipped: true, reason: 'missing_fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Saturday block: no internal-message WhatsApp on Saturday at all
    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000)
    if (nowIL.getUTCDay() === 6) {
      console.log('Saturday block — no internal message WhatsApp')
      return new Response(JSON.stringify({ skipped: true, reason: 'saturday' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get recipient + sender profiles
    const { data: recipient } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', message.recipient_id)
      .single()
    if (!recipient?.phone) {
      console.log('No phone for recipient:', message.recipient_id)
      return new Response(JSON.stringify({ skipped: true, reason: 'no_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let senderName = ''
    if (message.sender_id) {
      const { data: sender } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', message.sender_id)
        .single()
      senderName = sender?.full_name || ''
    }

    const greeting = getGreeting()
    const recipientName = recipient.full_name || 'משתמש/ת'
    const subject = message.subject ? `*נושא:* ${message.subject}\n` : ''
    const fromLine = senderName ? `*מאת:* ${senderName}\n` : ''

    const whatsappMessage =
      `💬 *הודעה חדשה במערכת* 💬\n\n` +
      `${greeting} ${recipientName} 👋\n\n` +
      `${fromLine}${subject}\n` +
      `${message.body}\n\n` +
      `נא להיכנס למערכת לצפייה ומענה.`

    const sendResult = await sendWhatsApp(recipient.phone, whatsappMessage)

    await supabase.from('whatsapp_log').insert({
      recipient_name: recipientName,
      recipient_phone: recipient.phone,
      message_type: 'internal_message',
      message_body: whatsappMessage,
      webhook_status: sendResult.status,
    })

    return new Response(JSON.stringify({ success: true, status: sendResult.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('internal-message-whatsapp error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
