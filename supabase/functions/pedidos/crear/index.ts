import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { menu_id, items } = await req.json()
    const supabase = createSupabaseClient(req)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!menu_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'menu_id y items (array) son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    for (const item of items) {
      if (!item.platillo_id || !item.cantidad || item.cantidad <= 0) {
        return new Response(
          JSON.stringify({ error: 'Cada item debe tener platillo_id y cantidad > 0' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { data: resultado, error: rpcError } = await supabase.rpc('crear_pedido_diario', {
      p_cliente_id: user.id,
      p_menu_id: menu_id,
      p_items: items,
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!resultado.success) {
      return new Response(
        JSON.stringify({ error: resultado.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select(`
        *,
        detalle_pedidos (
          *,
          platillos (nombre, precio_unitario)
        )
      `)
      .eq('id', resultado.pedido_id)
      .single()

    if (pedidoError) {
      return new Response(
        JSON.stringify({ error: 'Pedido creado pero error al obtener detalles: ' + pedidoError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        pedido,
        total: resultado.total,
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