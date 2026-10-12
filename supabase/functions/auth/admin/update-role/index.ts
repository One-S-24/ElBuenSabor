import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceRoleClient } from '../../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, rol } = await req.json()
    const supabase = createServiceRoleClient()

    if (!user_id || !rol) {
      return new Response(
        JSON.stringify({ error: 'user_id y rol son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['cliente', 'administrador'].includes(rol)) {
      return new Response(
        JSON.stringify({ error: 'Rol inválido. Debe ser: cliente o administrador' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: { rol },
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .update({ rol })
      .eq('id', user_id)
      .select()
      .single()

    if (perfilError) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando perfil: ' + perfilError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ perfil, message: 'Rol actualizado exitosamente' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})