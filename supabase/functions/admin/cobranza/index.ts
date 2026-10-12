import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../../../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyAdmin(supabase: any, userId: string) {
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', userId).single()
  return perfil?.rol === 'administrador'
}

// Función helper para generar mensaje WhatsApp
function generarMensajeWhatsApp(cliente: any, cuenta: any): string {
  const fechaInicio = new Date(cuenta.fecha_inicio).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' })
  const fechaFin = new Date(cuenta.fecha_fin).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monto = cuenta.total_deuda.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return `🍽️ *Comedor El Buen Sabor* - Corte Quincenal

Hola *${cliente.nombre}*,

Te informamos tu estado de cuenta del ${fechaInicio} al ${fechaFin}:

💰 *Total a pagar:* C$ ${monto}
📋 *Período:* Quincena del ${fechaInicio} al ${fechaFin}

Por favor realiza tu pago a la brevedad posible. Puedes pagar en efectivo en el comedor o por transferencia.

¡Gracias por tu preferencia!
_Equipo El Buen Sabor_`
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
    const endpoint = url.pathname.split('/').pop()
    const method = req.method

    // GET /admin/cobranza/resumen - Resumen de corte quincenal
    if (endpoint === 'resumen' && method === 'GET') {
      const fecha_inicio = url.searchParams.get('fecha_inicio')
      const fecha_fin = url.searchParams.get('fecha_fin')

      if (!fecha_inicio || !fecha_fin) {
        return new Response(JSON.stringify({ error: 'fecha_inicio y fecha_fin son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('ejecutar_corte_quincenal', {
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
      })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /admin/cobranza/morosos - Lista de morosos para notificar
    if (endpoint === 'morosos' && method === 'GET') {
      const fecha_inicio = url.searchParams.get('fecha_inicio')
      const fecha_fin = url.searchParams.get('fecha_fin')

      if (!fecha_inicio || !fecha_fin) {
        return new Response(JSON.stringify({ error: 'fecha_inicio y fecha_fin son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('obtener_morosos_para_notificar', {
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
      })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      // Agregar mensaje previsualización para cada moroso
      const morososConMensaje = data.morosos.map((m: any) => ({
        ...m,
        mensaje_whatsapp: generarMensajeWhatsApp(m, m),
      }))

      return new Response(JSON.stringify({ ...data, morosos: morososConMensaje }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /admin/cobranza/notificar - Enviar notificación WhatsApp (simulado, integrar con API real)
    if (endpoint === 'notificar' && method === 'POST') {
      const { cuenta_id, cliente_id, telefono_whatsapp, monto, mensaje, force_resend } = await req.json()

      if (!cuenta_id || !cliente_id || !telefono_whatsapp || !monto) {
        return new Response(JSON.stringify({ error: 'cuenta_id, cliente_id, telefono_whatsapp y monto son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Verificar si ya se notificó hoy (evitar spam)
      if (!force_resend) {
        const today = new Date().toISOString().split('T')[0]
        const { data: yaNotificado } = await supabase
          .from('bitacora_notificaciones')
          .select('id')
          .eq('cliente_id', cliente_id)
          .eq('monto_notificado', monto)
          .gte('created_at', `${today}T00:00:00`)
          .eq('enviado_exitosamente', true)
          .limit(1)

        if (yaNotificado && yaNotificado.length > 0) {
          return new Response(JSON.stringify({ success: false, error: 'Ya se notificó hoy este monto. Use force_resend=true para reenviar' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // 🔗 AQUÍ INTEGRAR CON API REAL DE WHATSAPP (Twilio, WhatsApp Business API, etc.)
      // Ejemplo con fetch a webhook:
      /*
      const whatsappResponse = await fetch('https://api.tu-provider.com/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('WHATSAPP_API_KEY')}` },
        body: JSON.stringify({ to: telefono_whatsapp, message: mensaje || generarMensajeWhatsApp({nombre: ''}, {total_deuda: monto}) })
      })
      const resultado = await whatsappResponse.json()
      */

      // Simulación exitosa (reemplazar con integración real)
      const simulacionExitosa = true
      const respuestaApi = simulacionExitosa
        ? { status: 'sent', message_id: `msg_${Date.now()}`, provider: 'simulado' }
        : { status: 'failed', error: 'Error de proveedor' }

      // Registrar en bitácora
      const { data, error } = await supabase.rpc('registrar_notificacion_whatsapp', {
        p_cliente_id: cliente_id,
        p_monto: monto,
        p_enviado: simulacionExitosa,
        p_respuesta_api: JSON.stringify(respuestaApi),
      })
      if (error) throw error

      return new Response(
        JSON.stringify({
          success: simulacionExitosa,
          mensaje: simulacionExitosa ? 'Notificación enviada (simulado)' : 'Error al enviar',
          respuesta_api: respuestaApi,
        }),
        { status: simulacionExitosa ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /admin/cobranza/bitacora - Historial de notificaciones
    if (endpoint === 'bitacora' && method === 'GET') {
      const fecha_inicio = url.searchParams.get('fecha_inicio')
      const fecha_fin = url.searchParams.get('fecha_fin')
      const cliente_id = url.searchParams.get('cliente_id')
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      let query = supabase
        .from('bitacora_notificaciones')
        .select(`
          *,
          perfiles (nombre, telefono_whatsapp)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (fecha_inicio) query = query.gte('created_at', `${fecha_inicio}T00:00:00`)
      if (fecha_fin) query = query.lte('created_at', `${fecha_fin}T23:59:59`)
      if (cliente_id) query = query.eq('cliente_id', cliente_id)

      const { data, error, count } = await query
      if (error) throw error

      return new Response(JSON.stringify({ bitacora: data, pagination: { limit, offset, total: count || 0 } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})