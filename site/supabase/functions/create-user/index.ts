import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserRequest {
  action?: 'create' | 'update' | 'delete' | 'reset_password'
  user_id?: string
  email?: string
  password?: string
  full_name?: string
  role?: 'super_admin' | 'manager' | 'driver'
  phone?: string
  driver_license_number?: string
  driver_license_expiry?: string
  is_bootstrap?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body: UserRequest = await req.json()
    const action = body.action || 'create'
    console.log('User action:', action, body.email || body.user_id)

    // Check if this is a bootstrap request (creating first admin)
    if (body.is_bootstrap && action === 'create') {
      // Check if any super_admin exists
      const { data: existingAdmins, error: checkError } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1)

      if (checkError) {
        console.error('Error checking existing admins:', checkError)
        throw new Error('Failed to check existing admins')
      }

      if (existingAdmins && existingAdmins.length > 0) {
        console.log('Admin already exists, skipping bootstrap')
        return new Response(
          JSON.stringify({ error: 'Admin already exists', success: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    } else {
      // For non-bootstrap requests, verify the caller is a super_admin or manager
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
      
      if (authError || !callerUser) {
        console.error('Auth error:', authError)
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Check if caller is super_admin or manager
      const { data: callerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUser.id)

      const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin')
      const isManager = callerRoles?.some(r => r.role === 'manager')

      if (!isSuperAdmin && !isManager) {
        return new Response(
          JSON.stringify({ error: 'Only admins can manage users' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }

      // Managers can only create/modify drivers
      if (isManager && !isSuperAdmin) {
        if (action === 'create' && body.role !== 'driver') {
          return new Response(
            JSON.stringify({ error: 'Managers can only create drivers' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }
        if ((action === 'update' || action === 'delete' || action === 'reset_password') && body.user_id) {
          // Check if target user is a driver
          const { data: targetRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', body.user_id)
          
          const targetIsDriver = targetRoles?.every(r => r.role === 'driver')
          if (!targetIsDriver) {
            return new Response(
              JSON.stringify({ error: 'Managers can only modify drivers' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
          }
        }
      }
    }

    // Handle DELETE action
    if (action === 'delete') {
      if (!body.user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required for delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.user_id)
      if (deleteError) {
        console.error('Error deleting user:', deleteError)
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('Successfully deleted user:', body.user_id)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle RESET PASSWORD action
    if (action === 'reset_password') {
      if (!body.user_id || !body.password) {
        return new Response(
          JSON.stringify({ error: 'user_id and password are required for reset_password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        body.user_id,
        { password: body.password }
      )

      if (resetError) {
        console.error('Error resetting password:', resetError)
        return new Response(
          JSON.stringify({ error: resetError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('Successfully reset password for user:', body.user_id)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle UPDATE action
    if (action === 'update') {
      if (!body.user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required for update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Update auth user email if provided
      if (body.email) {
        // Check if the new phone number already exists for a different user
        const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
        if (!checkError) {
          const emailExistsForOtherUser = existingUsers.users.some(u => u.email === body.email && u.id !== body.user_id)
          if (emailExistsForOtherUser) {
            const phone = body.email.replace('@phone.local', '')
            return new Response(
              JSON.stringify({ error: `מספר הטלפון ${phone} כבר קיים במערכת` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          body.user_id,
          { 
            email: body.email,
            email_confirm: true,
            user_metadata: body.full_name ? { full_name: body.full_name } : undefined
          }
        )

        if (authUpdateError) {
          console.error('Error updating auth user:', authUpdateError)
          return new Response(
            JSON.stringify({ error: authUpdateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
      }

      // Update profile
      const profileUpdates: Record<string, unknown> = {}
      if (body.full_name !== undefined) profileUpdates.full_name = body.full_name
      if (body.email !== undefined) profileUpdates.email = body.email
      if (body.phone !== undefined) profileUpdates.phone = body.phone
      if (body.driver_license_number !== undefined) profileUpdates.driver_license_number = body.driver_license_number
      if (body.driver_license_expiry !== undefined) profileUpdates.driver_license_expiry = body.driver_license_expiry

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('user_id', body.user_id)

        if (profileError) {
          console.error('Error updating profile:', profileError)
        }
      }

      // Update role if provided
      if (body.role) {
        // Delete existing roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', body.user_id)

        // Insert new role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: body.user_id,
            role: body.role
          })

        if (roleError) {
          console.error('Error updating role:', roleError)
        }
      }

      console.log('Successfully updated user:', body.user_id)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle CREATE action (default)
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return new Response(
        JSON.stringify({ error: 'email, password, full_name, and role are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if phone number (email) already exists
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
    if (checkError) {
      console.error('Error checking existing users:', checkError)
    } else {
      const emailExists = existingUsers.users.some(u => u.email === body.email)
      if (emailExists) {
        // Extract phone from email format (0501234567@phone.local -> 0501234567)
        const phone = body.email.replace('@phone.local', '')
        return new Response(
          JSON.stringify({ error: `מספר הטלפון ${phone} כבר קיים במערכת` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Create the user in auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name
      }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const userId = authData.user.id
    console.log('Created auth user with ID:', userId)

    // Update profile with additional info if provided
    if (body.phone || body.driver_license_number || body.driver_license_expiry) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          phone: body.phone,
          driver_license_number: body.driver_license_number,
          driver_license_expiry: body.driver_license_expiry
        })
        .eq('user_id', userId)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }
    }

    // Add user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: body.role
      })

    if (roleError) {
      console.error('Error adding role:', roleError)
      // Try to cleanup by deleting the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Failed to assign role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('Successfully created user:', body.email, 'with role:', body.role)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: userId, 
          email: body.email, 
          full_name: body.full_name,
          role: body.role 
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})