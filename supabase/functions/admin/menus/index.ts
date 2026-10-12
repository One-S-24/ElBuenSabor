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

    const url = new URL(req.url)
    const method = req.method

    // GET - Listar menús
    if (method === 'GET') {
      const fecha = url.searchParams.get('fecha')
      let query = supabase.from('menus_diarios').select('*, platillos(*)').order('fecha', { ascending: false })
      if (fecha) query = query.eq('fecha', fecha)
      const { data, error } = await query
      if (error) throw error
      return new Response(JSON.stringify({ menus: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST - Crear menú
    if (method === 'POST') {
      const { fecha, hora_limite_pedido, platillos } = await req.json()
      if (!fecha) {
        return new Response(JSON.stringify({ error: 'fecha es requerida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: menu, error: menuError } = await supabase
        .from('menus_diarios')
        .insert({ fecha, hora_limite_pedido: hora_limite_pedido || '11:00:00', activo: true })
        .select()
        .single()
      if (menuError) throw menuError

      if (platillos && Array.isArray(platillos) && platillos.length > 0) {
        const platillosInsert = platillos.map((p: any) => ({
          menu_id: menu.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio_unitario: p.precio_unitario,
          porciones_disponibles: p.porciones_disponibles || 0,
          tipo: p.tipo || 'principal',
        }))
        const { error: platillosError } = await supabase.from('platillos').insert(platillosInsert)
        if (platillosError) throw platillosError
      }

      return new Response(JSON.stringify({ menu, message: 'Menú creado' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})