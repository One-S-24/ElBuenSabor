import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient, createServiceRoleClient } from '../_shared/supabase.ts'
import {
  createSession,
  getQr,
  getSession,
  isMaskedOrEmpty,
  maskApiKey,
  normalizeBaseUrl,
  openwaErrorMessage,
  OpenWAError,
  phoneToChatId,
  renderTemplate,
  resolveConfig,
  sendText,
  sleep,
  startSession,
  stopSession,
  type OpenWAConfig,
  type OpenWASession,
} from '../_shared/openwa.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const MAX_BULK_RECIPIENTS = 100
const SESSION_NAME_PATTERN = /^[a-zA-Z0-9-]{3,50}$/
const PLANTILLA_TIPOS = [
  'corte_quincenal',
  'recordatorio_pago',
  'pedido_confirmado',
  'stock_bajo',
  'personalizado',
]

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSegments(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean)
  // La función se sirve como /functions/v1/whatsapp/...; todo lo que sigue
  // al nombre de la función es la ruta interna.
  const index = parts.lastIndexOf('whatsapp')
  return index >= 0 ? parts.slice(index + 1) : []
}

async function readBody(req: Request): Promise<Record<string, any>> {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return {}

  const text = await req.text()
  if (!text) return {}

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new ApiError(400, 'El cuerpo de la solicitud no es JSON válido')
  }
}

async function assertAdmin(supabase: any): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'No autenticado')

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfilError || perfil?.rol !== 'administrador') {
    throw new ApiError(403, 'Acceso denegado: solo administradores')
  }

  return user.id
}

function safeConfig(row: Record<string, any>) {
  return {
    ...row,
    api_key: maskApiKey(row.api_key || ''),
    has_api_key: Boolean(row.api_key),
  }
}

function normalizeSessionId(value: unknown): string {
  const sessionId = String(value ?? '').trim()
  if (!SESSION_NAME_PATTERN.test(sessionId)) {
    throw new ApiError(
      400,
      'El nombre de la sesión debe tener entre 3 y 50 caracteres y usar solo letras, números y guiones.',
    )
  }
  return sessionId
}

function normalizeDelay(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1200
  return Math.min(10000, Math.max(0, Math.round(parsed)))
}

function normalizeCountryCode(value: unknown): string {
  const digits = String(value ?? '505').replace(/\D/g, '')
  return digits || '505'
}

function buildExtra(
  body: Record<string, any>,
  current: Record<string, any> = {},
): Record<string, any> {
  const incoming = body.configuracion_extra && typeof body.configuracion_extra === 'object'
    ? body.configuracion_extra
    : {}

  return {
    ...current,
    ...incoming,
    delay_ms: normalizeDelay(body.delay_ms ?? incoming.delay_ms ?? current.delay_ms),
    country_code: normalizeCountryCode(
      body.country_code ?? incoming.country_code ?? current.country_code,
    ),
  }
}

async function deactivateOtherConfigs(supabase: any, keepId?: string) {
  const fallbackId = '00000000-0000-0000-0000-000000000000'
  const query = supabase.from('whatsapp_config').update({ activo: false })
  await query.neq('id', keepId || fallbackId)
}

interface EnviarInput {
  cliente_id: string
  plantilla_id: string
  variables?: Record<string, unknown>
  config_id?: string | null
  tipo_notificacion?: string
  idempotency_key?: string
}

async function enviarNotificacion(
  supabase: any,
  input: EnviarInput,
  presetConfig?: OpenWAConfig,
) {
  if (!input.cliente_id) throw new ApiError(400, 'cliente_id es requerido')
  if (!input.plantilla_id) throw new ApiError(400, 'plantilla_id es requerido')

  const config = presetConfig || await resolveConfig(supabase, input.config_id)
  const variables = input.variables ?? {}

  const { data: cliente, error: clienteError } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono_whatsapp')
    .eq('id', input.cliente_id)
    .single()

  if (clienteError || !cliente) {
    throw new ApiError(404, 'Cliente no encontrado')
  }

  const { data: plantilla, error: plantillaError } = await supabase
    .from('whatsapp_plantillas')
    .select('*')
    .eq('id', input.plantilla_id)
    .single()

  if (plantillaError || !plantilla) {
    throw new ApiError(404, 'Plantilla de WhatsApp no encontrada')
  }
  if (!plantilla.activa) {
    throw new ApiError(400, 'La plantilla de WhatsApp está inactiva')
  }

  const rendered = renderTemplate(plantilla.contenido, variables)
  if (rendered.missing.length > 0) {
    throw new ApiError(
      400,
      `Faltan variables de la plantilla: ${rendered.missing.join(', ')}`,
    )
  }
  if (!rendered.text) {
    throw new ApiError(400, 'La plantilla quedó vacía después de renderizarse')
  }

  const chatId = phoneToChatId(cliente.telefono_whatsapp, config.countryCode)
  const rawMonto = variables.monto ?? variables.total ?? 0
  const monto = Number(rawMonto)
  const tipo = PLANTILLA_TIPOS.includes(String(input.tipo_notificacion ?? ''))
    ? String(input.tipo_notificacion)
    : (PLANTILLA_TIPOS.includes(String(plantilla.tipo)) ? String(plantilla.tipo) : 'personalizado')

  // Se registra primero como pendiente para no perder el intento si OpenWA
  // tarda o la función se interrumpe.
  const { data: log, error: logError } = await supabase
    .from('bitacora_notificaciones')
    .insert({
      cliente_id: input.cliente_id,
      monto_notificado: Number.isFinite(monto) ? monto : 0,
      enviado_exitosamente: false,
      respuesta_api: JSON.stringify({ status: 'pendiente', proveedor: 'openwa' }),
      plantilla_id: input.plantilla_id,
      config_id: config.id ?? null,
      tipo_notificacion: tipo,
      telefono_destino: chatId,
      contenido_enviado: rendered.text,
      idempotency_key: input.idempotency_key || crypto.randomUUID(),
    })
    .select('id, idempotency_key')
    .single()

  if (logError || !log) {
    throw new Error(`No se pudo registrar la notificación: ${logError?.message ?? 'error desconocido'}`)
  }

  try {
    const result = await sendText(
      config,
      chatId,
      rendered.text,
      log.idempotency_key || log.id,
    )

    const respuesta = {
      status: 'sent',
      proveedor: 'openwa',
      session_id: config.sessionId,
      chat_id: chatId,
      message_id: result.messageId,
      timestamp: result.timestamp,
    }

    await supabase
      .from('bitacora_notificaciones')
      .update({
        enviado_exitosamente: true,
        message_id: result.messageId,
        error_mensaje: null,
        respuesta_api: JSON.stringify(respuesta),
      })
      .eq('id', log.id)

    return {
      success: true,
      id: log.id,
      message_id: result.messageId,
      timestamp: result.timestamp,
      telefono_destino: chatId,
      contenido: rendered.text,
      proveedor: 'openwa',
      status: 'sent',
    }
  } catch (error) {
    const message = openwaErrorMessage(error)
    const respuesta = {
      status: 'failed',
      proveedor: 'openwa',
      session_id: config.sessionId,
      chat_id: chatId,
      error: message,
      ...(error instanceof OpenWAError
        ? { status_code: error.status, code: error.code }
        : {}),
    }

    await supabase
      .from('bitacora_notificaciones')
      .update({
        enviado_exitosamente: false,
        error_mensaje: message,
        respuesta_api: JSON.stringify(respuesta),
      })
      .eq('id', log.id)

    throw new ApiError(502, message)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createSupabaseClient(req)

    const url = new URL(req.url)
    const segments = getSegments(url.pathname)
    const resource = segments[0] ?? ''
    const resourceId = segments[1] ?? ''
    const body = await readBody(req)
    const method = req.method

    // El cliente puede solicitar la confirmación de su propio pedido; el
    // resto de endpoints son exclusivos de administradores.
    if (resource !== 'pedido-confirmado') {
      await assertAdmin(supabase)
    }

    /* ============================================================ */
    /* Confirmación de pedido para el cliente                       */
    /* ============================================================ */
    if (resource === 'pedido-confirmado' && method === 'POST') {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new ApiError(401, 'No autenticado')

      const pedidoId = String(body.pedido_id ?? '').trim()
      if (!pedidoId) throw new ApiError(400, 'pedido_id es requerido')

      // La consulta usa el JWT del cliente: RLS impide ver pedidos ajenos.
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          id, cliente_id, estado, total_calculado,
          perfiles!inner (nombre),
          detalle_pedidos (cantidad, subtotal, platillos (nombre))
        `)
        .eq('id', pedidoId)
        .maybeSingle()

      if (pedidoError) throw pedidoError
      if (!pedido) throw new ApiError(404, 'Pedido no encontrado')
      if (pedido.cliente_id !== user.id) throw new ApiError(403, 'No autorizado')
      if (pedido.estado !== 'CONFIRMADO') {
        throw new ApiError(400, 'El pedido no está confirmado')
      }

      // Plantilla y configuración no son visibles para el cliente por RLS.
      const service = createServiceRoleClient()
      const idempotencyKey = `pedido-confirmado-${pedidoId}`

      // Evita reenvíos si el cliente recarga o repite la solicitud.
      const { data: existente } = await service
        .from('bitacora_notificaciones')
        .select('id, enviado_exitosamente')
        .eq('idempotency_key', idempotencyKey)
        .limit(1)
        .maybeSingle()

      if (existente) {
        return json({
          success: true,
          skipped: true,
          already_sent: Boolean(existente.enviado_exitosamente),
          message: 'La confirmación de este pedido ya fue procesada',
        })
      }

      const { data: plantilla } = await service
        .from('whatsapp_plantillas')
        .select('*')
        .eq('tipo', 'pedido_confirmado')
        .eq('activa', true)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!plantilla) {
        return json({
          success: false,
          skipped: true,
          message: 'No hay una plantilla activa de pedido confirmado',
        })
      }

      const hoy = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Managua',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())

      const { data: menu } = await service
        .from('menus_diarios')
        .select('hora_limite_pedido')
        .eq('fecha', hoy)
        .eq('activo', true)
        .maybeSingle()

      const items = (Array.isArray(pedido.detalle_pedidos) ? pedido.detalle_pedidos : [])
        .map((detalle: any) => ({
          cantidad: detalle.cantidad,
          platillo: detalle.platillos?.nombre ?? 'Platillo',
          subtotal: Number(detalle.subtotal ?? 0).toFixed(2),
        }))

      const result = await enviarNotificacion(service, {
        cliente_id: user.id,
        plantilla_id: plantilla.id,
        variables: {
          nombre: pedido.perfiles?.nombre ?? 'Cliente',
          items,
          total: Number(pedido.total_calculado ?? 0).toFixed(2),
          hora_limite: String(menu?.hora_limite_pedido ?? '11:00:00').slice(0, 5),
        },
        tipo_notificacion: 'pedido_confirmado',
        idempotency_key: idempotencyKey,
      })

      return json(result)
    }

    /* ============================================================ */
    /* Configuración de OpenWA                                      */
    /* ============================================================ */
    if (resource === 'config' || resource === 'configs') {
      if (!resourceId && method === 'GET') {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .select('*')
          .order('created_at')
        if (error) throw error
        return json({ configs: (data ?? []).map(safeConfig) })
      }

      if (!resourceId && method === 'POST') {
        const sessionId = normalizeSessionId(body.session_id)
        const apiUrl = normalizeBaseUrl(String(body.api_url ?? ''))
        const apiKey = String(body.api_key ?? '').trim()
        if (!apiKey) throw new ApiError(400, 'La API key de OpenWA es requerida')

        const activo = body.activo !== false
        if (activo) await deactivateOtherConfigs(supabase)

        const { data, error } = await supabase
          .from('whatsapp_config')
          .insert({
            proveedor: 'openwa',
            nombre_config: String(body.nombre_config ?? 'OpenWA').trim() || 'OpenWA',
            api_url: apiUrl,
            api_key: apiKey,
            telefono_origen: String(body.telefono_origen ?? '').trim(),
            activo,
            session_id: sessionId,
            configuracion_extra: buildExtra(body),
          })
          .select()
          .single()

        if (error) throw error
        return json({ config: safeConfig(data), message: 'Configuración creada' }, 201)
      }

      if (resourceId && method === 'GET') {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('id', resourceId)
          .single()
        if (error) throw new ApiError(404, 'Configuración no encontrada')
        return json({ config: safeConfig(data) })
      }

      if (resourceId && method === 'PUT') {
        const { data: current, error: currentError } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('id', resourceId)
          .single()
        if (currentError || !current) throw new ApiError(404, 'Configuración no encontrada')

        const updates: Record<string, any> = {}

        if (body.nombre_config !== undefined) {
          updates.nombre_config = String(body.nombre_config).trim() || 'OpenWA'
        }
        if (body.api_url !== undefined) {
          updates.api_url = normalizeBaseUrl(String(body.api_url))
        }
        if (body.session_id !== undefined) {
          updates.session_id = normalizeSessionId(body.session_id)
        }
        if (body.telefono_origen !== undefined) {
          updates.telefono_origen = String(body.telefono_origen ?? '').trim()
        }
        if (body.activo !== undefined) {
          updates.activo = Boolean(body.activo)
          if (updates.activo) await deactivateOtherConfigs(supabase, resourceId)
        }
        if (!isMaskedOrEmpty(body.api_key)) {
          updates.api_key = String(body.api_key).trim()
        }

        updates.configuracion_extra = buildExtra(body, current.configuracion_extra || {})

        const { data, error } = await supabase
          .from('whatsapp_config')
          .update(updates)
          .eq('id', resourceId)
          .select()
          .single()

        if (error) throw error
        return json({ config: safeConfig(data), message: 'Configuración actualizada' })
      }

      if (resourceId && method === 'DELETE') {
        const { error } = await supabase
          .from('whatsapp_config')
          .delete()
          .eq('id', resourceId)
        if (error) throw error
        return json({ message: 'Configuración eliminada' })
      }

      throw new ApiError(405, 'Método no permitido para configuración')
    }

    /* ============================================================ */
    /* Plantillas                                                   */
    /* ============================================================ */
    if (resource === 'plantillas') {
      if (!resourceId && method === 'GET') {
        const { data, error } = await supabase
          .from('whatsapp_plantillas')
          .select('*')
          .order('tipo')
          .order('nombre')
        if (error) throw error
        return json({ plantillas: data ?? [] })
      }

      if (!resourceId && method === 'POST') {
        const nombre = String(body.nombre ?? '').trim()
        const tipo = String(body.tipo ?? '')
        const contenido = String(body.contenido ?? '')

        if (!nombre || !tipo || !contenido) {
          throw new ApiError(400, 'nombre, tipo y contenido son requeridos')
        }
        if (!PLANTILLA_TIPOS.includes(tipo)) {
          throw new ApiError(400, `Tipo de plantilla inválido. Usa: ${PLANTILLA_TIPOS.join(', ')}`)
        }

        const { data, error } = await supabase
          .from('whatsapp_plantillas')
          .insert({
            nombre,
            descripcion: body.descripcion ?? null,
            tipo,
            contenido,
            variables_requeridas: body.variables_requeridas ?? [],
            activa: body.activa !== false,
          })
          .select()
          .single()

        if (error) throw error
        return json({ plantilla: data, message: 'Plantilla creada' }, 201)
      }

      if (resourceId && method === 'GET') {
        const { data, error } = await supabase
          .from('whatsapp_plantillas')
          .select('*')
          .eq('id', resourceId)
          .single()
        if (error) throw new ApiError(404, 'Plantilla no encontrada')
        return json({ plantilla: data })
      }

      if (resourceId && method === 'PUT') {
        const updates: Record<string, any> = {}
        if (body.nombre !== undefined) updates.nombre = String(body.nombre).trim()
        if (body.descripcion !== undefined) updates.descripcion = body.descripcion
        if (body.tipo !== undefined) {
          if (!PLANTILLA_TIPOS.includes(String(body.tipo))) {
            throw new ApiError(400, `Tipo de plantilla inválido. Usa: ${PLANTILLA_TIPOS.join(', ')}`)
          }
          updates.tipo = body.tipo
        }
        if (body.contenido !== undefined) updates.contenido = body.contenido
        if (body.variables_requeridas !== undefined) {
          updates.variables_requeridas = body.variables_requeridas
        }
        if (body.activa !== undefined) updates.activa = Boolean(body.activa)

        const { data, error } = await supabase
          .from('whatsapp_plantillas')
          .update(updates)
          .eq('id', resourceId)
          .select()
          .single()

        if (error) throw error
        return json({ plantilla: data, message: 'Plantilla actualizada' })
      }

      if (resourceId && method === 'DELETE') {
        const { error } = await supabase
          .from('whatsapp_plantillas')
          .delete()
          .eq('id', resourceId)
        if (error) throw error
        return json({ message: 'Plantilla eliminada' })
      }

      throw new ApiError(405, 'Método no permitido para plantillas')
    }

    /* ============================================================ */
    /* Envío individual                                             */
    /* ============================================================ */
    if (resource === 'enviar' && method === 'POST') {
      const result = await enviarNotificacion(supabase, {
        cliente_id: body.cliente_id,
        plantilla_id: body.plantilla_id,
        variables: body.variables ?? {},
        config_id: body.config_id ?? null,
        tipo_notificacion: body.tipo_notificacion,
      })
      return json(result)
    }

    /* ============================================================ */
    /* Envío masivo (corte quincenal)                               */
    /* ============================================================ */
    if (resource === 'enviar-masivo' && method === 'POST') {
      const { fecha_inicio, fecha_fin, plantilla_id, config_id, solo_morosos } = body
      if (!fecha_inicio || !fecha_fin || !plantilla_id) {
        throw new ApiError(400, 'fecha_inicio, fecha_fin y plantilla_id son requeridos')
      }

      const config = await resolveConfig(supabase, config_id ?? null)
      const { data: morososData, error: morososError } = await supabase.rpc(
        'obtener_morosos_para_notificar',
        { p_fecha_inicio: fecha_inicio, p_fecha_fin: fecha_fin },
      )
      if (morososError) throw morososError
      if (!morososData?.success) {
        throw new ApiError(400, morososData?.error || 'No se pudieron obtener los morosos')
      }

      let destinatarios: any[] = Array.isArray(morososData.morosos) ? morososData.morosos : []

      if (solo_morosos === false) {
        const { data: alDia } = await supabase
          .from('cuentas_quincenales')
          .select('id, cliente_id, total_acumulado, fecha_inicio, fecha_fin, perfiles!inner(nombre, telefono_whatsapp)')
          .eq('fecha_inicio', fecha_inicio)
          .eq('fecha_fin', fecha_fin)
          .eq('total_acumulado', 0)

        if (alDia) {
          destinatarios = [
            ...destinatarios,
            ...alDia.map((d: any) => ({
              cuenta_id: d.id,
              cliente_id: d.cliente_id,
              nombre: d.perfiles?.nombre,
              telefono_whatsapp: d.perfiles?.telefono_whatsapp,
              total_deuda: 0,
              fecha_inicio: d.fecha_inicio,
              fecha_fin: d.fecha_fin,
            })),
          ]
        }
      }

      const totalOriginal = destinatarios.length
      destinatarios = destinatarios.slice(0, MAX_BULK_RECIPIENTS)

      const delayMs = normalizeDelay(body.delay_ms ?? config.delayMs)
      const resultados: any[] = []
      let exitosos = 0
      let fallidos = 0

      for (let index = 0; index < destinatarios.length; index++) {
        const dest = destinatarios[index]
        if (!dest.cliente_id) continue

        const variables = {
          nombre: dest.nombre ?? '',
          monto: Number(dest.total_deuda ?? 0).toFixed(2),
          fecha_inicio,
          fecha_fin,
        }

        try {
          const result = await enviarNotificacion(
            supabase,
            {
              cliente_id: dest.cliente_id,
              plantilla_id,
              variables,
              config_id: config.id ?? null,
              tipo_notificacion: 'corte_quincenal',
            },
            config,
          )
          exitosos++
          resultados.push({
            cliente: dest.nombre,
            telefono: dest.telefono_whatsapp,
            ...result,
          })
        } catch (error) {
          fallidos++
          resultados.push({
            cliente: dest.nombre,
            telefono: dest.telefono_whatsapp,
            success: false,
            error: openwaErrorMessage(error),
          })
        }

        if (index < destinatarios.length - 1) await sleep(delayMs)
      }

      return json({
        total: destinatarios.length,
        exitosos,
        fallidos,
        omitidos: totalOriginal - destinatarios.length,
        delay_ms: delayMs,
        detalles: resultados,
      })
    }

    /* ============================================================ */
    /* Bitácora                                                     */
    /* ============================================================ */
    if (resource === 'bitacora' && method === 'GET') {
      const fechaInicio = url.searchParams.get('fecha_inicio')
      const fechaFin = url.searchParams.get('fecha_fin')
      const clienteId = url.searchParams.get('cliente_id')
      const tipo = url.searchParams.get('tipo')
      const estado = url.searchParams.get('estado')
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
      const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))

      let query = supabase
        .from('bitacora_notificaciones')
        .select(`
          *,
          perfiles (nombre, telefono_whatsapp),
          whatsapp_plantillas (nombre, tipo),
          whatsapp_config (nombre_config, proveedor, session_id)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (fechaInicio) query = query.gte('created_at', `${fechaInicio}T00:00:00`)
      if (fechaFin) query = query.lte('created_at', `${fechaFin}T23:59:59`)
      if (clienteId) query = query.eq('cliente_id', clienteId)
      if (tipo) query = query.eq('tipo_notificacion', tipo)
      if (estado === 'enviado') query = query.eq('enviado_exitosamente', true)
      if (estado === 'fallido') query = query.eq('enviado_exitosamente', false)

      const { data, error, count } = await query
      if (error) throw error

      return json({
        bitacora: data ?? [],
        pagination: { limit, offset, total: count || 0 },
      })
    }

    /* ============================================================ */
    /* Reintentos                                                   */
    /* ============================================================ */
    if (resource === 'reintentar' && method === 'POST') {
      const maxReintentos = Math.max(1, Math.min(10, Number(body.max_reintentos ?? 3)))
      const { data: rows, error } = await supabase
        .from('bitacora_notificaciones')
        .select('*')
        .eq('enviado_exitosamente', false)
        .lt('reintentos', maxReintentos)
        .not('contenido_enviado', 'is', null)
        .not('telefono_destino', 'is', null)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      let procesados = 0
      let enviados = 0
      const detalles: any[] = []

      for (const row of rows ?? []) {
        if (!row.telefono_destino || !row.contenido_enviado) continue
        procesados++

        try {
          const config = await resolveConfig(supabase, row.config_id ?? null)
          const result = await sendText(
            config,
            row.telefono_destino,
            row.contenido_enviado,
            row.idempotency_key || row.id,
          )

          await supabase
            .from('bitacora_notificaciones')
            .update({
              reintentos: (row.reintentos ?? 0) + 1,
              enviado_exitosamente: true,
              message_id: result.messageId,
              error_mensaje: null,
              proximo_reintento: null,
              respuesta_api: JSON.stringify({
                status: 'sent',
                proveedor: 'openwa',
                retry: (row.reintentos ?? 0) + 1,
                message_id: result.messageId,
              }),
            })
            .eq('id', row.id)

          enviados++
          detalles.push({ id: row.id, success: true, message_id: result.messageId })
        } catch (error) {
          const message = openwaErrorMessage(error)
          await supabase
            .from('bitacora_notificaciones')
            .update({
              reintentos: (row.reintentos ?? 0) + 1,
              error_mensaje: message,
              proximo_reintento: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              respuesta_api: JSON.stringify({
                status: 'failed',
                proveedor: 'openwa',
                retry: (row.reintentos ?? 0) + 1,
                error: message,
              }),
            })
            .eq('id', row.id)

          detalles.push({ id: row.id, success: false, error: message })
        }

        await sleep(800)
      }

      return json({
        success: true,
        procesados,
        enviados,
        fallidos: procesados - enviados,
        detalles,
      })
    }

    /* ============================================================ */
    /* Envío de prueba                                              */
    /* ============================================================ */
    if (resource === 'probar' && method === 'POST') {
      const telefono = String(body.telefono_prueba ?? '').trim()
      if (!telefono) throw new ApiError(400, 'telefono_prueba es requerido')

      const config = await resolveConfig(supabase, body.config_id ?? null)
      const chatId = phoneToChatId(telefono, config.countryCode)
      const contenido = String(
        body.mensaje_prueba
          ?? '🧪 *Prueba de configuración* - Comedor El Buen Sabor\n\nEsta es una notificación de prueba enviada desde el panel de administración.',
      )

      const result = await sendText(config, chatId, contenido)

      return json({
        success: true,
        message_id: result.messageId,
        proveedor: 'openwa',
        telefono_destino: chatId,
        contenido,
      })
    }

    /* ============================================================ */
    /* Estado / QR / conexión de la sesión OpenWA                   */
    /* ============================================================ */
    if (resource === 'openwa') {
      const action = resourceId
      const configId = typeof body.config_id === 'string' && body.config_id
        ? body.config_id
        : url.searchParams.get('config_id')

      let config: OpenWAConfig
      try {
        config = await resolveConfig(supabase, configId)
      } catch (error) {
        const message = openwaErrorMessage(error)
        if (action === 'estado') {
          return json({
            success: false,
            exists: false,
            status: 'unconfigured',
            message,
            sessionId: null,
            baseUrl: null,
          })
        }
        throw new ApiError(400, message)
      }

      if (action === 'estado' && method === 'GET') {
        try {
          const session = await getSession(config)
          return json({
            success: true,
            exists: true,
            session,
            sessionId: config.sessionId,
            baseUrl: config.baseUrl,
          })
        } catch (error) {
          if (error instanceof OpenWAError && error.status === 404) {
            return json({
              success: true,
              exists: false,
              status: 'not_created',
              sessionId: config.sessionId,
              baseUrl: config.baseUrl,
            })
          }

          return json({
            success: false,
            exists: false,
            status: 'unreachable',
            message: openwaErrorMessage(error),
            sessionId: config.sessionId,
            baseUrl: config.baseUrl,
          })
        }
      }

      if (action === 'qr' && method === 'GET') {
        try {
          const qr = await getQr(config)
          return json({ success: true, ...qr })
        } catch (error) {
          if (error instanceof OpenWAError && error.status === 400) {
            return json({
              success: true,
              qrCode: null,
              status: 'not_ready',
              message: 'El QR aún no está listo. Espera unos segundos e inténtalo de nuevo.',
            })
          }

          return json({
            success: false,
            qrCode: null,
            status: 'error',
            message: openwaErrorMessage(error),
          })
        }
      }

      if (action === 'conectar' && method === 'POST') {
        let session: OpenWASession | null = null

        try {
          session = await getSession(config)
        } catch (error) {
          if (error instanceof OpenWAError && error.status === 404) {
            await createSession(config)
            session = null
          } else {
            throw error
          }
        }

        if (!session || ['created', 'disconnected', 'failed'].includes(session.status)) {
          try {
            await startSession(config)
          } catch (error) {
            // 409 significa que ya estaba iniciando; cualquier otro error se propaga.
            if (!(error instanceof OpenWAError && error.status === 409)) throw error
          }
        }

        await sleep(1500)
        const updated = await getSession(config).catch(() => session)
        let qr: { qrCode: string | null; status: string; message?: string } | null = null

        if (updated?.status === 'qr_ready') {
          try {
            const result = await getQr(config)
            qr = { qrCode: result.qrCode, status: result.status }
          } catch (error) {
            qr = {
              qrCode: null,
              status: 'not_ready',
              message: openwaErrorMessage(error),
            }
          }
        }

        return json({
          success: true,
          session: updated,
          qr,
          sessionId: config.sessionId,
        })
      }

      if (action === 'detener' && method === 'POST') {
        await stopSession(config)
        await sleep(500)
        const session = await getSession(config).catch(() => null)
        return json({ success: true, session })
      }

      throw new ApiError(404, 'Acción de OpenWA no encontrada')
    }

    throw new ApiError(404, 'Endpoint no encontrado')
  } catch (error) {
    const status = error instanceof ApiError
      ? error.status
      : (error instanceof OpenWAError ? error.status : 500)

    const message = error instanceof ApiError
      ? error.message
      : openwaErrorMessage(error)

    return json({ error: message }, status >= 400 && status <= 599 ? status : 500)
  }
})
