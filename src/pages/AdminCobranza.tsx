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
import { FileText, Send, Wallet, AlertTriangle, Bell, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'

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

  // Modal abono
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

  // Contador de platos consumidos por cliente en el período
  const platosPorCliente = useCallback(
    (clienteId: string) => {
      return pedidosQuincena
        .filter((p) => p.cliente_id === clienteId)
        .reduce((s, p) => s + (p.detalle_pedidos?.reduce((acc: number, d: any) => acc + d.cantidad, 0) ?? 0), 0)
    },
    [pedidosQuincena]
  )

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-700" />
          <h2 className="text-xl font-bold text-stone-800">Corte quincenal</h2>
        </div>
      </div>

      {/* Período */}
      <Card>
        <CardHeader>
          <CardTitle>Período de corte</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-600 uppercase">Desde</label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-600 uppercase">Hasta</label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={cargarPeriodo} disabled={loading}>
            Cargar
          </Button>
          <Button variant="brand" onClick={ejecutarCorte} disabled={ejecutando} className="col-span-1 sm:col-span-1 md:col-span-2">
            {ejecutando ? 'Ejecutando corte...' : 'Ejecutar corte quincenal'}
          </Button>
        </CardContent>
      </Card>

      {/* Resumen del corte */}
      {resumen && (
        <Card className="border-brand-100 bg-brand-50/50">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-stone-500 uppercase">Cuentas procesadas</div>
                <div className="text-2xl font-bold text-stone-800">{resumen.cuentas_procesadas}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500 uppercase">Total a cobrar</div>
                <div className="text-2xl font-bold text-brand-700">{formatCurrency(resumen.total_cobrar)}</div>
              </div>
              <div>
                <div className="text-xs text-amber-600 uppercase">Morosos</div>
                <div className="text-2xl font-bold text-amber-700">{resumen.morosos}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-600 uppercase">Al día</div>
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
          <span className="text-xs text-stone-500">{morosos.length} cliente(s)</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : morosos.length === 0 ? (
            <p className="text-center text-stone-500 py-8">
              <Bell className="w-10 h-10 mx-auto text-stone-300 mb-3" />
              No hay clientes con deuda pendiente en este período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Platos consumidos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-right">Total deuda</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {morosos.map((c) => (
                    <tr key={c.cuenta_id} className="border-b border-stone-100">
                      <td className="px-4 py-3 text-sm text-stone-800 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-sm text-stone-600">
                        {platosPorCliente(c.cliente_id)} almuerzo(s)
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-stone-800 text-right">
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
          className="px-8 py-3 text-lg font-bold shadow-md"
          disabled={enviandoTodos || morosos.length === 0}
          onClick={enviarATodos}
        >
          {enviandoTodos ? 'Enviando a todos...' : (
            <>
              <Bell className="w-5 h-5 mr-2" /> ENVIAR NOTIFICACIÓN A TODOS LOS PENDIENTES
            </>
          )}
        </Button>
      </div>

      {/* Modal abono */}
      <div
        className={cnModal(
          'fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center',
          abonoOpen ? undefined : 'hidden'
        )}
        onClick={() => setAbonoOpen(false)}
      >
        <div
          className={cnModal('bg-white rounded-2xl p-6 w-full max-w-md shadow-xl', '')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-800">Registrar abono</h3>
            <button
              onClick={() => setAbonoOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); registrarAbono() }} className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-600 uppercase">Monto del abono</label>
              <Input type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-600 uppercase">Método</label>
              <select
                value={abonoMetodo}
                onChange={(e) => setAbonoMetodo(e.target.value)}
                className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-600 uppercase">Referencia</label>
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

function cnModal(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
