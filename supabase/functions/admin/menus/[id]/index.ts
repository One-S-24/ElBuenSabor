import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../../../../_shared/supabase.ts'

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
    const pathParts = url.pathname.split('/')
    const menuId = pathParts[pathParts.length - 1]
    const method = req.method

    // GET - Obtener menú con platillos
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('menus_diarios')
        .select('*, platillos(*)')
        .eq('id', menuId)
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ menu: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PUT - Actualizar menú
    if (method === 'PUT') {
      const { fecha, hora_limite_pedido, activo } = await req.json()
      const updates: any = {}
      if (fecha) updates.fecha = fecha
      if (hora_limite_pedido) updates.hora_limite_pedido = hora_limite_pedido
      if (activo !== undefined) updates.activo = activo

      const { data, error } = await supabase
        .from('menus_diarios')
        .update(updates)
        .eq('id', menuId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ menu: data, message: 'Menú actualizado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE - Eliminar menú (cascada elimina platillos)
    if (method === 'DELETE') {
      const { error } = await supabase.from('menus_diarios').delete().eq('id', menuId)
      if (error) throw error
      return new Response(JSON.stringify({ message: 'Menú eliminado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})