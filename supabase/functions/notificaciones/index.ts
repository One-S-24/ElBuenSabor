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
    const method = req.method

    // GET - Mis notificaciones recibidas
    if (method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const solo_no_leidas = url.searchParams.get('solo_no_leidas') === 'true'

      let query = supabase
        .from('bitacora_notificaciones')
        .select(`
          *,
          whatsapp_plantillas (nombre, tipo)
        `, { count: 'exact' })
        .eq('cliente_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (solo_no_leidas) {
        // Agregar columna leida si se quiere, por ahora filtra por tipo
        query = query.in('tipo_notificacion', ['corte_quincenal', 'recordatorio_pago', 'pedido_confirmado'])
      }

      const { data, error, count } = await query
      if (error) throw error

      return new Response(JSON.stringify({ notificaciones: data, pagination: { limit, offset, total: count || 0 } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})