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
  RECHAZADO_FUERA_DE_TIEMPO: { label: 'Rechazado (fuera de tiempo)', variant: 'error' },
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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-700" />
        <h2 className="text-xl font-bold text-stone-800">Mis pedidos</h2>
      </div>

      {pedidos.length === 0 ? (
        <div className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">No tienes pedidos registrados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => {
            const estado = estadoLabel[p.estado] ?? { label: p.estado, variant: 'default' }
            const detalles = p.detalle_pedidos ?? []
            const itemsResumen = detalles
              .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
              .join(', ')
            return (
              <Card key={p.id} className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-stone-800">
                        {new Date(p.fecha_hora).toLocaleDateString('es-NI')}
                      </p>
                      <p className="text-xs text-stone-500">{itemsResumen}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-stone-800">{formatCurrency(p.total_calculado)}</p>
                      <Badge variant={estado.variant as 'brand' | 'default' | 'error' | 'success' | 'warning'} className="mt-1">
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
