import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { email, password, full_name, phone, role } = await req.json()

    if (!password || !role) {
      return new Response(
        JSON.stringify({ error: 'חסרים סיסמה או תפקיד' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: 'יש להזין אימייל או טלפון לפחות' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone number for Israeli format
    let normalizedPhone = phone ? phone.replace(/[\s\-\(\)]/g, '') : null
    if (normalizedPhone && normalizedPhone.startsWith('0')) {
      normalizedPhone = '+972' + normalizedPhone.slice(1)
    }
    if (normalizedPhone && !normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone
    }

    const createUserPayload: any = {
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: full_name || email || phone }
    }

    if (email) createUserPayload.email = email
    if (normalizedPhone) createUserPayload.phone = normalizedPhone

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserPayload)

    if (createError) {
      const hebrewError = translateSupabaseError(createError.message)
      return new Response(
        JSON.stringify({ error: hebrewError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userData.user.id, role })

    if (roleError) {
      return new Response(
        JSON.stringify({ error: 'שגיאה בהגדרת תפקיד למשתמש' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabaseAdmin
      .from('profiles')
      .update({ 
        full_name: full_name || email || phone, 
        phone: phone || null, 
        email: email || null 
      })
      .eq('user_id', userData.user.id)

    return new Response(
      JSON.stringify({ success: true, user_id: userData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: translateSupabaseError(err.message) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function translateSupabaseError(msg: string): string {
  if (!msg) return 'שגיאה לא צפויה'
  const lower = msg.toLowerCase()
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('easy to guess') || lower.includes('known')))
    return 'הסיסמה חלשה מדי, יש לבחור סיסמה אחרת'
  if (lower.includes('already been registered') || lower.includes('already exists') || lower.includes('unique'))
    return 'משתמש עם פרטים אלו כבר קיים במערכת'
  if (lower.includes('invalid email'))
    return 'כתובת אימייל לא תקינה'
  if (lower.includes('invalid phone'))
    return 'מספר טלפון לא תקין'
  if (lower.includes('password') && lower.includes('short'))
    return 'הסיסמה קצרה מדי (מינימום 6 תווים)'
  return msg
}
