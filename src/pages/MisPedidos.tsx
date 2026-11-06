import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getPedidosCliente } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { formatearHoraManagua } from '../lib/date'
import { CheckCircle2, Clock, FileText, XCircle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import Badge from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'

const estadoLabel: Record<string, { label: string; variant: string }> = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  CONFIRMADO: { label: 'Confirmado', variant: 'success' },
  RECHAZADO_FUERA_DE_TIEMPO: { label: 'Fuera de tiempo', variant: 'error' },
}

const estadoIcono: Record<string, { icon: typeof Clock; className: string }> = {
  PENDIENTE: { icon: Clock, className: 'bg-ember-50 text-ember-600 ring-ember-200' },
  CONFIRMADO: { icon: CheckCircle2, className: 'bg-leaf-50 text-leaf-700 ring-leaf-200' },
  RECHAZADO_FUERA_DE_TIEMPO: { icon: XCircle, className: 'bg-ember-50 text-ember-700 ring-ember-200' },
}

export default function MisPedidos() {
  const { profile } = useAuthStore()
  const clienteId = profile?.id
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      if (!clienteId) return
      try {
        setLoading(true)
        const data = await getPedidosCliente(clienteId)
        if (mounted) setPedidos(data)
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

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando pedidos…</span>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="surface space-y-2 rounded-2xl p-3 sm:p-4">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-40 max-w-full" />
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-2.5 w-3/4" />
                </div>
                <div className="shrink-0 space-y-2">
                  <Skeleton className="ml-auto h-2.5 w-12" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const confirmados = pedidos.filter((p) => p.estado === 'CONFIRMADO').length
  const pendientes = pedidos.filter((p) => p.estado === 'PENDIENTE').length

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Historial</p>
          <h1 className="text-stone-900">Mis pedidos</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Todo lo que has pedido en el comedor, en orden cronológico.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600">
          <FileText className="h-3.5 w-3.5 text-leaf-600" />
          {pedidos.length} pedido(s)
        </span>
      </div>

      {pedidos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-100 text-stone-300">
              <Clock className="h-8 w-8" />
            </span>
            <p className="font-serif text-lg font-semibold text-stone-800">Aún no hay pedidos</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-stone-500">
              Cuando confirmes tu primer almuerzo aparecerá aquí con su estado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="surface rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                Total
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-stone-900 sm:text-2xl">{pedidos.length}</p>
            </div>
            <div className="surface rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                Confirmados
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-leaf-700 sm:text-2xl">{confirmados}</p>
            </div>
            <div className="surface rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                Pendientes
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-ember-600 sm:text-2xl">{pendientes}</p>
            </div>
          </div>

          <div className="space-y-3">
            {pedidos.map((p) => {
              const estado = estadoLabel[p.estado] ?? { label: p.estado, variant: 'default' }
              const icono = estadoIcono[p.estado] ?? {
                icon: Clock,
                className: 'bg-stone-100 text-stone-500 ring-stone-200',
              }
              const Icono = icono.icon
              const detalles = p.detalle_pedidos ?? []
              const itemsResumen = detalles
                .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                .join(' · ')

              return (
                <Card key={p.id} className="transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${icono.className}`}
                        aria-hidden="true"
                      >
                        <Icono className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">
                            {formatearHoraManagua(p.fecha_hora, { dateStyle: 'medium' })}
                          </p>
                          <Badge variant={estado.variant as any}>{estado.label}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-stone-400">
                          {formatearHoraManagua(p.fecha_hora, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="mt-1.5 break-words text-xs leading-relaxed text-stone-500">
                          {itemsResumen || 'Sin detalle de platillos'}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                          Total
                        </p>
                        <p className="font-serif text-lg font-bold text-stone-900">
                          {formatCurrency(p.total_calculado)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
