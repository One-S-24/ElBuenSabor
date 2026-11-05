import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useOrderStore } from '../stores/useOrderStore'
import { getCuentaActual } from '../services/accountService'
import { getMenusHoy, getPlatillosPorMenu } from '../services/adminService'
import { formatCurrency, cn } from '../lib/utils'
import { CheckCircle2, AlertCircle, Utensils, Coffee, Droplets } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'

export default function ClientDashboard() {
  const { profile } = useAuthStore()
  const { clearCart } = useOrderStore()
  const clienteId = profile?.id

  const [menu, setMenu] = useState<any>(null)
  const [platillos, setPlatillos] = useState<any[]>([])
  const [cuenta, setCuenta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmOk, setConfirmOk] = useState(false)

  const principalOptions = platillos.filter((p) => p.tipo === 'principal')
  const bebidaOptions = platillos.filter((p) => p.tipo === 'bebida')

  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string | null>(null)
  const [selectedBebidaId, setSelectedBebidaId] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState(1)

  const ahora = () => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  }

  const horaLimiteMinutos = useCallback(() => {
    if (!menu?.hora_limite_pedido) return 11 * 60
    const [h, m] = menu.hora_limite_pedido.split(':').map(Number)
    return h * 60 + m
  }, [menu])

  const pedidoCerrado = horaLimiteMinutos() <= ahora()

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      try {
        setLoading(true)
        const [menus, cuentaRes] = await Promise.all([
          getMenusHoy(),
          clienteId ? getCuentaActual(clienteId) : Promise.resolve({ success: true, cuenta: { total_acumulado: 0 } }),
        ])
        if (mounted) {
          setMenu(menus[0] ?? null)
          if (cuentaRes.success) setCuenta(cuentaRes.cuenta ?? null)
          if (menus[0]) {
            const ps = await getPlatillosPorMenu(menus[0].id)
            setPlatillos(ps)
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'No se pudo cargar el menú')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    cargar()
    return () => {
      mounted = false
    }
  }, [clienteId])

  const handleConfirmar = async () => {
    if (!menu) return
    if (!selectedPrincipalId) {
      setError('Selecciona un plato principal')
      return
    }
    setConfirmLoading(true)
    setError(null)

    const cartItems: any[] = [
      {
        platilloId: selectedPrincipalId,
        nombre: principalOptions.find((p) => p.id === selectedPrincipalId)?.nombre ?? 'Platillo',
        precioUnitario: principalOptions.find((p) => p.id === selectedPrincipalId)?.precio_unitario ?? 0,
        cantidad,
      },
    ]
    if (selectedBebidaId) {
      const b = bebidaOptions.find((p) => p.id === selectedBebidaId)
      cartItems.push({
        platilloId: selectedBebidaId,
        nombre: b?.nombre ?? 'Bebida',
        precioUnitario: b?.precio_unitario ?? 0,
        cantidad,
      })
    }

    try {
      // Sincronizar carrito con la store antes de enviar
      const { enviarPedido } = await import('../services/orderService')
      const res = await enviarPedido(clienteId!, menu.id, cartItems)
      if (res.success) {
        setConfirmOk(true)
        clearCart()
        setTimeout(() => setConfirmOk(false), 4000)
      } else {
        setError(res.error || 'No se pudo confirmar el pedido')
      }
    } catch (err: any) {
      setError(err.message || 'Error al confirmar el pedido')
    } finally {
      setConfirmLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="p-6 text-center">
        <p className="text-stone-600">No hay menú disponible hoy.</p>
      </div>
    )
  }

  const totalSeleccionado =
    principalOptions.find((p) => p.id === selectedPrincipalId)?.precio_unitario * cantidad +
    (selectedBebidaId
      ? bebidaOptions.find((p) => p.id === selectedBebidaId)?.precio_unitario * cantidad
      : 0)

  const nombreDia = new Date().toLocaleDateString('es-NI', { weekday: 'long' })

  return (
    <div className="space-y-5">
      {/* Saldo */}
      <Card className="border-brand-100 bg-brand-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brand-700 uppercase tracking-wider">Saldo actual (quincena)</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-brand-700">
              {cuenta ? formatCurrency(cuenta.total_acumulado) : formatCurrency(0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Menú del día */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-brand-700">Menú de hoy ({nombreDia})</CardTitle>
            <p className="text-xs text-stone-500">Lista para ordenar tu almuerzo.</p>
          </div>
          <Badge variant={pedidoCerrado ? 'error' : 'brand'}>
            {pedidoCerrado ? 'Cerrado' : 'Disponible'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Plato principal */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-stone-500" />
              <span className="font-semibold text-stone-800">Plato principal</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {principalOptions.map((p) => {
                const seleccionado = selectedPrincipalId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrincipalId(p.id)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-xl border transition-all',
                      seleccionado
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => setSelectedPrincipalId(p.id)}
                        className="w-4 h-4 text-brand-600"
                        readOnly
                      />
                      <span className="text-sm font-medium text-stone-800">{p.nombre}</span>
                    </div>
                    <span className="text-brand-700 font-bold">
                      {formatCurrency(p.precio_unitario)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bebida */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-stone-500" />
              <span className="font-semibold text-stone-800">Bebida</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bebidaOptions.map((p) => {
                const seleccionado = selectedBebidaId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedBebidaId(p.id)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-xl border transition-all',
                      seleccionado
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => setSelectedBebidaId(p.id)}
                        className="w-4 h-4 text-brand-600"
                        readOnly
                      />
                      <span className="text-sm font-medium text-stone-800">{p.nombre}</span>
                    </div>
                    <span className="text-brand-700 font-bold">
                      {formatCurrency(p.precio_unitario)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-stone-500" />
              <span className="font-semibold text-stone-800">Cantidad de porciones</span>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
                −
              </Button>
              <span className="w-8 text-center font-bold text-stone-800">{cantidad}</span>
              <Button variant="outline" size="sm" onClick={() => setCantidad((c) => c + 1)}>
                +
              </Button>
            </div>
          </div>

          {pedidoCerrado && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-800 ml-2">
                Hora límite de corte superada (11:00 AM). No se pueden tomar más pedidos hoy.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen y acción */}
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-stone-600">Total estimado</span>
            <span className="text-xl font-bold text-stone-800">{formatCurrency(totalSeleccionado)}</span>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            Los pedidos se confirman antes de la hora límite de corte.
          </p>
          <Button
            variant="destructive"
            className="w-full py-3 text-lg font-bold shadow-lg"
            disabled={pedidoCerrado || !selectedPrincipalId || confirmLoading}
            onClick={handleConfirmar}
          >
            {confirmOk ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" /> ¡Pedido confirmado!
              </>
            ) : confirmLoading ? (
              'Confirmando...'
            ) : (
              'CONFIRMAR PEDIDO DIARIO'
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  )
}
