import { supabase } from '../lib/supabaseClient'

const FUNCTION_SLUG = 'whatsapp'

/* ------------------------------------------------------------------ */
/* Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface WhatsAppConfig {
  id: string
  proveedor: string
  nombre_config: string
  api_url: string
  api_key: string
  has_api_key?: boolean
  telefono_origen: string | null
  session_id: string
  activo: boolean
  configuracion_extra: {
    delay_ms?: number
    country_code?: string
    [key: string]: unknown
  } | null
  created_at: string
  updated_at: string
}

export interface WhatsAppPlantilla {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  contenido: string
  variables_requeridas: string[]
  activa: boolean
  created_at: string
  updated_at: string
}

export interface BitacoraNotificacion {
  id: string
  cliente_id: string
  monto_notificado: number
  enviado_exitosamente: boolean
  respuesta_api: string | null
  created_at: string
  plantilla_id: string | null
  config_id: string | null
  tipo_notificacion: string | null
  reintentos: number
  proximo_reintento: string | null
  telefono_destino: string | null
  message_id: string | null
  contenido_enviado: string | null
  error_mensaje: string | null
  perfiles?: { nombre: string; telefono_whatsapp: string } | null
  whatsapp_plantillas?: { nombre: string; tipo: string } | null
  whatsapp_config?: { nombre_config: string; proveedor: string; session_id: string } | null
}

export interface OpenWASession {
  id: string
  name: string
  status: string
  phone?: string | null
  pushName?: string | null
  connectedAt?: string | null
  lastActive?: string | null
  lastError?: string | null
  engineLoaded?: boolean
}

export interface OpenWAQR {
  qrCode: string | null
  status: string
  message?: string
}

export interface EnvioResultado {
  success: boolean
  id?: string
  message_id?: string
  timestamp?: number
  telefono_destino?: string
  contenido?: string
  proveedor?: string
  status?: string
  error?: string
}

export interface EnvioMasivoResultado {
  total: number
  exitosos: number
  fallidos: number
  omitidos: number
  delay_ms: number
  detalles: Array<EnvioResultado & { cliente?: string; telefono?: string }>
}

export interface OpenWAEstado {
  success: boolean
  exists: boolean
  status?: string
  session?: OpenWASession | null
  message?: string
  sessionId?: string
  baseUrl?: string
}

/* ------------------------------------------------------------------ */
/* Invocación de la Edge Function                                     */
/* ------------------------------------------------------------------ */

interface InvokeOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
}

async function extractError(error: unknown): Promise<string> {
  if (error && typeof error === 'object') {
    const context = (error as { context?: Response }).context
    if (context && typeof context.clone === 'function') {
      try {
        const text = await context.clone().text()
        if (text) {
          try {
            const parsed = JSON.parse(text)
            return parsed.error || parsed.message || text
          } catch {
            return text
          }
        }
      } catch {
        // Ignorar y usar el mensaje genérico del error.
      }
    }

    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }

  return 'Error desconocido al comunicarse con el servidor'
}

async function invoke<T>(path: string, options: InvokeOptions = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`${FUNCTION_SLUG}${path}`, {
    // supabase-js usa POST por defecto; las lecturas de esta API son GET.
    method: options.method ?? 'GET',
    body: options.body,
  })

  if (error) throw new Error(await extractError(error))

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as Record<string, unknown>).error))
  }

  return data as T
}

/* ------------------------------------------------------------------ */
/* Configuración                                                      */
/* ------------------------------------------------------------------ */

export async function getWhatsAppConfigs(): Promise<WhatsAppConfig[]> {
  const data = await invoke<{ configs: WhatsAppConfig[] }>('/config')
  return data.configs ?? []
}

export async function getWhatsAppConfig(id: string): Promise<WhatsAppConfig> {
  const data = await invoke<{ config: WhatsAppConfig }>(`/config/${id}`)
  return data.config
}

export interface GuardarConfigPayload {
  nombre_config: string
  api_url: string
  api_key?: string
  telefono_origen?: string
  session_id: string
  activo: boolean
  delay_ms: number
  country_code: string
}

export async function crearWhatsAppConfig(payload: GuardarConfigPayload): Promise<WhatsAppConfig> {
  const data = await invoke<{ config: WhatsAppConfig }>('/config', {
    method: 'POST',
    body: payload,
  })
  return data.config
}

export async function actualizarWhatsAppConfig(
  id: string,
  payload: Partial<GuardarConfigPayload>,
): Promise<WhatsAppConfig> {
  const data = await invoke<{ config: WhatsAppConfig }>(`/config/${id}`, {
    method: 'PUT',
    body: payload,
  })
  return data.config
}

export async function eliminarWhatsAppConfig(id: string): Promise<void> {
  await invoke(`/config/${id}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------ */
/* Plantillas                                                          */
/* ------------------------------------------------------------------ */

export async function getWhatsAppPlantillas(): Promise<WhatsAppPlantilla[]> {
  const data = await invoke<{ plantillas: WhatsAppPlantilla[] }>('/plantillas')
  return data.plantillas ?? []
}

/* ------------------------------------------------------------------ */
/* Envíos                                                              */
/* ------------------------------------------------------------------ */

export interface EnviarPayload {
  cliente_id: string
  plantilla_id: string
  variables: Record<string, unknown>
  config_id?: string | null
  tipo_notificacion?: string
}

export async function enviarNotificacionWhatsApp(payload: EnviarPayload): Promise<EnvioResultado> {
  return invoke<EnvioResultado>('/enviar', { method: 'POST', body: payload })
}

/**
 * Solicita al servidor la confirmación por WhatsApp de un pedido propio.
 * El endpoint valida que el pedido pertenezca al usuario autenticado.
 */
export async function notificarPedidoConfirmado(pedidoId: string): Promise<{
  success: boolean
  skipped?: boolean
  message?: string
}> {
  return invoke('/pedido-confirmado', {
    method: 'POST',
    body: { pedido_id: pedidoId },
  })
}

export interface EnviarMasivoPayload {
  fecha_inicio: string
  fecha_fin: string
  plantilla_id: string
  config_id?: string | null
  solo_morosos?: boolean
  delay_ms?: number
}

export async function enviarMasivoWhatsApp(
  payload: EnviarMasivoPayload,
): Promise<EnvioMasivoResultado> {
  return invoke<EnvioMasivoResultado>('/enviar-masivo', { method: 'POST', body: payload })
}

export async function probarWhatsApp(payload: {
  telefono_prueba: string
  mensaje_prueba?: string
  config_id?: string | null
}): Promise<EnvioResultado> {
  return invoke<EnvioResultado>('/probar', { method: 'POST', body: payload })
}

/* ------------------------------------------------------------------ */
/* Bitácora                                                           */
/* ------------------------------------------------------------------ */

export interface BitacoraParams {
  estado?: 'enviado' | 'fallido'
  tipo?: string
  cliente_id?: string
  fecha_inicio?: string
  fecha_fin?: string
  limit?: number
  offset?: number
}

export async function getBitacora(
  params: BitacoraParams = {},
): Promise<{ bitacora: BitacoraNotificacion[]; pagination: { total: number } }> {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return invoke(`/bitacora${query ? `?${query}` : ''}`)
}

export async function reintentarFallidos(max = 3): Promise<{
  success: boolean
  procesados: number
  enviados: number
  fallidos: number
}> {
  return invoke('/reintentar', { method: 'POST', body: { max_reintentos: max } })
}

/* ------------------------------------------------------------------ */
/* Sesión OpenWA                                                      */
/* ------------------------------------------------------------------ */

export async function getOpenWAEstado(configId?: string): Promise<OpenWAEstado> {
  const query = configId ? `?config_id=${encodeURIComponent(configId)}` : ''
  return invoke<OpenWAEstado>(`/openwa/estado${query}`)
}

export async function getOpenWAQr(
  configId?: string,
): Promise<OpenWAQR & { success: boolean }> {
  const query = configId ? `?config_id=${encodeURIComponent(configId)}` : ''
  return invoke<OpenWAQR & { success: boolean }>(`/openwa/qr${query}`)
}

export async function conectarOpenWA(configId?: string): Promise<{
  success: boolean
  session: OpenWASession | null
  qr: OpenWAQR | null
  sessionId?: string
}> {
  return invoke('/openwa/conectar', {
    method: 'POST',
    body: { config_id: configId ?? null },
  })
}

export async function detenerOpenWA(configId?: string): Promise<{
  success: boolean
  session: OpenWASession | null
}> {
  return invoke('/openwa/detener', {
    method: 'POST',
    body: { config_id: configId ?? null },
  })
}
