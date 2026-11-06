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
import { FileText, Send, Wallet, AlertTriangle, Bell, X, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'

function cnModal(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const quincenaActual = () => quincenaActualManagua()

export default function AdminCobranza() {
  const [fechaInicio, setFechaInicio] = useState(quincenaActual().inicio)
  const [fechaFin, setFechaFin] = useState(quincenaActual().fin)

  const [morosos, setMorosos] = useState<any[]>([])
  const [pedidosQuincena, setPedidosQuincena] = useState<any[]>([])
  const [resumen, setResumen] = useState<any>(null)
  const [plantillaCorteId, setPlantillaCorteId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
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
      <Clock className="w-4 h-4 animate-spin mr-2" />
      Ejecutando corte...
    </>
  ) : (
    <>
      <Clock className="w-4 h-4 mr-2" />
      Ejecutar corte quincenal
    </>
  );

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
        .reduce((s, p) => s + (p.detalle_pedidos?.reduce((acc: number, d: any) => acc + d.cantidad, 0) ?? 0), 0)
    },
    [pedidosQuincena]
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
                  (envio.omitidos > 0 ? `, ${envio.omitidos} omitidas (límite por lote)` : '')
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
      const res = await enviarNotificacionWhatsApp(
        cliente.cliente_id,
        plantillaCorteId,
        { nombre: cliente.nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, monto: cliente.total_deuda }
      )
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
          (res.omitidos > 0 ? `, ${res.omitidos} omitidas (límite por lote)` : '')
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-leaf-700" />
          <h2 className="min-w-0 truncate text-leaf-900 font-serif">Corte quincenal</h2>
        </div>
      </div>

      {/* Período */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="text-leaf-900 font-serif">Período de corte</CardTitle>
          <p className="text-[11px] text-stone-500 mt-1">Selecciona el rango de fechas para el corte quincenal.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold tracking-wider text-stone-600">Desde</label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold tracking-wider text-stone-600">Hasta</label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-1">
            <Button variant="outline" size="sm" onClick={cargarPeriodo} disabled={loading} className="sm:w-auto">
              Cargar
            </Button>
            <Button variant="leaf" onClick={ejecutarCorte} disabled={ejecutando} className="flex-1">
              {btnCorteContent}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-stone-600 sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              checked={notificarAlCorte}
              onChange={(e) => setNotificarAlCorte(e.target.checked)}
              disabled={ejecutando}
              className="h-4 w-4 rounded border-stone-300 accent-leaf-600"
            />
            Enviar las notificaciones de WhatsApp automáticamente al ejecutar el corte
          </label>
        </CardContent>
      </Card>

      {/* Resumen del corte */}
      {resumen && (
        <Card variant="raised" className="border-leaf-100 bg-leaf-50/40 shadow-sm shadow-leaf-500/10">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-4 text-center sm:gap-6 lg:grid-cols-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Cuentas procesadas</div>
                <div className="font-serif text-xl font-bold text-stone-900 sm:text-2xl">{resumen.cuentas_procesadas}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Total a cobrar</div>
                <div className="font-serif text-xl font-bold text-leaf-700 sm:text-2xl">{formatCurrency(resumen.total_cobrar)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Morosos</div>
                <div className="font-serif text-xl font-bold text-amber-700 sm:text-2xl">{resumen.morosos}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-leaf-600">Al día</div>
                <div className="font-serif text-xl font-bold text-leaf-700 sm:text-2xl">{resumen.al_dia}</div>
              </div>
            </div>
            {ultimoEnvio && (
              <p className="mt-4 text-center text-[11px] text-stone-600">
                Último envío: {ultimoEnvio.exitosos} enviadas, {ultimoEnvio.fallidos} fallidas
                {ultimoEnvio.omitidos > 0 ? `, ${ultimoEnvio.omitidos} omitidas` : ''}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clientes pendientes */}
      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <CardTitle className="min-w-0 truncate text-leaf-900 font-serif">Clientes con deuda pendiente</CardTitle>
          </div>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{morosos.length} cliente(s)</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-leaf-600"></div>
            </div>
          ) : morosos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 text-stone-300">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-stone-500 text-sm">No hay clientes con deuda pendiente en este período.</p>
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="space-y-3 md:hidden">
                {morosos.map((c) => (
                  <div key={c.cuenta_id} className="space-y-3 rounded-lg border border-stone-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-900">{c.nombre}</p>
                        <p className="text-xs text-stone-500">{platosPorCliente(c.cliente_id)} almuerzo(s)</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Deuda</p>
                        <p className="font-bold text-stone-900">{formatCurrency(c.total_deuda)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => enviarWA(c)}
                        disabled={enviandoTodos}
                      >
                        <Send className="mr-1 h-3 w-3" /> Enviar WA
                      </Button>
                      <Button variant="leaf" size="sm" className="flex-1" onClick={() => abrirAbono(c.cuenta_id)}>
                        <Wallet className="mr-1 h-3 w-3" /> Abono
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista de escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Nombre</th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Platos consumidos</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-stone-500">Total deuda</th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {morosos.map((c) => (
                      <tr key={c.cuenta_id} className="border-b border-stone-50 transition-colors hover:bg-stone-50">
                        <td className="px-4 py-3 text-sm font-medium text-stone-900">{c.nombre}</td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {platosPorCliente(c.cliente_id)} almuerzo(s)
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-stone-900">
                          {formatCurrency(c.total_deuda)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => enviarWA(c)}
                              disabled={enviandoTodos}
                            >
                              <Send className="mr-1 h-3 w-3" /> Enviar WA
                            </Button>
                            <Button variant="leaf" size="sm" onClick={() => abrirAbono(c.cuenta_id)}>
                              <Wallet className="mr-1 h-3 w-3" /> Abono
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
      <div className="flex justify-center">
        <Button
          variant="ember"
          className="w-full px-4 py-3 text-base font-bold shadow-lg shadow-ember-500/30 hover:shadow-ember-500/50 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
          disabled={enviandoTodos || morosos.length === 0}
          onClick={enviarATodos}
        >
          {enviandoTodos ? 'Enviando a todos...' : (
            <>
              <Bell className="mr-2 h-5 w-5 shrink-0" />
              Enviar notificación a todos los pendientes
            </>
          )}
        </Button>
      </div>

      {/* Modal abono */}
      <div
        className={cnModal('fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 p-4 backdrop-blur-sm', abonoOpen ? undefined : 'hidden')}
        onClick={() => setAbonoOpen(false)}
      >
        <div
          className={cnModal('max-h-[90svh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-2xl sm:p-6', '')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-stone-900 font-serif">Registrar abono</h3>
            <button
              onClick={() => setAbonoOpen(false)}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); registrarAbono() }} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 tracking-wider">Monto del abono</label>
              <Input type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 tracking-wider">Método</label>
              <select
                value={abonoMetodo}
                onChange={(e) => setAbonoMetodo(e.target.value)}
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-leaf-500 text-sm"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 tracking-wider">Referencia</label>
              <Input placeholder="Ej. Transferencia #123" value={abonoReferencia} onChange={(e) => setAbonoReferencia(e.target.value)} />
            </div>
            <Button variant="leaf" type="submit" className="w-full">
              Confirmar abono
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
