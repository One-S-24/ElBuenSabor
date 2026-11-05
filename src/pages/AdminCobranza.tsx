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
import { FileText, Send, Wallet, AlertTriangle, Bell, X, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'

function cnModal(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const quincenaActual = () => {
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = hoy.getMonth()
  let inicio: Date, fin: Date
  if (hoy.getDate() <= 15) {
    inicio = new Date(año, mes, 1)
    fin = new Date(año, mes, 15)
  } else {
    inicio = new Date(año, mes, 16)
    fin = new Date(año, mes + 1, 0)
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: fmt(inicio), fin: fmt(fin) }
}

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

  const [abonoOpen, setAbonoOpen] = useState(false)
  const [abonoCuentaId, setAbonoCuentaId] = useState('')
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState('EFECTIVO')
  const [abonoReferencia, setAbonoReferencia] = useState('')

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

  const ejecutarCorte = async () => {
    setEjecutando(true)
    try {
      const res = await ejecutarCorteQuincenal(fechaInicio, fechaFin)
      if (res.success) {
        setResumen(res.resumen)
        await cargarPeriodo()
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
    if (!confirm(`¿Enviar notificación a ${morosos.length} cliente(s) pendiente(s)?`)) return
    setEnviandoTodos(true)
    let ok = 0, fail = 0
    for (const c of morosos) {
      try {
        const res = await enviarNotificacionWhatsApp(
          c.cliente_id,
          plantillaCorteId!,
          { nombre: c.nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, monto: c.total_deuda }
        )
        if (res.success) ok++
        else fail++
      } catch {
        fail++
      }
    }
    setEnviandoTodos(false)
    alert(`Notificaciones: ${ok} enviadas, ${fail} fallidas`)
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-700" />
          <h2 className="text-2xl font-bold text-stone-900">Corte quincenal</h2>
        </div>
      </div>

      {/* Período */}
      <Card>
        <CardHeader>
          <CardTitle>Período de corte</CardTitle>
          <p className="text-[11px] text-stone-500 mt-1">Selecciona el rango de fechas para el corte quincenal.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider">Desde</label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider">Hasta</label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cargarPeriodo} disabled={loading}>
              Cargar
            </Button>
            <Button variant="brand" onClick={ejecutarCorte} disabled={ejecutando} className="flex-1">
              {btnCorteContent}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen del corte */}
      {resumen && (
        <Card className="border-brand-100 bg-gradient-to-r from-brand-50 to-brand-100 shadow-sm shadow-brand/10">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Cuentas procesadas</div>
                <div className="text-2xl font-bold text-stone-900">{resumen.cuentas_procesadas}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Total a cobrar</div>
                <div className="text-2xl font-bold text-brand-700">{formatCurrency(resumen.total_cobrar)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Morosos</div>
                <div className="text-2xl font-bold text-amber-700">{resumen.morosos}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Al día</div>
                <div className="text-2xl font-bold text-emerald-700">{resumen.al_dia}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clientes pendientes */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <CardTitle>Clientes con deuda pendiente</CardTitle>
          </div>
          <span className="text-[11px] text-stone-400 font-semibold uppercase">{morosos.length} cliente(s)</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : morosos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 text-stone-300">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-stone-500 text-sm">No hay clientes con deuda pendiente en este período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="px-4 py-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Platos consumidos</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider text-right">Total deuda</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {morosos.map((c) => (
                    <tr key={c.cuenta_id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-stone-900 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-sm text-stone-600">
                        {platosPorCliente(c.cliente_id)} almuerzo(s)
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">
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
                            <Send className="w-3 h-3 mr-1" /> Enviar WA
                          </Button>
                          <Button variant="brand" size="sm" onClick={() => abrirAbono(c.cuenta_id)}>
                            <Wallet className="w-3 h-3 mr-1" /> Abono
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acción masiva */}
      <div className="flex justify-center">
        <Button
          variant="destructive"
          className="px-8 py-4 text-lg font-bold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50"
          disabled={enviandoTodos || morosos.length === 0}
          onClick={enviarATodos}
        >
          {enviandoTodos ? 'Enviando a todos...' : (
            <>
              <Bell className="w-5 h-5 mr-2" />
              ENVIAR NOTIFICACIÓN A TODOS LOS PENDIENTES
            </>
          )}
        </Button>
      </div>

      {/* Modal abono */}
      <div
        className={cnModal('fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center', abonoOpen ? undefined : 'hidden')}
        onClick={() => setAbonoOpen(false)}
      >
        <div
          className={cnModal('bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl', '')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-stone-900">Registrar abono</h3>
            <button
              onClick={() => setAbonoOpen(false)}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); registrarAbono() }} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                Monto del abono
              </label>
              <Input type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                Método
              </label>
              <select
                value={abonoMetodo}
                onChange={(e) => setAbonoMetodo(e.target.value)}
                className="h-11 rounded-2xl border border-stone-200 bg-white px-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                Referencia
              </label>
              <Input placeholder="Ej. Transferencia #123" value={abonoReferencia} onChange={(e) => setAbonoReferencia(e.target.value)} />
            </div>
            <Button variant="brand" type="submit" className="w-full">
              Confirmar abono
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

