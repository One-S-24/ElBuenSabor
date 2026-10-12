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
      return new Response(JSON.stringify({ error: 'Acceso denegado: solo administradores' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const method = req.method

    // GET - Listar catálogo (incluye inactivos para admin)
    if (method === 'GET') {
      const tipo = url.searchParams.get('tipo')
      const incluir_inactivos = url.searchParams.get('incluir_inactivos') === 'true'
      const search = url.searchParams.get('search')
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      let query = supabase.from('catalogo_platillos').select('*', { count: 'exact' }).order('tipo').order('nombre').range(offset, offset + limit - 1)
      if (!incluir_inactivos) query = query.eq('activo', true)
      if (tipo) query = query.eq('tipo', tipo)
      if (search) query = query.ilike('nombre', `%${search}%`)

      const { data, error, count } = await query
      if (error) throw error
      return new Response(JSON.stringify({ platillos: data, pagination: { limit, offset, total: count || 0 } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST - Crear platillo en catálogo
    if (method === 'POST') {
      const { nombre, descripcion, precio_referencia, tipo, imagen_url } = await req.json()
      if (!nombre || !precio_referencia || !tipo) {
        return new Response(JSON.stringify({ error: 'nombre, precio_referencia y tipo son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data, error } = await supabase
        .from('catalogo_platillos')
        .insert({ nombre, descripcion, precio_referencia, tipo, imagen_url, activo: true })
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ platillo: data, message: 'Platillo creado en catálogo' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})