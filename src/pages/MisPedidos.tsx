import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getPedidosCliente } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { formatearHoraManagua } from '../lib/date'
import { FileText, Clock } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import Badge from '../components/ui/badge'

const estadoLabel: Record<string, { label: string; variant: string }> = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  CONFIRMADO: { label: 'Confirmado', variant: 'success' },
  RECHAZADO_FUERA_DE_TIEMPO: { label: 'Fuera de tiempo', variant: 'error' },
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
      <div className="flex h-[60svh] items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-leaf-900 font-serif">Mis pedidos</h2>
          <p className="text-sm text-stone-600">Historial de tus pedidos realizados</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FileText className="h-4 w-4 text-leaf-600" />
          <span className="text-sm font-medium text-stone-600">{pedidos.length} pedido(s)</span>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-300">
            <Clock className="h-8 w-8" />
          </div>
          <p className="text-sm text-stone-500">No tienes pedidos registrados.</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {pedidos.map((p) => {
            const estado = estadoLabel[p.estado] ?? { label: p.estado, variant: 'default' }
            const detalles = p.detalle_pedidos ?? []
            const itemsResumen = detalles
              .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
              .join(', ')
            return (
              <Card key={p.id} className="border-stone-100 transition-shadow hover:shadow-md">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900">
                        {formatearHoraManagua(p.fecha_hora, { dateStyle: 'short' })}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        {formatearHoraManagua(p.fecha_hora, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="mt-1 break-words text-[11px] text-stone-500">{itemsResumen}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-stone-900">{formatCurrency(p.total_calculado)}</p>
                      <Badge variant={estado.variant as any}>{estado.label}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
