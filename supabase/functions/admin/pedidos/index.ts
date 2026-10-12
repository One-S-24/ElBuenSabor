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
    const fecha = url.searchParams.get('fecha')
    const estado = url.searchParams.get('estado')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
      .from('pedidos')
      .select(`
        *,
        perfiles (nombre, telefono_whatsapp),
        detalle_pedidos (
          *,
          platillos (nombre, precio_unitario, tipo)
        )
      `, { count: 'exact' })
      .order('fecha_hora', { ascending: false })
      .range(offset, offset + limit - 1)

    if (fecha) {
      const start = `${fecha}T00:00:00`
      const end = `${fecha}T23:59:59`
      query = query.gte('fecha_hora', start).lte('fecha_hora', end)
    }
    if (estado) query = query.eq('estado', estado)

    const { data: pedidos, error, count } = await query
    if (error) throw error

    // Resumen del día
    const { data: resumen } = await supabase
      .from('pedidos')
      .select('estado, total_calculado')
      .gte('fecha_hora', `${new Date().toISOString().split('T')[0]}T00:00:00`)
      .lte('fecha_hora', `${new Date().toISOString().split('T')[0]}T23:59:59`)

    const resumenDia = resumen?.reduce((acc: any, p: any) => {
      acc[p.estado] = (acc[p.estado] || 0) + 1
      acc.total_monto = (acc.total_monto || 0) + Number(p.total_calculado)
      return acc
    }, {}) || {}

    return new Response(
      JSON.stringify({ pedidos, resumen: resumenDia, pagination: { limit, offset, total: count || 0 } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})