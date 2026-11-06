import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getPedidosDelDia } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { formatearHoraManagua } from '../lib/date'
import { List, RefreshCw, Clock } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'

const estadoBadge: Record<string, string> = {
  PENDIENTE: 'warning',
  CONFIRMADO: 'success',
  RECHAZADO_FUERA_DE_TIEMPO: 'error',
}

const estadoTexto: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  RECHAZADO_FUERA_DE_TIEMPO: 'Rechazado',
}

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const cargar = async () => {
    try {
      setLoading(true)
      const data = await getPedidosDelDia()
      setPedidos(data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let mounted = true
    cargar()

    try {
      const channel = supabase
        .channel('pedidos-del-dia')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pedidos',
          },
          () => {
            if (mounted) cargar()
          }
        )
        .subscribe()
      return () => {
        mounted = false
        supabase.removeChannel(channel)
      }
    } catch (err) {
      return () => {
        mounted = false
      }
    }
  }, [])

  const totalDia = pedidos.reduce((s, p) => s + p.total_calculado, 0)

  if (loading) {
    return (
      <div className="flex h-[60svh] items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <List className="h-5 w-5 shrink-0 text-leaf-700" />
          <h2 className="min-w-0 truncate text-leaf-900 font-serif">Pedidos del día</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-leaf-50 px-3 py-1.5 text-xs font-semibold text-leaf-700">
            <span className="h-2 w-2 rounded-full bg-leaf-600"></span>
            Total: <span className="font-bold">{formatCurrency(totalDia)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={refreshing}
          >
            {refreshing ? '...' : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </>
            )}
          </Button>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-300">
            <Clock className="h-8 w-8" />
          </div>
          <p className="text-sm text-stone-500">No hay pedidos confirmados hoy.</p>
        </div>
      ) : (
        <>
          {/* Vista móvil */}
          <div className="space-y-3 md:hidden">
            {pedidos.map((p) => {
              const detalles = p.detalle_pedidos ?? []
              const resumen = detalles
                .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                .join(', ')
              return (
                <Card key={p.id} className="border-stone-100">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-900">
                          {p.perfiles?.nombre ?? 'Cliente'}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {formatearHoraManagua(p.fecha_hora, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <Badge variant={estadoBadge[p.estado] as any}>
                        {estadoTexto[p.estado] ?? p.estado}
                      </Badge>
                    </div>
                    <p className="break-words text-sm text-stone-700">{resumen || 'Sin platillos'}</p>
                    <p className="text-right text-sm font-bold text-stone-900">
                      {formatCurrency(p.total_calculado)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Vista de escritorio */}
          <Card variant="bordered" className="hidden md:block">
            <CardContent className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Cliente</th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Hora</th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Platillos</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-stone-500">Total</th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => {
                      const detalles = p.detalle_pedidos ?? []
                      const resumen = detalles
                        .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                        .join(', ')
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-stone-50 transition-colors hover:bg-stone-50"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-stone-900">
                            {p.perfiles?.nombre ?? 'Cliente'}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {formatearHoraManagua(p.fecha_hora, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="max-w-[260px] truncate px-4 py-3 text-sm text-stone-700" title={resumen}>
                            {resumen}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-stone-900">
                            {formatCurrency(p.total_calculado)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={estadoBadge[p.estado] as any}>
                              {estadoTexto[p.estado] ?? p.estado}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
