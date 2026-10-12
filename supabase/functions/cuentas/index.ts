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
    const supabase = createSupabaseClient(req)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const endpoint = url.pathname.split('/').pop()

    // GET /cuentas/actual - Cuenta quincenal actual con detalle
    if (endpoint === 'actual') {
      const { data, error } = await supabase.rpc('obtener_cuenta_actual', { p_cliente_id: user.id })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /cuentas/historial - Historial de cuentas quincenales
    if (endpoint === 'historial') {
      const limit = parseInt(url.searchParams.get('limit') || '12')
      const { data, error } = await supabase.rpc('historial_cuentas_cliente', { p_cliente_id: user.id, p_limit: limit })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})