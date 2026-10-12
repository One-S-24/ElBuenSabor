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
    const url = new URL(req.url)
    const tipo = url.searchParams.get('tipo')
    const search = url.searchParams.get('search')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const supabase = createSupabaseClient(req)

    let query = supabase
      .from('catalogo_platillos')
      .select('*', { count: 'exact' })
      .eq('activo', true)
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)

    if (tipo) query = query.eq('tipo', tipo)
    if (search) query = query.ilike('nombre', `%${search}%`)

    const { data: platillos, error, count } = await query
    if (error) throw error

    // Agrupar por tipo para UI
    const porTipo = platillos.reduce((acc: any, p: any) => {
      if (!acc[p.tipo]) acc[p.tipo] = []
      acc[p.tipo].push(p)
      return acc
    }, {})

    return new Response(
      JSON.stringify({
        platillos,
        por_tipo: porTipo,
        tipos_disponibles: ['principal', 'bebida', 'adicional', 'postre', 'sopa', 'ensalada'],
        pagination: { limit, offset, total: count || 0 },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})