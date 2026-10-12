import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../../../../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyAdmin(supabase: any, userId: string) {
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', userId).single()
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
    const cuentaId = pathParts[pathParts.length - 1]
    const method = req.method

    // GET - Detalle de cuenta con pedidos
    if (method === 'GET') {
      const { data: cuenta, error: cuentaError } = await supabase
        .from('cuentas_quincenales')
        .select(`
          *,
          perfiles (id, nombre, telefono_whatsapp, limite_credito)
        `)
        .eq('id', cuentaId)
        .single()
      if (cuentaError) throw cuentaError

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select(`
          *,
          detalle_pedidos (
            *,
            platillos (nombre, precio_unitario, tipo)
          )
        `)
        .eq('cliente_id', cuenta.perfiles.id)
        .gte('fecha_hora', `${cuenta.fecha_inicio}T00:00:00`)
        .lte('fecha_hora', `${cuenta.fecha_fin}T23:59:59`)
        .eq('estado', 'CONFIRMADO')
        .order('fecha_hora', { ascending: false })

      const { data: pagos } = await supabase
        .from('bitacora_notificaciones')
        .select('*')
        .eq('cliente_id', cuenta.perfiles.id)
        .gte('created_at', `${cuenta.fecha_inicio}T00:00:00`)
        .lte('created_at', `${cuenta.fecha_fin}T23:59:59`)
        .ilike('respuesta_api', '%"tipo":"PAGO_REGISTRADO"%')
        .order('created_at', { ascending: false })

      return new Response(
        JSON.stringify({ cuenta, pedidos: pedidos || [], pagos: pagos || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Registrar pago/abono
    if (method === 'POST') {
      const { monto, metodo, referencia, observaciones } = await req.json()
      if (!monto || monto <= 0) {
        return new Response(JSON.stringify({ error: 'Monto requerido y mayor a 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('registrar_pago_cuenta', {
        p_cuenta_id: cuentaId,
        p_monto: monto,
        p_metodo: metodo || 'EFECTIVO',
        p_referencia: referencia,
        p_observaciones: observaciones,
      })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})