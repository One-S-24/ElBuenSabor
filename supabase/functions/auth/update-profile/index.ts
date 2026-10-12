import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nombre, telefono_whatsapp, limite_credito } = await req.json()
    const supabase = createSupabaseClient(req)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updates: Record<string, unknown> = {}
    if (nombre) updates.nombre = nombre
    if (telefono_whatsapp) updates.telefono_whatsapp = telefono_whatsapp
    if (limite_credito !== undefined) updates.limite_credito = limite_credito

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay campos para actualizar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (perfilError) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando perfil: ' + perfilError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ perfil }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})