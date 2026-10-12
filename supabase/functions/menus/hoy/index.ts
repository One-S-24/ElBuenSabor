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
    const supabase = createSupabaseClient(req)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: menu, error: menuError } = await supabase
      .from('menus_diarios')
      .select(`
        *,
        platillos (*)
      `)
      .eq('fecha', today)
      .eq('activo', true)
      .single()

    if (menuError) {
      if (menuError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ menu: null, platillos: [], message: 'No hay menú activo para hoy' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: menuError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const platillosDisponibles = menu.platillos.filter((p: any) => p.porciones_disponibles > 0)

    return new Response(
      JSON.stringify({
        menu: {
          id: menu.id,
          fecha: menu.fecha,
          hora_limite_pedido: menu.hora_limite_pedido,
        },
        platillos: platillosDisponibles,
        ahora: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})