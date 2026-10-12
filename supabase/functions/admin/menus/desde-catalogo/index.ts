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

    const method = req.method

    // POST - Agregar platillo del catálogo al menú
    if (method === 'POST') {
      const { menu_id, catalogo_id, porciones_disponibles, precio_override } = await req.json()
      if (!menu_id || !catalogo_id || porciones_disponibles === undefined) {
        return new Response(JSON.stringify({ error: 'menu_id, catalogo_id y porciones_disponibles son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('agregar_platillo_desde_catalogo', {
        p_menu_id: menu_id,
        p_catalogo_id: catalogo_id,
        p_porciones_disponibles: porciones_disponibles,
        p_precio_override: precio_override,
      })
      if (error) throw error
      if (!data.success) {
        return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ...data, message: 'Platillo agregado al menú desde catálogo' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST - Crear menú desde plantilla (copiar de otro menú)
    if (method === 'PUT') {
      const { fecha, menu_plantilla_id, hora_limite_pedido } = await req.json()
      if (!fecha || !menu_plantilla_id) {
        return new Response(JSON.stringify({ error: 'fecha y menu_plantilla_id son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('crear_menu_desde_plantilla', {
        p_fecha: fecha,
        p_menu_plantilla_id: menu_plantilla_id,
        p_hora_limite_pedido: hora_limite_pedido || '11:00:00',
      })
      if (error) throw error
      if (!data.success) {
        return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ...data, message: 'Menú creado desde plantilla' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})