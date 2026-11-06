import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MessageCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'
import Badge from '../components/ui/badge'
import { Skeleton, SkeletonText } from '../components/ui/skeleton'
import { hoyManaguaISO } from '../lib/date'
import {
  actualizarWhatsAppConfig,
  conectarOpenWA,
  crearWhatsAppConfig,
  detenerOpenWA,
  getBitacora,
  getOpenWAEstado,
  getOpenWAQr,
  getWhatsAppConfigs,
  probarWhatsApp,
  reintentarFallidos,
  type BitacoraNotificacion,
  type GuardarConfigPayload,
  type OpenWAEstado,
  type OpenWAQR,
  type WhatsAppConfig,
} from '../services/whatsappService'

interface ConfigForm {
  nombre_config: string
  api_url: string
  session_id: string
  telefono_origen: string
  api_key: string
  activo: boolean
  delay_ms: number
  country_code: string
}

interface Notice {
  type: 'success' | 'error' | 'info'
  text: string
}

const EMPTY_FORM: ConfigForm = {
  nombre_config: 'OpenWA Local',
  api_url: 'http://host.docker.internal:2785',
  session_id: 'el-buen-sabor',
  telefono_origen: '',
  api_key: '',
  activo: true,
  delay_ms: 1200,
  country_code: '505',
}

const ESTADOS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'info' }> = {
  ready: { label: 'Conectado', variant: 'success' },
  qr_ready: { label: 'Esperando QR', variant: 'warning' },
  initializing: { label: 'Iniciando', variant: 'info' },
  authenticating: { label: 'Autenticando', variant: 'info' },
  created: { label: 'Creado', variant: 'default' },
  disconnected: { label: 'Desconectado', variant: 'error' },
  action_required: { label: 'Acción requerida', variant: 'warning' },
  failed: { label: 'Fallido', variant: 'error' },
  not_created: { label: 'Sin sesión', variant: 'warning' },
  unconfigured: { label: 'Sin configurar', variant: 'warning' },
  unreachable: { label: 'OpenWA inaccesible', variant: 'error' },
  unknown: { label: 'Desconocido', variant: 'default' },
}

function formFromConfig(config: WhatsAppConfig): ConfigForm {
  return {
    nombre_config: config.nombre_config || 'OpenWA',
    api_url: config.api_url || 'http://host.docker.internal:2785',
    session_id: config.session_id || 'el-buen-sabor',
    telefono_origen: config.telefono_origen || '',
    api_key: '',
    activo: config.activo,
    delay_ms: Number(config.configuracion_extra?.delay_ms ?? 1200),
    country_code: String(config.configuracion_extra?.country_code ?? '505'),
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export default function AdminWhatsApp() {
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM)
  const [bitacora, setBitacora] = useState<BitacoraNotificacion[]>([])
  const [status, setStatus] = useState<OpenWAEstado | null>(null)
  const [qr, setQr] = useState<OpenWAQR | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)

  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)

  const selectedConfig = configs.find((c) => c.id === selectedId) ?? null
  const sessionStatus = status?.session?.status ?? status?.status ?? ''
  const estadoInfo = ESTADOS[sessionStatus] ?? ESTADOS.unknown
  const isPolling = ['created', 'initializing', 'qr_ready', 'authenticating'].includes(sessionStatus)

  const notify = (type: Notice['type'], text: string) => {
    setNotice({ type, text })
    window.setTimeout(() => setNotice(null), 7000)
  }

  const loadBitacora = useCallback(async () => {
    setLoadingLog(true)
    try {
      const data = await getBitacora({ limit: 25 })
      setBitacora(data.bitacora ?? [])
    } catch (error: any) {
      notify('error', error.message || 'No se pudo cargar la bitácora')
    } finally {
      setLoadingLog(false)
    }
  }, [])

  const refreshStatus = useCallback(async (configId: string) => {
    try {
      const data = await getOpenWAEstado(configId)
      setStatus(data)

      if (data.exists && data.session?.status === 'qr_ready') {
        const qrData = await getOpenWAQr(configId)
        setQr(qrData.qrCode ? { qrCode: qrData.qrCode, status: qrData.status, message: qrData.message } : null)
      } else {
        setQr(null)
      }

      return data
    } catch (error: any) {
      const fallback: OpenWAEstado = {
        success: false,
        exists: false,
        status: 'unreachable',
        message: error?.message || 'No se pudo consultar OpenWA',
      }
      setStatus(fallback)
      setQr(null)
      return fallback
    }
  }, [])

  const reloadConfigs = useCallback(async (preferredId?: string) => {
    const list = await getWhatsAppConfigs()
    setConfigs(list)

    const target =
      list.find((c) => c.id === preferredId) ?? list.find((c) => c.activo) ?? list[0] ?? null

    if (target) {
      setSelectedId(target.id)
      setForm(formFromConfig(target))
    } else {
      setSelectedId('')
      setForm(EMPTY_FORM)
    }

    return target
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      try {
        const target = await reloadConfigs()
        if (!mounted) return
        if (target) await refreshStatus(target.id)
        await loadBitacora()
      } catch (error: any) {
        if (mounted) notify('error', error.message || 'No se pudo cargar la configuración')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [loadBitacora, refreshStatus, reloadConfigs])

  // Refresca estado y QR mientras la sesión está iniciando o esperando escaneo.
  useEffect(() => {
    if (!selectedId || !isPolling) return

    const timer = window.setInterval(() => {
      refreshStatus(selectedId).catch(() => undefined)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [isPolling, refreshStatus, selectedId])

  const updateForm = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSelectConfig = (id: string) => {
    setSelectedId(id)
    setStatus(null)
    setQr(null)
    const config = configs.find((c) => c.id === id)
    if (config) setForm(formFromConfig(config))
  }

  const handleSave = async () => {
    if (!selectedId && !form.api_key.trim()) {
      notify('error', 'Ingresa la API key de OpenWA para crear la configuración')
      return
    }

    setSaving(true)
    try {
      const payload: GuardarConfigPayload = {
        nombre_config: form.nombre_config,
        api_url: form.api_url,
        session_id: form.session_id,
        telefono_origen: form.telefono_origen,
        activo: form.activo,
        delay_ms: Number(form.delay_ms) || 0,
        country_code: form.country_code,
        ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
      }

      const saved = selectedId
        ? await actualizarWhatsAppConfig(selectedId, payload)
        : await crearWhatsAppConfig(payload)

      await reloadConfigs(saved.id)
      await refreshStatus(saved.id)
      notify('success', 'Configuración guardada correctamente')
    } catch (error: any) {
      notify('error', error.message || 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    if (!selectedId) return
    setRefreshing(true)
    try {
      const data = await refreshStatus(selectedId)
      if (data.success && data.exists) {
        notify(
          'success',
          `Estado de la sesión: ${ESTADOS[data.session?.status ?? '']?.label ?? data.session?.status}`,
        )
      } else {
        notify('error', data.message || 'No se pudo consultar OpenWA')
      }
    } catch (error: any) {
      notify('error', error.message || 'No se pudo consultar OpenWA')
    } finally {
      setRefreshing(false)
    }
  }

  const handleConnect = async () => {
    if (!selectedId) {
      notify('error', 'Guarda primero la configuración de OpenWA')
      return
    }

    setConnecting(true)
    try {
      const result = await conectarOpenWA(selectedId)
      if (result.session) {
        setStatus({
          success: true,
          exists: true,
          session: result.session,
          sessionId: result.sessionId,
        })
      }
      if (result.qr?.qrCode) {
        setQr(result.qr)
      } else if (result.session?.status === 'qr_ready') {
        const qrData = await getOpenWAQr(selectedId)
        setQr(qrData.qrCode ? { qrCode: qrData.qrCode, status: qrData.status, message: qrData.message } : null)
      } else {
        setQr(null)
      }
      notify('success', 'Sesión iniciada. Si aparece un QR, escanéalo desde WhatsApp.')
    } catch (error: any) {
      notify('error', error.message || 'No se pudo conectar con OpenWA')
    } finally {
      setConnecting(false)
    }
  }

  const handleStop = async () => {
    if (!selectedId) return
    setStopping(true)
    try {
      const result = await detenerOpenWA(selectedId)
      setStatus({
        success: true,
        exists: Boolean(result.session),
        session: result.session,
        sessionId: form.session_id,
      })
      setQr(null)
      notify('success', 'Sesión detenida')
    } catch (error: any) {
      notify('error', error.message || 'No se pudo detener la sesión')
    } finally {
      setStopping(false)
    }
  }

  const handleQr = async () => {
    if (!selectedId) return
    try {
      const qrData = await getOpenWAQr(selectedId)
      setQr(qrData.qrCode ? { qrCode: qrData.qrCode, status: qrData.status, message: qrData.message } : null)
      if (!qrData.qrCode) notify('info', qrData.message || 'El QR aún no está listo')
    } catch (error: any) {
      notify('error', error.message || 'No se pudo obtener el QR')
    }
  }

  const handleTestSend = async () => {
    if (!selectedId) {
      notify('error', 'Guarda primero la configuración de OpenWA')
      return
    }
    if (!testPhone.trim()) {
      notify('error', 'Ingresa un número de teléfono para la prueba')
      return
    }

    setSendingTest(true)
    try {
      const result = await probarWhatsApp({
        telefono_prueba: testPhone.trim(),
        mensaje_prueba: testMessage.trim() || undefined,
        config_id: selectedId,
      })
      notify('success', `Mensaje de prueba enviado. ID: ${result.message_id ?? '—'}`)
    } catch (error: any) {
      notify('error', error.message || 'No se pudo enviar el mensaje de prueba')
    } finally {
      setSendingTest(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const result = await reintentarFallidos(3)
      notify(
        result.fallidos > 0 ? 'info' : 'success',
        `Reintentos: ${result.enviados} enviados, ${result.fallidos} fallidos de ${result.procesados} procesados`,
      )
      await loadBitacora()
    } catch (error: any) {
      notify('error', error.message || 'No se pudieron reintentar los envíos')
    } finally {
      setRetrying(false)
    }
  }

  // Permite usar la plantilla de corte si el admin quiere probar un envío real.
  const handleSendCorteTest = async () => {
    if (!selectedId || !testPhone.trim()) {
      notify('error', 'Selecciona una configuración e ingresa un teléfono')
      return
    }

    setSendingTest(true)
    try {
      const result = await probarWhatsApp({
        telefono_prueba: testPhone.trim(),
        mensaje_prueba:
          '🍽️ *Comedor El Buen Sabor* - Corte Quincenal\n\n' +
          'Hola *Cliente de prueba*,\n\n' +
          'Te informamos tu estado de cuenta del ' +
          hoyManaguaISO() +
          ':\n\n' +
          '💰 *Total a pagar:* C$ 0.00\n\n' +
          'Este es un mensaje de prueba enviado desde el panel de administración.',
        config_id: selectedId,
      })
      notify('success', `Notificación de prueba enviada. ID: ${result.message_id ?? '—'}`)
      await loadBitacora()
    } catch (error: any) {
      notify('error', error.message || 'No se pudo enviar la notificación de prueba')
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando configuración de WhatsApp…</span>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 xl:col-span-2">
            <div className="surface space-y-5 rounded-2xl p-5 sm:p-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-52" />
                <SkeletonText lines={2} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[0, 1, 2, 3, 4, 5].map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className="h-2.5 w-20" />
                    <Skeleton className="h-11 rounded-xl" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 w-40 rounded-full" />
                <Skeleton className="h-10 w-36 rounded-full" />
              </div>
            </div>

            <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
              <Skeleton className="h-5 w-36" />
              <SkeletonText lines={2} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Skeleton className="h-2.5 w-28" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-44 rounded-full" />
                <Skeleton className="h-10 w-40 rounded-full" />
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
              <Skeleton className="h-5 w-40" />
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-32 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
            </div>

            <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mx-auto aspect-square w-full max-w-64 rounded-2xl" />
              <Skeleton className="mx-auto h-9 w-32 rounded-full" />
            </div>
          </div>
        </div>

        <div className="surface space-y-3 rounded-2xl p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-9 w-40 rounded-full" />
          </div>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const noticeStyles =
    notice?.type === 'error'
      ? 'border-ember-200 bg-ember-50 text-ember-700'
      : notice?.type === 'info'
        ? 'border-stone-200 bg-white text-stone-600'
        : 'border-leaf-200 bg-leaf-50 text-leaf-800'
  const NoticeIcon = notice?.type === 'error' ? AlertTriangle : notice?.type === 'info' ? Info : CheckCircle2

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Integración</p>
          <h1 className="text-stone-900">WhatsApp OpenWA</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Administra la sesión, el QR y las notificaciones del comedor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={estadoInfo.variant}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {estadoInfo.label}
          </Badge>
          {status?.session?.phone && (
            <span className="font-mono text-xs text-stone-500">{status.session.phone}</span>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${noticeStyles}`}
          role="status"
        >
          <NoticeIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        {/* Configuración + prueba */}
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <CardTitle>Conexión con OpenWA</CardTitle>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  URL del gateway, API key y nombre de la sesión. La API key se guarda en la tabla{' '}
                  <code className="rounded bg-stone-100 px-1 py-0.5 text-[10px] text-stone-600">
                    whatsapp_config
                  </code>{' '}
                  y solo la ven administradores.
                </p>
              </div>
              {configs.length > 1 && (
                <select
                  value={selectedId}
                  onChange={(e) => handleSelectConfig(e.target.value)}
                  aria-label="Seleccionar configuración"
                  className="h-10 w-full shrink-0 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-leaf-500 focus:outline-none focus:ring-4 focus:ring-leaf-500/15 sm:w-auto"
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_config}
                      {c.activo ? ' (activa)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="wa-nombre">Nombre</label>
                  <Input
                    id="wa-nombre"
                    value={form.nombre_config}
                    onChange={(e) => updateForm('nombre_config', e.target.value)}
                    placeholder="OpenWA Local"
                    leftIcon={<Smartphone className="h-4 w-4" />}
                  />
                </div>
                <div>
                  <label htmlFor="wa-sesion">Sesión</label>
                  <Input
                    id="wa-sesion"
                    value={form.session_id}
                    onChange={(e) => updateForm('session_id', e.target.value)}
                    placeholder="el-buen-sabor"
                    leftIcon={<Wifi className="h-4 w-4" />}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="wa-url">URL base</label>
                  <Input
                    id="wa-url"
                    value={form.api_url}
                    onChange={(e) => updateForm('api_url', e.target.value)}
                    placeholder="http://host.docker.internal:2785"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-stone-400">
                    Local: <code>http://host.docker.internal:2785</code>. Producción: URL HTTPS
                    pública del gateway.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="wa-key">API key de OpenWA</label>
                  <Input
                    id="wa-key"
                    type="password"
                    value={form.api_key}
                    onChange={(e) => updateForm('api_key', e.target.value)}
                    placeholder={
                      selectedConfig?.has_api_key
                        ? `Guardada (${selectedConfig.api_key}). Deja vacío para conservarla.`
                        : 'Pega aquí la API key de /app/data/.api-key'
                    }
                  />
                </div>
                <div>
                  <label htmlFor="wa-telefono">Teléfono origen</label>
                  <Input
                    id="wa-telefono"
                    value={form.telefono_origen}
                    onChange={(e) => updateForm('telefono_origen', e.target.value)}
                    placeholder="+505 8888 7777"
                  />
                </div>
                <div>
                  <label htmlFor="wa-pais">Código de país</label>
                  <Input
                    id="wa-pais"
                    value={form.country_code}
                    onChange={(e) => updateForm('country_code', e.target.value)}
                    placeholder="505"
                  />
                </div>
                <div>
                  <label htmlFor="wa-delay">Pausa entre envíos (ms)</label>
                  <Input
                    id="wa-delay"
                    type="number"
                    min={0}
                    max={10000}
                    value={form.delay_ms}
                    onChange={(e) => updateForm('delay_ms', Number(e.target.value))}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => updateForm('activo', e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 accent-leaf-600 focus:ring-leaf-500"
                  />
                  Configuración activa
                </label>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-stone-200/70 pt-4">
                <Button variant="leaf" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : selectedId ? 'Guardar cambios' : 'Crear configuración'}
                </Button>
                <Button variant="outline" onClick={handleRefresh} disabled={!selectedId || refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Probar conexión
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ember-50 text-ember-600">
                  <Send className="h-4 w-4" />
                </span>
                <CardTitle>Enviar prueba</CardTitle>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Envía un mensaje directo para verificar que la sesión está conectada. El teléfono se
                normaliza con el código de país configurado.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="wa-test-phone">Teléfono destino</label>
                  <Input
                    id="wa-test-phone"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="88887777"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="wa-test-message">
                    Mensaje <span className="font-normal text-stone-400">(opcional)</span>
                  </label>
                  <textarea
                    id="wa-test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={3}
                    placeholder="Mensaje de prueba desde el panel de administración"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-all placeholder:text-stone-400 hover:border-stone-400 focus:border-leaf-500 focus:outline-none focus:ring-4 focus:ring-leaf-500/15"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ember" onClick={handleTestSend} disabled={!selectedId || sendingTest}>
                  <Send className="h-4 w-4" />
                  {sendingTest ? 'Enviando...' : 'Enviar mensaje de prueba'}
                </Button>
                <Button variant="outline" onClick={handleSendCorteTest} disabled={!selectedId || sendingTest}>
                  <Send className="h-4 w-4" />
                  Enviar corte de prueba
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estado + QR */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado de la sesión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                  Estado
                </span>
                <Badge variant={estadoInfo.variant}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {estadoInfo.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                  Sesión
                </span>
                <span className="truncate font-mono text-sm text-stone-800">
                  {form.session_id || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                  Teléfono
                </span>
                <span className="truncate text-sm text-stone-800">{status?.session?.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                  Nombre
                </span>
                <span className="truncate text-sm text-stone-800">
                  {status?.session?.pushName || '—'}
                </span>
              </div>
              {status?.baseUrl && (
                <div className="break-all rounded-xl bg-stone-50 px-3 py-2 text-[10px] text-stone-500">
                  {status.baseUrl}
                </div>
              )}
              {status?.message && (
                <div className="flex items-start gap-2 rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 text-[11px] text-ember-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{status.message}</span>
                </div>
              )}
              {status?.session?.lastError && (
                <div className="flex items-start gap-2 rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 text-[11px] text-ember-700">
                  <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{status.session.lastError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="leaf" size="sm" onClick={handleConnect} disabled={!selectedId || connecting}>
                  <Wifi className="h-4 w-4" />
                  {connecting ? 'Conectando...' : 'Conectar / Iniciar'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleStop} disabled={!selectedId || stopping}>
                  <WifiOff className="h-4 w-4" />
                  {stopping ? 'Deteniendo...' : 'Detener'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Código QR</CardTitle>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                WhatsApp → Dispositivos vinculados → Vincular dispositivo. El QR se actualiza
                automáticamente mientras la sesión lo necesite.
              </p>
            </CardHeader>
            <CardContent>
              {qr?.qrCode ? (
                <img
                  src={qr.qrCode}
                  alt="Código QR de WhatsApp"
                  className="mx-auto aspect-square w-full max-w-64 rounded-2xl border border-stone-200 bg-white object-contain p-2"
                />
              ) : (
                <div className="mx-auto flex aspect-square w-full max-w-64 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 text-center">
                  <QrCode className="mb-2 h-10 w-10 text-stone-300" />
                  <p className="text-xs leading-relaxed text-stone-500">
                    {sessionStatus === 'ready'
                      ? 'La sesión ya está conectada. No se necesita QR.'
                      : 'El QR aparecerá cuando la sesión esté iniciando.'}
                  </p>
                </div>
              )}
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={handleQr} disabled={!selectedId}>
                  <RefreshCw className="h-4 w-4" /> Actualizar QR
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bitácora */}
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Bitácora de notificaciones</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">Últimos 25 envíos registrados en Supabase.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadBitacora} disabled={loadingLog}>
              <RefreshCw className={`h-4 w-4 ${loadingLog ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant="ember" size="sm" onClick={handleRetry} disabled={retrying}>
              <RotateCcw className="h-4 w-4" />
              {retrying ? 'Reintentando...' : 'Reintentar fallidos'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLog ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-leaf-200 border-b-leaf-600" />
            </div>
          ) : bitacora.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-stone-300" />
              <p className="text-sm text-stone-500">Todavía no hay notificaciones registradas.</p>
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="space-y-3 md:hidden">
                {bitacora.map((row) => (
                  <div key={row.id} className="space-y-2 rounded-2xl border border-stone-200/80 bg-white/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {row.perfiles?.nombre ?? '—'}
                        </p>
                        <p className="text-[11px] text-stone-400">{formatDate(row.created_at)}</p>
                      </div>
                      <Badge variant={row.enviado_exitosamente ? 'success' : 'error'}>
                        {row.enviado_exitosamente ? 'Enviado' : 'Fallido'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                          Plantilla
                        </p>
                        <p className="truncate text-stone-600">
                          {row.whatsapp_plantillas?.nombre ?? row.tipo_notificacion ?? '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                          Teléfono
                        </p>
                        <p className="truncate font-mono text-stone-600">
                          {row.telefono_destino?.replace(/@c\.us$/, '') ??
                            row.perfiles?.telefono_whatsapp ??
                            '—'}
                        </p>
                      </div>
                    </div>
                    {(row.message_id || row.error_mensaje) && (
                      <p className="break-all rounded-lg bg-stone-50 px-2.5 py-1.5 text-[11px] text-stone-500">
                        {row.message_id ?? row.error_mensaje}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Vista de escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60">
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Fecha
                      </th>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Cliente
                      </th>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Plantilla
                      </th>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Teléfono
                      </th>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Estado
                      </th>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Detalle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bitacora.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-stone-100 transition-colors last:border-0 hover:bg-leaf-50/40"
                      >
                        <td className="whitespace-nowrap px-3 py-3.5 text-xs text-stone-500">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-3.5 text-sm font-medium text-stone-900">
                          {row.perfiles?.nombre ?? '—'}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-stone-600">
                          {row.whatsapp_plantillas?.nombre ?? row.tipo_notificacion ?? '—'}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-stone-600">
                          {row.telefono_destino?.replace(/@c\.us$/, '') ??
                            row.perfiles?.telefono_whatsapp ??
                            '—'}
                        </td>
                        <td className="px-3 py-3.5">
                          <Badge variant={row.enviado_exitosamente ? 'success' : 'error'}>
                            {row.enviado_exitosamente ? 'Enviado' : 'Fallido'}
                          </Badge>
                        </td>
                        <td
                          className="max-w-[280px] truncate px-3 py-3.5 text-[11px] text-stone-500"
                          title={row.message_id ?? row.error_mensaje ?? ''}
                        >
                          {row.message_id ?? row.error_mensaje ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
