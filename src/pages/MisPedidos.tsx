import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getPedidosCliente } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
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
      <div className="flex h-screen items-center justify-center bg-brand-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Mis pedidos</h2>
          <p className="text-stone-500 text-sm">Historial de tus pedidos realizados</p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-medium text-stone-600">{pedidos.length} pedido(s)</span>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 text-stone-300">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-stone-500 text-sm">No tienes pedidos registrados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => {
            const estado = estadoLabel[p.estado] ?? { label: p.estado, variant: 'default' }
            const detalles = p.detalle_pedidos ?? []
            const itemsResumen = detalles
              .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
              .join(', ')
            return (
              <Card key={p.id} className="border-stone-100 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-stone-900">
                        {new Date(p.fecha_hora).toLocaleDateString('es-NI')}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {new Date(p.fecha_hora).toLocaleTimeString('es-NI', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">{itemsResumen}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-stone-900">{formatCurrency(p.total_calculado)}</p>
                      <Badge variant={estado.variant as any}>
                        {estado.label}
                      </Badge>
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
