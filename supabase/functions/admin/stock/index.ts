import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../../../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyAdmin(supabase: any, userId: string) {
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', userId)
    .single()
  return perfil?.rol === 'administrador'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createSupabaseClient(req)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || !(await verifyAdmin(supabase, user.id))) {
      return new Response(
        JSON.stringify({ error: 'Acceso denegado: solo administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: menu, error: menuError } = await supabase
      .from('menus_diarios')
      .select('id')
      .eq('fecha', today)
      .eq('activo', true)
      .single()

    if (menuError) {
      return new Response(
        JSON.stringify({ stock: [], message: 'No hay menú activo hoy' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: platillos, error } = await supabase
      .from('platillos')
      .select('id, nombre, tipo, precio_unitario, porciones_disponibles')
      .eq('menu_id', menu.id)
      .order('tipo', { ascending: true })

    if (error) throw error

    const stock = platillos.map((p: any) => ({
      ...p,
      estado_stock: p.porciones_disponibles === 0 ? 'AGOTADO' : p.porciones_disponibles <= 5 ? 'BAJO' : 'DISPONIBLE',
    }))

    return new Response(
      JSON.stringify({ stock, menu_id: menu.id, fecha: today }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})