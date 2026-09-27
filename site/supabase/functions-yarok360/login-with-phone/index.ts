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

    const { phone, password } = await req.json()

    if (!phone || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'חסרים פרטים' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Normalize phone
    let normalized = phone.replace(/[\s\-\(\)]/g, '')
    if (normalized.startsWith('0')) {
      normalized = '+972' + normalized.slice(1)
    }
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized
    }

    // Find user by phone in auth
    let targetUser: any = null
    let page = 1
    const perPage = 100

    while (!targetUser) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error || !users || users.length === 0) break
      targetUser = users.find((u: any) => u.phone === normalized)
      page++
    }

    // Fallback: look in profiles table
    if (!targetUser) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('phone', phone)
        .limit(1)
        .single()

      if (profile?.user_id) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
        if (user) targetUser = user
      }
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ ok: false, error: 'מספר טלפון לא נמצא במערכת' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // If user has an email, tell the client to sign in with it
    if (targetUser.email) {
      return new Response(JSON.stringify({ ok: true, email: targetUser.email }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // User has no email — generate a deterministic email from user ID and set it
    const generatedEmail = `phone-${targetUser.id}@yarok360.local`
    await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      email: generatedEmail,
      email_confirm: true,
    })

    return new Response(JSON.stringify({ ok: true, email: generatedEmail }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('login-with-phone error:', err)
    return new Response(JSON.stringify({ ok: false, error: err.message || 'שגיאה לא צפויה' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
