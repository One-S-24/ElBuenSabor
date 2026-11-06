import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getPedidosDelDia } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { formatearHoraManagua } from '../lib/date'
import { Clock, RefreshCw, Users } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'

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
          },
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
  const confirmados = pedidos.filter((p) => p.estado === 'CONFIRMADO').length
  const pendientes = pedidos.filter((p) => p.estado === 'PENDIENTE').length

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando pedidos del día…</span>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className={
                card === 0
                  ? 'space-y-3 rounded-2xl bg-leaf-900 p-4'
                  : 'surface space-y-3 rounded-2xl p-4'
              }
            >
              <Skeleton className={card === 0 ? 'h-2.5 w-24 bg-white/15' : 'h-2.5 w-24'} />
              <Skeleton className={card === 0 ? 'h-8 w-28 bg-white/15' : 'h-8 w-16'} />
            </div>
          ))}
        </div>

        <div className="surface space-y-3 rounded-2xl p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="text-stone-900">Pedidos del día</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-stone-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf-600" />
            </span>
            Actualización en tiempo real
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            setRefreshing(true)
            cargar()
          }}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {pedidos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-100 text-stone-300">
              <Clock className="h-8 w-8" />
            </span>
            <p className="font-serif text-lg font-semibold text-stone-800">No hay pedidos hoy</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-stone-500">
              Los pedidos confirmados aparecerán aquí automáticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <div className="ink-surface relative overflow-hidden rounded-2xl p-4">
              <div className="dot-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.12em] text-leaf-300/80">
                Total del día
              </p>
              <p className="relative mt-1 font-serif text-2xl font-bold text-white">
                {formatCurrency(totalDia)}
              </p>
            </div>
            <div className="surface rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                Confirmados
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-leaf-700">{confirmados}</p>
            </div>
            <div className="surface rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                Pendientes
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-ember-600">{pendientes}</p>
            </div>
          </div>

          {/* Vista móvil */}
          <div className="space-y-3 md:hidden">
            {pedidos.map((p) => {
              const detalles = p.detalle_pedidos ?? []
              const resumen = detalles
                .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                .join(' · ')
              return (
                <Card key={p.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
                          <Users className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {p.perfiles?.nombre ?? 'Cliente'}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {formatearHoraManagua(p.fecha_hora, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={estadoBadge[p.estado] as any}>
                        {estadoTexto[p.estado] ?? p.estado}
                      </Badge>
                    </div>
                    <p className="break-words rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
                      {resumen || 'Sin platillos'}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                        Total
                      </span>
                      <span className="font-serif text-lg font-bold text-stone-900">
                        {formatCurrency(p.total_calculado)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Vista de escritorio */}
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60">
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Hora
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Platillos
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Total
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        Estado
                      </th>
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
                          className="border-b border-stone-100 transition-colors last:border-0 hover:bg-leaf-50/40"
                        >
                          <td className="px-4 py-3.5 text-sm font-semibold text-stone-900">
                            {p.perfiles?.nombre ?? 'Cliente'}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-stone-500">
                            {formatearHoraManagua(p.fecha_hora, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td
                            className="max-w-[260px] truncate px-4 py-3.5 text-sm text-stone-600"
                            title={resumen}
                          >
                            {resumen}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-stone-900">
                            {formatCurrency(p.total_calculado)}
                          </td>
                          <td className="px-4 py-3.5">
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
