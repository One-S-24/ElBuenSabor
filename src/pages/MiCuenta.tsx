import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getCuentaActual, getHistorialCuentas } from '../services/accountService'
import { getPedidosEnRango } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { FileText, History, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Badge from '../components/ui/badge'

const estadoBadge: Record<string, string> = {
  AL_DIA: 'success',
  PENDIENTE_PAGO: 'warning',
  MOROSO: 'error',
}

const estadoTexto: Record<string, string> = {
  AL_DIA: 'Al día',
  PENDIENTE_PAGO: 'Pendiente de pago',
  MOROSO: 'Moroso',
}

export default function MiCuenta() {
  const { profile } = useAuthStore()
  const clienteId = profile?.id
  const [cuenta, setCuenta] = useState<any>(null)
  const [detalle, setDetalle] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
    const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null)
    const [periodoDetalle, setPeriodoDetalle] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      if (!clienteId) return
      try {
        setLoading(true)
        const [ctaRes, histRes] = await Promise.all([
          getCuentaActual(clienteId),
          getHistorialCuentas(clienteId, 12),
        ])
        if (mounted) {
          if (ctaRes.success) {
            setCuenta(ctaRes.cuenta ?? null)
            setDetalle(Array.isArray(ctaRes.detalle) ? ctaRes.detalle : [])
          }
          if (histRes.success) setHistorial(Array.isArray(histRes.historial) ? histRes.historial : [])
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    cargar()
    return () => {
      mounted = false
    }
  }, [clienteId])

  const verPeriodo = async (fechaInicio: string, fechaFin: string) => {
    setSelectedPeriodo(`${fechaInicio} al ${fechaFin}`)
    try {
      const data = await getPedidosEnRango(clienteId!, fechaInicio, fechaFin)
      setPeriodoDetalle(data)
    } catch (err: any) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  const estado = cuenta?.estado_pago ?? 'AL_DIA'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-700" />
        <h2 className="text-xl font-bold text-stone-800">Estado de cuenta</h2>
      </div>

      {/* Tarjeta de saldo actual */}
      <Card className="border-brand-100 bg-brand-50/50">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-brand-700">Saldo quincena actual</CardTitle>
            <p className="text-sm text-stone-600">
              {cuenta ? `${new Date(cuenta.fecha_inicio).toLocaleDateString('es-NI')} al ${new Date(cuenta.fecha_fin).toLocaleDateString('es-NI')}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-stone-800">
              {formatCurrency(cuenta?.total_acumulado ?? 0)}
            </div>
            <Badge variant={(estadoBadge[estado] ?? 'default') as 'brand' | 'default' | 'error' | 'success' | 'warning'} className="mt-2">
              {estadoTexto[estado] ?? estado}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Desglose de la quincena actual */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose de platillos consumidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detalle.length === 0 ? (
            <p className="text-center text-stone-500 py-6">
              <Clock className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              No hay consumos registrados en esta quincena.
            </p>
          ) : (
            <div className="space-y-2">
              {detalle.map((dia: any, i: number) => {
                const items = dia.items ?? []
                return (
                  <div key={i} className="border-b border-stone-100 pb-2 last:border-0">
                    <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                      {new Date(dia.fecha).toLocaleDateString('es-NI')}
                    </p>
                    <div className="space-y-1">
                      {items.map((item: any, j: number) => (
                        <div key={j} className="flex justify-between text-sm">
                          <span className="text-stone-700">
                            {item.cantidad}x {item.platillo}
                          </span>
                          <span className="text-stone-500">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 border-t border-stone-200 flex justify-between text-sm font-semibold">
                <span>Total quincena</span>
                <span>{formatCurrency(cuenta?.total_acumulado ?? 0)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial y filtro de quincenas anteriores */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Quincenas anteriores</CardTitle>
          <div className="flex items-center gap-2">
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {historial.map((c) => (
              <button
                key={c.id}
                onClick={() => verPeriodo(c.fecha_inicio, c.fecha_fin)}
                className={cnBtn(
                  'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  `border-stone-300 bg-white text-stone-700 hover:bg-stone-50`
                )}
              >
                {new Date(c.fecha_inicio).toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })} –{' '}
                {formatCurrency(c.total_acumulado)}
              </button>
            ))}
            {historial.length === 0 && (
              <span className="text-xs text-stone-400">No hay quincenas anteriores.</span>
            )}
          </div>

          {selectedPeriodo && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-stone-500" />
                <span className="text-sm font-semibold text-stone-800">
                  Detalle: {selectedPeriodo}
                </span>
              </div>
              {periodoDetalle.length === 0 ? (
                <p className="text-sm text-stone-500">Sin pedidos en este período.</p>
              ) : (
                <div className="space-y-2">
                  {periodoDetalle.map((p, i) => (
                    <div key={i} className="flex justify-between items-start text-sm border-b border-stone-100 pb-2 last:border-0">
                      <div>
                        <p className="text-stone-700">{new Date(p.fecha_hora).toLocaleString('es-NI', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xs text-stone-500">
                          {(p.detalle_pedidos ?? [])
                            .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                            .join(', ')}
                        </p>
                      </div>
                      <span className="font-semibold text-stone-800">{formatCurrency(p.total_calculado)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-end text-sm font-semibold">
                    Total: {formatCurrency(periodoDetalle.reduce((s, p) => s + p.total_calculado, 0))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function cnBtn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
