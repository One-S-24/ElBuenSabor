import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getCuentaActual, getHistorialCuentas } from '../services/accountService'
import { getPedidosEnRango } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { formatearFechaISO } from '../lib/date'
import { History, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Badge from '../components/ui/badge'
import Avatar from '../components/ui/avatar'

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
  const { profile, user } = useAuthStore()
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
      <div className="flex h-[60svh] items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
      </div>
    )
  }

  const estado = cuenta?.estado_pago ?? 'AL_DIA'

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-leaf-900 font-serif">Estado de cuenta</h2>
          <p className="text-sm text-stone-600">Tu saldo acumulado y consumo por quincena</p>
        </div>
      </div>

      {/* Perfil */}
      <Card variant="raised" className="border-stone-100">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
          <Avatar name={profile?.nombre} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold text-stone-900">
              {profile?.nombre ?? 'Cliente'}
            </p>
            <p className="truncate text-sm text-stone-500">
              {profile?.telefono_whatsapp || 'Sin teléfono registrado'}
            </p>
            {user?.email && (
              <p className="mt-0.5 truncate text-xs text-stone-400">{user.email}</p>
            )}
          </div>
          <Badge variant="success" className="self-start sm:self-center">
            Cliente
          </Badge>
        </CardContent>
      </Card>

      {/* Tarjeta de saldo actual */}
      <Card variant="raised" className="border-leaf-100 bg-leaf-50/40 shadow-sm shadow-leaf-500/10">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-leaf-700">Saldo quincena actual</p>
            <p className="mt-1 text-[10px] text-stone-500">
              {cuenta ? `${formatearFechaISO(cuenta.fecha_inicio)} al ${formatearFechaISO(cuenta.fecha_fin)}` : ''}
            </p>
          </div>
          <div className="sm:text-right">
            <div className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">
              {formatCurrency(cuenta?.total_acumulado ?? 0)}
            </div>
            <Badge variant={estadoBadge[estado] as any} className="mt-2">
              {estadoTexto[estado] ?? estado}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Desglose de la quincena actual */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="text-leaf-900">Desglose de platillos consumidos</CardTitle>
          <p className="text-[11px] text-stone-500 mt-1">Detalle de tu consumo en la quincena actual</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {detalle.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-300">
                <Clock className="w-6 h-6" />
              </div>
              <p className="text-stone-500 text-sm">No hay consumos registrados en esta quincena.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {detalle.map((dia: any, i: number) => {
                const items = dia.items ?? []
                return (
                  <div key={i} className="border-b border-stone-50 pb-3 last:border-0 last:pb-0">
                    <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
                      {formatearFechaISO(dia.fecha)}
                    </p>
                    <div className="space-y-1">
                      {items.map((item: any, j: number) => (
                        <div key={j} className="flex items-start justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="shrink-0 text-stone-700">{item.cantidad}x</span>
                            <span className="break-words text-stone-600">{item.platillo}</span>
                          </div>
                          <span className="shrink-0 font-medium text-stone-800">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="pt-4 border-t border-stone-100 flex justify-between text-sm font-semibold">
                <span>Total quincena</span>
                <span className="text-leaf-700">{formatCurrency(cuenta?.total_acumulado ?? 0)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial y filtro de quincenas anteriores */}
      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-leaf-900">Quincenas anteriores</CardTitle>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            {historial.length} registro(s)
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {historial.map((c) => (
              <button
                key={c.id}
                onClick={() => verPeriodo(c.fecha_inicio, c.fecha_fin)}
                className={cnBtn(
                  'flex w-full min-w-0 flex-col items-start gap-1 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left text-stone-700 transition-all duration-200 hover:border-leaf-200 hover:bg-leaf-50 hover:text-leaf-700',
                )}
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  {formatearFechaISO(c.fecha_inicio, { month: 'short', day: 'numeric' })}
                </span>
                <span className="truncate text-sm font-bold">{formatCurrency(c.total_acumulado)}</span>
                <span className="truncate text-[10px] text-stone-400">{c.estado_pago}</span>
              </button>
            ))}
            {historial.length === 0 && (
              <span className="col-span-full py-4 text-center text-sm text-stone-400">No hay quincenas anteriores.</span>
            )}
          </div>

          {selectedPeriodo && (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <div className="mb-3 flex items-start gap-2">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
                <span className="min-w-0 break-words text-sm font-semibold text-stone-800">
                  Detalle: {selectedPeriodo}
                </span>
              </div>
              {periodoDetalle.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-500">
                  Sin pedidos en este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {periodoDetalle.map((p, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 border-b border-stone-50 pb-2 text-sm last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm text-stone-700">
                          {new Date(p.fecha_hora).toLocaleString('es-NI', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="mt-0.5 break-words text-[11px] text-stone-500">
                          {(p.detalle_pedidos ?? [])
                            .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                            .join(', ')}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-stone-900">{formatCurrency(p.total_calculado)}</span>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-end text-sm font-bold">
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
