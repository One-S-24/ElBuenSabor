import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, nombre, telefono_whatsapp, rol = 'cliente' } = await req.json()

    if (!email || !password || !nombre || !telefono_whatsapp) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: email, password, nombre, telefono_whatsapp' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createServiceRoleClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, telefono_whatsapp, rol },
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: profileError } = await supabase
      .from('perfiles')
      .insert({
        id: authData.user.id,
        nombre,
        telefono_whatsapp,
        rol,
        limite_credito: 2000.00,
      })

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Error creando perfil: ' + profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        user: authData.user,
        message: 'Usuario creado exitosamente',
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})