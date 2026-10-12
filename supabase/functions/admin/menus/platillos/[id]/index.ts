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
    const platilloId = pathParts[pathParts.length - 1]
    const method = req.method

    // GET - Obtener platillo
    if (method === 'GET') {
      const { data, error } = await supabase.from('platillos').select('*').eq('id', platilloId).single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PUT - Actualizar platillo (incluye stock)
    if (method === 'PUT') {
      const { nombre, descripcion, precio_unitario, porciones_disponibles, tipo } = await req.json()
      const updates: any = {}
      if (nombre) updates.nombre = nombre
      if (descripcion !== undefined) updates.descripcion = descripcion
      if (precio_unitario !== undefined) updates.precio_unitario = precio_unitario
      if (porciones_disponibles !== undefined) updates.porciones_disponibles = porciones_disponibles
      if (tipo) updates.tipo = tipo

      const { data, error } = await supabase
        .from('platillos')
        .update(updates)
        .eq('id', platilloId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data, message: 'Platillo actualizado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH - Ajustar stock (sumar/restar)
    if (method === 'PATCH') {
      const { ajuste_stock } = await req.json()
      if (ajuste_stock === undefined) {
        return new Response(JSON.stringify({ error: 'ajuste_stock es requerido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: actual } = await supabase.from('platillos').select('porciones_disponibles').eq('id', platilloId).single()
      const nuevoStock = (actual?.porciones_disponibles || 0) + ajuste_stock
      if (nuevoStock < 0) {
        return new Response(JSON.stringify({ error: 'Stock no puede ser negativo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase
        .from('platillos')
        .update({ porciones_disponibles: nuevoStock })
        .eq('id', platilloId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data, message: `Stock ajustado en ${ajuste_stock > 0 ? '+' : ''}${ajuste_stock}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE - Eliminar platillo
    if (method === 'DELETE') {
      const { error } = await supabase.from('platillos').delete().eq('id', platilloId)
      if (error) throw error
      return new Response(JSON.stringify({ message: 'Platillo eliminado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})