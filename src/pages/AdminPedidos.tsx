import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getPedidosDelDia } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
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

    // Suscripción en tiempo real a nuevos pedidos / cambios de estado
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      const channel = supabase
        .channel('pedidos-del-dia')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pedidos',
            filter: `fecha_hora=gte.${hoy}T00:00:00Z`,
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
      // Realtime puede no estar configurado; el funcionamiento no se interrumpe
      return () => {
        mounted = false
      }
    }
  }, [])

  const totalDia = pedidos.reduce((s, p) => s + p.total_calculado, 0)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-brand-700" />
          <h2 className="text-xl font-bold text-stone-800">Pedidos del día</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">
            Total: <span className="font-bold text-stone-800">{formatCurrency(totalDia)}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={refreshing}
          >
            {refreshing ? '...' : <><RefreshCw className="w-4 h-4 mr-2" /> Actualizar</>}
          </Button>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">No hay pedidos confirmados hoy.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Hora</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Platillos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-right">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Estado</th>
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
                        className="border-b border-stone-100 hover:bg-stone-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-stone-800 font-medium">
                          {p.perfiles?.nombre ?? 'Cliente'}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {new Date(p.fecha_hora).toLocaleTimeString('es-NI', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-700 max-w-[200px] truncate" title={resumen}>
                          {resumen}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-stone-800 text-right">
                          {formatCurrency(p.total_calculado)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={(estadoBadge[p.estado] ?? 'default') as 'brand' | 'default' | 'error' | 'success' | 'warning'}>
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
      )}
    </div>
  )
}
