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

    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'חסרים פרטי משתמש או סיסמה' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find user by email or phone - paginate through all users
    let targetUser: any = null;
    let page = 1;
    const perPage = 100;

    while (!targetUser) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (listError) {
        return new Response(JSON.stringify({ ok: false, error: 'שגיאה בחיפוש משתמשים' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (!users || users.length === 0) break;

      targetUser = users.find((u: any) => u.email === email || u.phone === email)
      page++;
    }

    // Also try looking up by profile name/phone if not found by auth email
    if (!targetUser) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .or(`email.eq.${email},phone.eq.${email},full_name.eq.${email}`)
        .limit(1)
        .single()

      if (profile?.user_id) {
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
        if (!error && user) targetUser = user
      }
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ ok: false, error: `המשתמש "${email}" לא נמצא במערכת` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, { password })
    if (error) {
      const hebrewMsg = translateError(error.message)
      return new Response(JSON.stringify({ ok: false, error: hebrewMsg }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('update-password error:', err)
    return new Response(JSON.stringify({ ok: false, error: 'שגיאה לא צפויה בעדכון הסיסמה' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function translateError(msg: string): string {
  if (!msg) return 'שגיאה לא צפויה'
  const lower = msg.toLowerCase()
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('easy to guess') || lower.includes('known') || lower.includes('pwned')))
    return 'הסיסמה חלשה מדי, יש לבחור סיסמה אחרת'
  if (lower.includes('password') && (lower.includes('short') || lower.includes('at least')))
    return 'הסיסמה קצרה מדי (מינימום 6 תווים)'
  if (lower.includes('not found'))
    return 'המשתמש לא נמצא במערכת'
  if (lower.includes('invalid') && lower.includes('credentials'))
    return 'פרטי התחברות שגויים'
  if (lower.includes('email') && lower.includes('invalid'))
    return 'כתובת אימייל לא תקינה'
  return msg
}
