/**
 * Cliente HTTP compartido para OpenWA.
 *
 * OpenWA es un gateway autoalojado de WhatsApp. Todas las llamadas se
 * hacen desde el servidor (Edge Function) para que la API key nunca
 * llegue al navegador.
 */

export const OPENWA_DEFAULT_COUNTRY = '505'
export const OPENWA_DEFAULT_DELAY_MS = 1200
export const OPENWA_TIMEOUT_MS = 15_000

export type OpenWASessionStatus =
  | 'created'
  | 'initializing'
  | 'qr_ready'
  | 'authenticating'
  | 'ready'
  | 'disconnected'
  | 'action_required'
  | 'failed'

export interface OpenWASession {
  id: string
  name: string
  status: OpenWASessionStatus
  phone?: string | null
  pushName?: string | null
  connectedAt?: string | null
  lastActive?: string | null
  createdAt?: string
  updatedAt?: string
  lastError?: string | null
  engineLoaded?: boolean
}

export interface OpenWAQR {
  qrCode: string
  status: OpenWASessionStatus
}

export interface OpenWAMessageResult {
  messageId: string
  timestamp: number
}

export interface OpenWAConfig {
  id?: string
  baseUrl: string
  apiKey: string
  sessionId: string
  delayMs: number
  countryCode: string
  nombreConfig?: string
  telefonoOrigen?: string
  source: 'db' | 'env'
  raw?: Record<string, unknown> | null
}

export class OpenWAError extends Error {
  status: number
  code?: string
  retryAfterSeconds?: number
  details?: unknown

  constructor(
    message: string,
    status: number,
    options: { code?: string; retryAfterSeconds?: number; details?: unknown } = {},
  ) {
    super(message)
    this.name = 'OpenWAError'
    this.status = status
    this.code = options.code
    this.retryAfterSeconds = options.retryAfterSeconds
    this.details = options.details
  }
}

/** Normaliza la URL base a la forma http(s)://host:puerto/api */
export function normalizeBaseUrl(input: string): string {
  let value = (input || '').trim()
  if (!value) throw new Error('La URL de OpenWA es requerida')
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`
  value = value.replace(/\/+$/, '')
  if (!/\/api$/i.test(value)) value = `${value}/api`
  return value
}

/**
 * Convierte un teléfono a chatId de WhatsApp.
 * - +50588887777 -> 50588887777@c.us
 * - 88887777     -> 50588887777@c.us (agrega el código de país)
 */
export function phoneToChatId(phone: string, countryCode = OPENWA_DEFAULT_COUNTRY): string {
  let digits = (phone || '').replace(/\D/g, '')
  if (!digits) throw new Error('El cliente no tiene un teléfono de WhatsApp configurado')
  if (digits.startsWith('00')) digits = digits.slice(2)

  const cc = (countryCode || '').replace(/\D/g, '')
  if (digits.length === 8 && cc) digits = `${cc}${digits}`
  if (digits.length < 8) throw new Error(`Teléfono inválido: ${phone}`)

  return `${digits}@c.us`
}

/** Formatea un teléfono para mostrarlo en la UI sin tocar el chatId. */
export function formatPhoneForDisplay(chatId: string): string {
  return (chatId || '').replace(/@c\.us$/, '')
}

export interface RenderTemplateResult {
  text: string
  missing: string[]
}

/**
 * Renderizador mínimo de plantillas:
 *  - {{variable}}
 *  - {{#each items}} ... {{campo}} ... {{/each}}
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): RenderTemplateResult {
  const missing = new Set<string>()

  let text = (template || '').replace(
    /\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, key: string, body: string) => {
      const list = variables[key]
      if (!Array.isArray(list)) {
        missing.add(key)
        return ''
      }
      return list
        .map((item) => {
          return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, field: string) => {
            const value = item && typeof item === 'object'
              ? (item as Record<string, unknown>)[field]
              : undefined
            if (value === undefined || value === null || value === '') {
              missing.add(`${key}.${field}`)
              return ''
            }
            return String(value)
          })
        })
        .join('\n')
    },
  )

  text = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key]
    if (value === undefined || value === null || value === '') {
      missing.add(key)
      return ''
    }
    if (Array.isArray(value)) return value.map((v) => String(v)).join(', ')
    return String(value)
  })

  return { text: text.trim(), missing: [...missing] }
}

/** Enmascara una API key para devolverla al frontend. */
export function maskApiKey(apiKey: string): string {
  const value = apiKey || ''
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

/** ¿El valor enviado desde la UI es la key enmascarada o un vacío? */
export function isMaskedOrEmpty(value: unknown): boolean {
  if (typeof value !== 'string') return true
  const trimmed = value.trim()
  return trimmed === '' || trimmed.includes('••') || trimmed.includes('****')
}

/** Traduce los errores de OpenWA a mensajes útiles en español. */
export function openwaErrorMessage(error: unknown): string {
  if (error instanceof OpenWAError) {
    switch (error.status) {
      case 400:
        return `Solicitud rechazada por OpenWA: ${error.message}`
      case 401:
        return 'La API key de OpenWA es inválida o fue revocada.'
      case 403:
        return 'La API key de OpenWA no tiene permisos para esta operación.'
      case 404:
        return 'La sesión de OpenWA no existe. Créala desde el panel o en el dashboard de OpenWA.'
      case 409:
        return 'La sesión de WhatsApp no está conectada. Escanea el QR e inténtalo de nuevo.'
      case 422:
        return `OpenWA rechazó la solicitud: ${error.message}`
      case 429:
        return `OpenWA limitó el envío. Reintenta en ${error.retryAfterSeconds ?? 'unos'} segundos.`
      case 502:
      case 503:
      case 504:
        return 'OpenWA no está disponible en este momento. Verifica que el contenedor esté encendido y sea accesible desde Supabase.'
      default:
        return error.message
    }
  }
  return error instanceof Error ? error.message : 'Error desconocido al comunicarse con OpenWA'
}

function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl)
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function openwaFetch<T>(
  config: OpenWAConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OPENWA_TIMEOUT_MS)

  try {
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('X-API-Key', config.apiKey)

    const response = await fetch(joinUrl(config.baseUrl, path), {
      ...init,
      headers,
      signal: controller.signal,
    })

    const raw = await response.text()
    let payload: unknown = null
    if (raw) {
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = raw
      }
    }

    if (!response.ok) {
      const body = payload as Record<string, unknown> | null
      const rawMessage = body?.message ?? body?.error
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : String(rawMessage || `OpenWA respondió ${response.status}`)

      throw new OpenWAError(message, response.status, {
        code: typeof body?.code === 'string' ? body.code : undefined,
        retryAfterSeconds: typeof body?.retryAfterSeconds === 'number'
          ? body.retryAfterSeconds
          : undefined,
        details: payload,
      })
    }

    return payload as T
  } catch (error) {
    if (error instanceof OpenWAError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new OpenWAError('OpenWA no respondió a tiempo (15 segundos).', 504)
    }
    throw new OpenWAError(
      error instanceof Error ? error.message : 'Error de conexión con OpenWA',
      502,
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

/* ------------------------------------------------------------------ */
/* Operaciones de OpenWA                                              */
/* ------------------------------------------------------------------ */

/**
 * OpenWA identifica las sesiones por UUID en sus rutas, pero el panel
 * configura un nombre legible. Esta caché (por isolate) traduce el nombre
 * al UUID y evita una consulta extra en cada envío.
 */
const sessionRefCache = new Map<string, string>()

function sessionCacheKey(config: OpenWAConfig): string {
  return `${config.baseUrl}|${config.sessionId}`
}

function rememberSessionRef(config: OpenWAConfig, session: OpenWASession | null) {
  if (session?.id) sessionRefCache.set(sessionCacheKey(config), session.id)
}

/** Devuelve el UUID de la sesión a partir de su nombre. */
export async function resolveSessionRef(config: OpenWAConfig): Promise<string> {
  const cacheKey = sessionCacheKey(config)
  const cached = sessionRefCache.get(cacheKey)
  if (cached) return cached

  const payload = await openwaFetch<OpenWASession[] | OpenWASession>(
    config,
    `/sessions?name=${encodeURIComponent(config.sessionId)}`,
  )

  const rows = Array.isArray(payload) ? payload : payload ? [payload] : []
  const session = rows.find((row) => row.name === config.sessionId) ?? rows[0]
  if (!session?.id) {
    throw new OpenWAError(
      `No existe la sesión "${config.sessionId}" en OpenWA. Créala desde el panel.`,
      404,
    )
  }

  sessionRefCache.set(cacheKey, session.id)
  return session.id
}

export async function getSession(config: OpenWAConfig): Promise<OpenWASession> {
  const sessionRef = await resolveSessionRef(config)
  try {
    const session = await openwaFetch<OpenWASession>(
      config,
      `/sessions/${encodeURIComponent(sessionRef)}`,
    )
    rememberSessionRef(config, session)
    return session
  } catch (error) {
    if (error instanceof OpenWAError && error.status === 404) {
      sessionRefCache.delete(sessionCacheKey(config))
    }
    throw error
  }
}

export async function createSession(config: OpenWAConfig): Promise<OpenWASession> {
  try {
    const session = await openwaFetch<OpenWASession>(config, '/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: config.sessionId }),
    })
    rememberSessionRef(config, session)
    return session
  } catch (error) {
    // La sesión ya existía: recuperar su UUID y devolverla.
    if (error instanceof OpenWAError && error.status === 409) {
      await resolveSessionRef(config)
      return getSession(config)
    }
    throw error
  }
}

export async function startSession(config: OpenWAConfig): Promise<unknown> {
  const sessionRef = await resolveSessionRef(config)
  return openwaFetch(
    config,
    `/sessions/${encodeURIComponent(sessionRef)}/start`,
    { method: 'POST' },
  )
}

export async function stopSession(config: OpenWAConfig): Promise<unknown> {
  const sessionRef = await resolveSessionRef(config)
  return openwaFetch(
    config,
    `/sessions/${encodeURIComponent(sessionRef)}/stop`,
    { method: 'POST' },
  )
}

export async function getQr(config: OpenWAConfig): Promise<OpenWAQR> {
  const sessionRef = await resolveSessionRef(config)
  return openwaFetch<OpenWAQR>(
    config,
    `/sessions/${encodeURIComponent(sessionRef)}/qr`,
  )
}

export async function sendText(
  config: OpenWAConfig,
  chatId: string,
  text: string,
  idempotencyKey?: string,
): Promise<OpenWAMessageResult> {
  const sessionRef = await resolveSessionRef(config)
  const headers: Record<string, string> = {}
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  return openwaFetch<OpenWAMessageResult>(
    config,
    `/sessions/${encodeURIComponent(sessionRef)}/messages/send-text`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId, text }),
    },
  )
}

export function health(config: OpenWAConfig): Promise<unknown> {
  return openwaFetch(config, '/health')
}

/* ------------------------------------------------------------------ */
/* Configuración                                                      */
/* ------------------------------------------------------------------ */

/**
 * Obtiene la configuración activa desde public.whatsapp_config.
 * Si no hay fila, usa las variables de entorno como fallback.
 *
 * Se ejecuta con el JWT del administrador, por lo que las políticas RLS
 * de la tabla siguen aplicando.
 */
export async function resolveConfig(
  supabase: any,
  configId?: string | null,
): Promise<OpenWAConfig> {
  let query = supabase.from('whatsapp_config').select('*')

  if (configId) {
    query = query.eq('id', configId)
  } else {
    query = query.eq('activo', true).order('updated_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`No se pudo leer la configuración de WhatsApp: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data

  if (configId && !row) {
    throw new Error('Configuración de WhatsApp no encontrada')
  }

  if (!row) {
    const envBaseUrl = Deno.env.get('OPENWA_BASE_URL')
    const envApiKey = Deno.env.get('OPENWA_API_KEY')
    const envSessionId = Deno.env.get('OPENWA_SESSION_ID')

    if (envBaseUrl && envApiKey && envSessionId) {
      return {
        baseUrl: normalizeBaseUrl(envBaseUrl),
        apiKey: envApiKey,
        sessionId: envSessionId,
        delayMs: OPENWA_DEFAULT_DELAY_MS,
        countryCode: OPENWA_DEFAULT_COUNTRY,
        source: 'env',
        raw: null,
      }
    }

    throw new Error(
      'No hay configuración de OpenWA activa. Configúrala en el panel de WhatsApp o define OPENWA_BASE_URL, OPENWA_API_KEY y OPENWA_SESSION_ID.',
    )
  }

  if (!row.api_key) {
    throw new Error('La configuración de OpenWA no tiene API key. Edítala en el panel de WhatsApp.')
  }
  if (!row.session_id) {
    throw new Error('La configuración de OpenWA no tiene session_id. Edítala en el panel de WhatsApp.')
  }

  const extra = row.configuracion_extra && typeof row.configuracion_extra === 'object'
    ? row.configuracion_extra as Record<string, unknown>
    : {}

  return {
    id: row.id,
    baseUrl: normalizeBaseUrl(row.api_url || 'http://host.docker.internal:2785'),
    apiKey: row.api_key,
    sessionId: row.session_id,
    delayMs: Number(extra.delay_ms ?? OPENWA_DEFAULT_DELAY_MS),
    countryCode: String(extra.country_code ?? OPENWA_DEFAULT_COUNTRY),
    nombreConfig: row.nombre_config,
    telefonoOrigen: row.telefono_origen,
    source: 'db',
    raw: row,
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}
