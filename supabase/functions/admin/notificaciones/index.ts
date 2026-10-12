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
    const endpoint = pathParts[pathParts.length - 1]
    const method = req.method

    // ============ CONFIG WHATSAPP ============
    if (endpoint === 'config' || endpoint === 'whatsapp-config') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('whatsapp_config').select('*').order('created_at')
        if (error) throw error
        // No exponer api_key completa
        const safeData = data.map((c: any) => ({ ...c, api_key: c.api_key.substring(0, 4) + '****' }))
        return new Response(JSON.stringify({ configs: safeData }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (method === 'POST') {
        const { proveedor, nombre_config, api_url, api_key, telefono_origen, configuracion_extra } = await req.json()
        if (!proveedor || !nombre_config || !api_url || !api_key || !telefono_origen) {
          return new Response(JSON.stringify({ error: 'Todos los campos son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { data, error } = await supabase.from('whatsapp_config').insert({ proveedor, nombre_config, api_url, api_key, telefono_origen, configuracion_extra }).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ config: { ...data, api_key: data.api_key.substring(0, 4) + '****' }, message: 'Config creada' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (endpoint.startsWith('config-') || (endpoint !== 'config' && endpoint !== 'plantillas' && endpoint !== 'enviar' && endpoint !== 'bitacora' && endpoint !== 'reintentar' && endpoint !== 'probar')) {
      // Es un ID de config
      const configId = endpoint
      if (method === 'PUT') {
        const { nombre_config, api_url, api_key, telefono_origen, activo, configuracion_extra } = await req.json()
        const updates: any = {}
        if (nombre_config) updates.nombre_config = nombre_config
        if (api_url) updates.api_url = api_url
        if (api_key) updates.api_key = api_key
        if (telefono_origen) updates.telefono_origen = telefono_origen
        if (activo !== undefined) updates.activo = activo
        if (configuracion_extra) updates.configuracion_extra = configuracion_extra
        const { data, error } = await supabase.from('whatsapp_config').update(updates).eq('id', configId).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ config: { ...data, api_key: data.api_key.substring(0, 4) + '****' }, message: 'Config actualizada' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('whatsapp_config').delete().eq('id', configId)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Config eliminada' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ============ PLANTILLAS ============
    if (endpoint === 'plantillas') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('whatsapp_plantillas').select('*').order('tipo').order('nombre')
        if (error) throw error
        return new Response(JSON.stringify({ plantillas: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (method === 'POST') {
        const { nombre, descripcion, tipo, contenido, variables_requeridas } = await req.json()
        if (!nombre || !tipo || !contenido) {
          return new Response(JSON.stringify({ error: 'nombre, tipo y contenido son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { data, error } = await supabase.from('whatsapp_plantillas').insert({ nombre, descripcion, tipo, contenido, variables_requeridas: variables_requeridas || [] }).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ plantilla: data, message: 'Plantilla creada' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (endpoint !== 'config' && endpoint !== 'plantillas' && endpoint !== 'enviar' && endpoint !== 'bitacora' && endpoint !== 'reintentar' && endpoint !== 'probar') {
      const plantillaId = endpoint
      if (method === 'GET') {
        const { data, error } = await supabase.from('whatsapp_plantillas').select('*').eq('id', plantillaId).single()
        if (error) throw error
        return new Response(JSON.stringify({ plantilla: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (method === 'PUT') {
        const { nombre, descripcion, tipo, contenido, variables_requeridas, activa } = await req.json()
        const updates: any = {}
        if (nombre) updates.nombre = nombre
        if (descripcion !== undefined) updates.descripcion = descripcion
        if (tipo) updates.tipo = tipo
        if (contenido) updates.contenido = contenido
        if (variables_requeridas) updates.variables_requeridas = variables_requeridas
        if (activa !== undefined) updates.activa = activa
        const { data, error } = await supabase.from('whatsapp_plantillas').update(updates).eq('id', plantillaId).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ plantilla: data, message: 'Plantilla actualizada' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('whatsapp_plantillas').delete().eq('id', plantillaId)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Plantilla eliminada' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ============ ENVIAR NOTIFICACIÓN ============
    if (endpoint === 'enviar' && method === 'POST') {
      const { cliente_id, plantilla_id, variables, config_id, tipo_notificacion } = await req.json()
      if (!cliente_id || !plantilla_id || !variables) {
        return new Response(JSON.stringify({ error: 'cliente_id, plantilla_id y variables son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('enviar_notificacion_whatsapp', {
        p_cliente_id: cliente_id,
        p_plantilla_id: plantilla_id,
        p_variables: variables,
        p_config_id: config_id,
        p_tipo_notificacion: tipo_notificacion || 'personalizado',
      })
      if (error) throw error
      if (!data.success) return new Response(JSON.stringify({ error: data.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ============ ENVIAR MASIVO (CORTE QUINCENAL) ============
    if (endpoint === 'enviar-masivo' && method === 'POST') {
      const { fecha_inicio, fecha_fin, plantilla_id, config_id, solo_morosos } = await req.json()
      if (!fecha_inicio || !fecha_fin || !plantilla_id) {
        return new Response(JSON.stringify({ error: 'fecha_inicio, fecha_fin y plantilla_id son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Obtener morosos
      const { data: morososData, error: morososError } = await supabase.rpc('obtener_morosos_para_notificar', {
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
      })
      if (morososError) throw morososError
      if (!morososData.success) return new Response(JSON.stringify({ error: morososData.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      let destinatarios = morososData.morosos
      if (!solo_morosos) {
        // Obtener también al día para notificarles (opcional)
        const { data: alDia } = await supabase
          .from('cuentas_quincenales')
          .select('id, cliente_id, total_acumulado, fecha_inicio, fecha_fin, perfiles!inner(nombre, telefono_whatsapp)')
          .eq('fecha_inicio', fecha_inicio)
          .eq('fecha_fin', fecha_fin)
          .eq('total_acumulado', 0)
        if (alDia) {
          destinatarios = [...destinatarios, ...alDia.map((d: any) => ({
            cuenta_id: d.id,
            cliente_id: d.cliente_id,
            nombre: d.perfiles.nombre,
            telefono_whatsapp: d.perfiles.telefono_whatsapp,
            total_deuda: 0,
            fecha_inicio: d.fecha_inicio,
            fecha_fin: d.fecha_fin,
          }))]
        }
      }

      const resultados = []
      for (const dest of destinatarios) {
        if (!dest.telefono_whatsapp) continue
        const variables = {
          nombre: dest.nombre,
          monto: dest.total_deuda.toFixed(2),
          fecha_inicio: new Date(dest.fecha_inicio).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' }),
          fecha_fin: new Date(dest.fecha_fin).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        }
        const { data } = await supabase.rpc('enviar_notificacion_whatsapp', {
          p_cliente_id: dest.cliente_id,
          p_plantilla_id: plantilla_id,
          p_variables: variables,
          p_config_id: config_id,
          p_tipo_notificacion: 'corte_quincenal',
        })
        resultados.push({ cliente: dest.nombre, telefono: dest.telefono_whatsapp, ...data })
        // Pequeña pausa para no saturar API
        await new Promise(r => setTimeout(r, 100))
      }

      const exitosos = resultados.filter(r => r.success).length
      return new Response(JSON.stringify({ total: resultados.length, exitosos, fallidos: resultados.length - exitosos, detalles: resultados }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ============ BITÁCORA ============
    if (endpoint === 'bitacora') {
      if (method === 'GET') {
        const fecha_inicio = url.searchParams.get('fecha_inicio')
        const fecha_fin = url.searchParams.get('fecha_fin')
        const cliente_id = url.searchParams.get('cliente_id')
        const tipo = url.searchParams.get('tipo')
        const estado = url.searchParams.get('estado') // 'enviado', 'fallido', 'pendiente'
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        let query = supabase
          .from('bitacora_notificaciones')
          .select(`
            *,
            perfiles (nombre, telefono_whatsapp),
            whatsapp_plantillas (nombre, tipo),
            whatsapp_config (nombre_config, proveedor)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (fecha_inicio) query = query.gte('created_at', `${fecha_inicio}T00:00:00`)
        if (fecha_fin) query = query.lte('created_at', `${fecha_fin}T23:59:59`)
        if (cliente_id) query = query.eq('cliente_id', cliente_id)
        if (tipo) query = query.eq('tipo_notificacion', tipo)
        if (estado === 'enviado') query = query.eq('enviado_exitosamente', true)
        if (estado === 'fallido') query = query.eq('enviado_exitosamente', false)

        const { data, error, count } = await query
        if (error) throw error

        return new Response(JSON.stringify({ bitacora: data, pagination: { limit, offset, total: count || 0 } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ============ REINTENTAR FALLIDOS ============
    if (endpoint === 'reintentar' && method === 'POST') {
      const { max_reintentos } = await req.json()
      const { data, error } = await supabase.rpc('procesar_cola_reintentos_whatsapp', { p_max_reintentos: max_reintentos || 3 })
      if (error) throw error
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ============ PROBAR CONFIG (TEST) ============
    if (endpoint === 'probar' && method === 'POST') {
      const { config_id, telefono_prueba, mensaje_prueba } = await req.json()
      if (!config_id || !telefono_prueba) {
        return new Response(JSON.stringify({ error: 'config_id y telefono_prueba son requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: config, error: configError } = await supabase.from('whatsapp_config').select('*').eq('id', config_id).single()
      if (configError) throw configError

      // Simulación de envío de prueba
      const mensaje = mensaje_prueba || '🧪 *Prueba de configuración* - Comedor El Buen Sabor\n\nEsta es una notificación de prueba desde el panel de administración.'
      const messageSid = 'test_' + Date.now()

      return new Response(JSON.stringify({
        success: true,
        message: 'Mensaje de prueba enviado (simulado)',
        message_sid: messageSid,
        proveedor: config.proveedor,
        telefono_destino: telefono_prueba,
        contenido: mensaje,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})