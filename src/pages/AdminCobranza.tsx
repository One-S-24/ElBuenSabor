import { useState, useEffect, useCallback } from 'react'
import {
  ejecutarCorteQuincenal,
  obtenerMorososParaNotificar,
  getPedidosQuincena,
  registrarPagoCuenta,
  enviarNotificacionWhatsApp,
  getPlantillas,
} from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { quincenaActualManagua } from '../lib/date'
import { enviarMasivoWhatsApp } from '../services/whatsappService'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Send,
  Users,
  Wallet,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'
import Badge from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { cn } from '../lib/utils'

const quincenaActual = () => quincenaActualManagua()

export default function AdminCobranza() {
  const [fechaInicio, setFechaInicio] = useState(quincenaActual().inicio)
  const [fechaFin, setFechaFin] = useState(quincenaActual().fin)

  const [morosos, setMorosos] = useState<any[]>([])
  const [pedidosQuincena, setPedidosQuincena] = useState<any[]>([])
  const [resumen, setResumen] = useState<any>(null)
  const [plantillaCorteId, setPlantillaCorteId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [ejecutando, setEjecutando] = useState(false)
  const [enviandoTodos, setEnviandoTodos] = useState(false)
  const [notificarAlCorte, setNotificarAlCorte] = useState(true)
  const [ultimoEnvio, setUltimoEnvio] = useState<any>(null)

  const [abonoOpen, setAbonoOpen] = useState(false)
  const [abonoCuentaId, setAbonoCuentaId] = useState('')
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState('EFECTIVO')
  const [abonoReferencia, setAbonoReferencia] = useState('')

  const btnCorteContent = ejecutando ? (
    <>
      <Clock className="h-4 w-4 animate-spin" />
      Ejecutando corte...
    </>
  ) : (
    <>
      <Clock className="h-4 w-4" />
      Ejecutar corte
    </>
  )

  const cargarPeriodo = async () => {
    setLoading(true)
    try {
      const [morososRes, pedidosRes, plantillasRes] = await Promise.all([
        obtenerMorososParaNotificar(fechaInicio, fechaFin),
        getPedidosQuincena(fechaInicio, fechaFin),
        getPlantillas(),
      ])
      setMorosos(Array.isArray(morososRes?.morosos) ? morososRes.morosos : [])
      setPedidosQuincena(Array.isArray(pedidosRes) ? pedidosRes : [])
      if (plantillasRes?.length) {
        const corte = plantillasRes.find((p: any) => p.tipo === 'corte_quincenal')
        setPlantillaCorteId(corte ? corte.id : null)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarPeriodo()
  }, [fechaInicio, fechaFin])

  const platosPorCliente = useCallback(
    (clienteId: string) => {
      return pedidosQuincena
        .filter((p) => p.cliente_id === clienteId)
        .reduce(
          (s, p) => s + (p.detalle_pedidos?.reduce((acc: number, d: any) => acc + d.cantidad, 0) ?? 0),
          0,
        )
    },
    [pedidosQuincena],
  )

  const enviarNotificacionesCorte = async () => {
    if (!plantillaCorteId) return null
    // El envío masivo se hace en el servidor con pausas entre mensajes
    // para respetar el ritmo de OpenWA y reducir el riesgo de bloqueo.
    const res = await enviarMasivoWhatsApp({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      plantilla_id: plantillaCorteId,
      solo_morosos: true,
    })
    setUltimoEnvio(res)
    return res
  }

  const ejecutarCorte = async () => {
    setEjecutando(true)
    try {
      const res = await ejecutarCorteQuincenal(fechaInicio, fechaFin)
      if (res.success) {
        setResumen(res.resumen)
        await cargarPeriodo()

        // Flujo UWE 3.B: el corte despacha las notificaciones y la Edge
        // Function registra cada resultado en la bitácora.
        if (notificarAlCorte) {
          if (!plantillaCorteId) {
            alert('Corte ejecutado. No hay plantilla de WhatsApp configurada; no se enviaron notificaciones.')
          } else {
            setEnviandoTodos(true)
            try {
              const envio = await enviarNotificacionesCorte()
              if (envio) {
                alert(
                  `Corte ejecutado. Notificaciones: ${envio.exitosos} enviadas, ${envio.fallidos} fallidas` +
                    (envio.omitidos > 0 ? `, ${envio.omitidos} omitidas (límite por lote)` : ''),
                )
              }
            } catch (err: any) {
              alert(`Corte ejecutado, pero falló el envío por WhatsApp: ${err.message || 'error desconocido'}`)
            } finally {
              setEnviandoTodos(false)
            }
          }
        }
      } else {
        alert(res.error || 'No se pudo ejecutar el corte')
      }
    } catch (err: any) {
      alert(err.message || 'Error ejecutando el corte')
    } finally {
      setEjecutando(false)
    }
  }

  const enviarWA = async (cliente: any) => {
    if (!plantillaCorteId) {
      alert('No hay plantilla de WhatsApp configurada')
      return
    }
    try {
      const res = await enviarNotificacionWhatsApp(cliente.cliente_id, plantillaCorteId, {
        nombre: cliente.nombre,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        monto: cliente.total_deuda,
      })
      if (res.success) {
        alert('Notificación enviada por WhatsApp')
      } else {
        alert(res.error || 'No se pudo enviar')
      }
    } catch (err: any) {
      alert(err.message || 'Error al enviar')
    }
  }

  const enviarATodos = async () => {
    if (morosos.length === 0) return
    if (!plantillaCorteId) {
      alert('No hay plantilla de WhatsApp configurada')
      return
    }
    if (!confirm(`¿Enviar notificación a ${morosos.length} cliente(s) pendiente(s)?`)) return
    setEnviandoTodos(true)
    try {
      const res = await enviarNotificacionesCorte()
      if (res) {
        alert(
          `Notificaciones: ${res.exitosos} enviadas, ${res.fallidos} fallidas` +
            (res.omitidos > 0 ? `, ${res.omitidos} omitidas (límite por lote)` : ''),
        )
      }
    } catch (err: any) {
      alert(err.message || 'Error al enviar las notificaciones')
    } finally {
      setEnviandoTodos(false)
    }
  }

  const abrirAbono = (cuentaId: string) => {
    setAbonoCuentaId(cuentaId)
    setAbonoMonto('')
    setAbonoReferencia('')
    setAbonoOpen(true)
  }

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) {
      alert('Ingresa un monto válido')
      return
    }
    try {
      const res = await registrarPagoCuenta(abonoCuentaId, monto, abonoMetodo, abonoReferencia)
      if (res.success) {
        setAbonoOpen(false)
        await cargarPeriodo()
        alert('Abono registrado correctamente')
      } else {
        alert(res.error || 'No se pudo registrar el abono')
      }
    } catch (err: any) {
      alert(err.message || 'Error al registrar el abono')
    }
  }

  const deudaTotal = morosos.reduce((s, c) => s + (c.total_deuda ?? 0), 0)

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="text-stone-900">Corte quincenal</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Cierra el período, revisa deudas pendientes y registra abonos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600">
            <Users className="h-3.5 w-3.5 text-ember-600" />
            {morosos.length} pendiente(s)
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-ember-200 bg-ember-50 px-3 py-1.5 text-xs font-bold text-ember-700">
            {formatCurrency(deudaTotal)}
          </span>
        </div>
      </div>

      {/* Período */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Período de corte</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">
              Selecciona el rango de fechas y ejecuta el cierre quincenal.
            </p>
          </div>
          <Badge variant="info" className="mt-0.5 hidden shrink-0 sm:inline-flex">
            Quincena
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
            <div>
              <label htmlFor="corte-desde">Desde</label>
              <Input
                id="corte-desde"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="corte-hasta">Hasta</label>
              <Input
                id="corte-hasta"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={cargarPeriodo}
              isLoading={loading}
              loadingText="Cargando período"
              className="w-full sm:w-auto"
            >
              {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin me-2" />
                    Cargando período
                  </>
                ) : (
                  'Cargar período'
                )}
            </Button>
            <Button
              variant="leaf"
              onClick={ejecutarCorte}
              className="w-full sm:w-auto"
            >
              {btnCorteContent}
            </Button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={notificarAlCorte}
              onChange={(e) => setNotificarAlCorte(e.target.checked)}
              disabled={ejecutando}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-leaf-600"
            />
            <span className="min-w-0 leading-relaxed">
              Enviar las notificaciones de WhatsApp automáticamente al ejecutar el corte
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Resumen del corte */}
      {resumen && (
        <Card className="overflow-hidden border-leaf-200 bg-leaf-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-leaf-700" />
              <p className="text-sm font-semibold text-leaf-900">Corte ejecutado</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  Cuentas procesadas
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-stone-900">
                  {resumen.cuentas_procesadas}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  Total a cobrar
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-leaf-700">
                  {formatCurrency(resumen.total_cobrar)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ember-600">
                  Morosos
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-ember-700">{resumen.morosos}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-leaf-600">
                  Al día
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-leaf-700">{resumen.al_dia}</p>
              </div>
            </div>
            {ultimoEnvio && (
              <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-[11px] text-stone-600">
                Último envío: {ultimoEnvio.exitosos} enviadas, {ultimoEnvio.fallidos} fallidas
                {ultimoEnvio.omitidos > 0 ? `, ${ultimoEnvio.omitidos} omitidas` : ''}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clientes pendientes */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-ember-600" />
              <CardTitle>Clientes con deuda pendiente</CardTitle>
            </div>
            <p className="mt-1.5 text-sm text-stone-500">
              Envía un recordatorio o registra un abono directamente.
            </p>
          </div>
          <Badge variant="default" className="mt-0.5 shrink-0">
            {morosos.length} cliente(s)
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <span className="sr-only">Cargando clientes con deuda…</span>
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3.5 sm:p-4"
                >
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                  <div className="shrink-0 space-y-2">
                    <Skeleton className="ml-auto h-2.5 w-14" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : morosos.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-300 shadow-sm">
                <Bell className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-stone-600">
                No hay clientes con deuda pendiente en este período.
              </p>
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="space-y-3 md:hidden">
                {morosos.map((c) => (
                  <div
                    key={c.cuenta_id}
                    className="space-y-3 rounded-2xl border border-stone-200/80 bg-white/60 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-50 font-serif text-sm font-bold text-ember-700">
                        {(c.nombre ?? '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{c.nombre}</p>
                        <p className="text-[11px] text-stone-400">
                          {platosPorCliente(c.cliente_id)} almuerzo(s)
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                          Deuda
                        </p>
                        <p className="font-serif text-lg font-bold text-stone-900">
                          {formatCurrency(c.total_deuda)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => enviarWA(c)}
                        isLoading={enviandoTodos}
                          loadingText="Enviando..."
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar WA
                      </Button>
                      <Button variant="leaf" size="sm" className="flex-1" onClick={() => abrirAbono(c.cuenta_id)}>
                        <Wallet className="h-3.5 w-3.5" /> Abono
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista de escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60">
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Platos consumidos
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Total deuda
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {morosos.map((c) => (
                      <tr
                        key={c.cuenta_id}
                        className="border-b border-stone-100 transition-colors last:border-0 hover:bg-leaf-50/40"
                      >
                        <td className="px-4 py-3.5 text-sm font-semibold text-stone-900">{c.nombre}</td>
                        <td className="px-4 py-3.5 text-sm text-stone-500">
                          {platosPorCliente(c.cliente_id)} almuerzo(s)
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-stone-900">
                          {formatCurrency(c.total_deuda)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-2">
                            <Button className="cursor-pointer" variant="outline" size="sm" onClick={() => enviarWA(c)} isLoading={enviandoTodos}
                          loadingText="Enviando...">
                              <Send className="h-3.5 w-3.5" /> Enviar WA
                            </Button>
                            <Button className="cursor-pointer" variant="leaf" size="sm" onClick={() => abrirAbono(c.cuenta_id)}>
                              <Wallet className="h-3.5 w-3.5" /> Abono
                            </Button>
                          </div>
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

      {/* Acción masiva */}
      <Button
        variant="ember"
        size="lg"
        className="w-full sm:w-auto sm:min-w-[20rem]"
        disabled={enviandoTodos || morosos.length === 0}
        onClick={enviarATodos}
      >
        {enviandoTodos ? (
          <>
            <Clock className="h-4 w-4 animate-spin" /> Enviando a todos...
          </>
        ) : (
          <>
            <Bell className="h-5 w-5 shrink-0" />
            Notificar a todos los pendientes
          </>
        )}
      </Button>

      {/* Modal abono */}
      {abonoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
          onClick={() => setAbonoOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[90svh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="abono-title"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
                  <Wallet className="h-4 w-4" />
                </span>
                <h2 id="abono-title" className="font-serif text-lg font-bold text-stone-900">
                  Registrar abono
                </h2>
              </div>
              <button
                onClick={() => setAbonoOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                registrarAbono()
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="abono-monto">Monto del abono</label>
                <Input
                  id="abono-monto"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={abonoMonto}
                  onChange={(e) => setAbonoMonto(e.target.value)}
                />
              </div>

              <div>
                <label>Método de pago</label>
                <div className="flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
                  {[
                    { value: 'EFECTIVO', label: 'Efectivo' },
                    { value: 'TRANSFERENCIA', label: 'Transferencia' },
                  ].map((metodo) => (
                    <button
                      key={metodo.value}
                      type="button"
                      onClick={() => setAbonoMetodo(metodo.value)}
                      aria-pressed={abonoMetodo === metodo.value}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        abonoMetodo === metodo.value
                          ? 'bg-leaf-700 text-white'
                          : 'text-stone-500 hover:bg-stone-100',
                      )}
                    >
                      {metodo.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="abono-referencia">
                  Referencia <span className="font-normal text-stone-400">(opcional)</span>
                </label>
                <Input
                  id="abono-referencia"
                  placeholder="Ej. Transferencia #123"
                  value={abonoReferencia}
                  onChange={(e) => setAbonoReferencia(e.target.value)}
                />
              </div>

              <Button variant="leaf" type="submit" size="lg" className="w-full">
                <CheckCircle2 className="h-4 w-4" /> Confirmar abono
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
