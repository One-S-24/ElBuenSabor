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
      return new Response(JSON.stringify({ error: 'Acceso denegado: solo administradores' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const catalogoId = pathParts[pathParts.length - 1]
    const method = req.method

    // GET - Obtener platillo del catálogo
    if (method === 'GET') {
      const { data, error } = await supabase.from('catalogo_platillos').select('*').eq('id', catalogoId).single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PUT - Actualizar platillo del catálogo
    if (method === 'PUT') {
      const { nombre, descripcion, precio_referencia, tipo, imagen_url, activo } = await req.json()
      const updates: any = {}
      if (nombre) updates.nombre = nombre
      if (descripcion !== undefined) updates.descripcion = descripcion
      if (precio_referencia !== undefined) updates.precio_referencia = precio_referencia
      if (tipo) updates.tipo = tipo
      if (imagen_url !== undefined) updates.imagen_url = imagen_url
      if (activo !== undefined) updates.activo = activo

      const { data, error } = await supabase
        .from('catalogo_platillos')
        .update(updates)
        .eq('id', catalogoId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data, message: 'Catálogo actualizado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE - Eliminar (soft delete: activo = false)
    if (method === 'DELETE') {
      const { data, error } = await supabase
        .from('catalogo_platillos')
        .update({ activo: false })
        .eq('id', catalogoId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data, message: 'Platillo desactivado (soft delete)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})