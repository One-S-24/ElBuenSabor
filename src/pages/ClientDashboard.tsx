import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useOrderStore } from '../stores/useOrderStore'
import { getCuentaActual } from '../services/accountService'
import { getMenusHoy, getPlatillosPorMenu } from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { CheckCircle2, AlertCircle, Utensils, Coffee, Droplets, Clock, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'
import { cn } from '../lib/utils'

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

  const principalOptions = platillos.filter((p) => p.tipo === 'principal')
  const bebidaOptions = platillos.filter((p) => p.tipo === 'bebida')

  const btnConfirmContent = confirmOk ? (
    <>
      <CheckCircle2 className="w-5 h-5 mr-2" /> ¡Pedido confirmado!
    </>
  ) : confirmLoading ? (
    <>
      <Clock className="w-4 h-4 animate-spin mr-2" />
      Confirmando...
    </>
  ) : (
    <>
      <ShieldCheck className="w-4 h-4 mr-2" />
      Confirmar pedido diario
    </>
  );

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-leaf-600"></div>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="p-6 text-center">
        <Card className="max-w-sm mx-auto border-0 shadow-xl raised">
          <CardContent className="text-center py-10">
            <Clock className="w-12 h-12 mx-auto text-stone-300 mb-4" />
            <CardTitle>Sin menú hoy</CardTitle>
            <CardDescription>
              El menú del día aún no se ha publicado. Vuelve más tarde.
            </CardDescription>
          </CardContent>
        </Card>
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
    <div className="space-y-6">
      {/* Header de bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-leaf-900 font-serif">Hola, {profile?.nombre ?? ''}</h1>
          <p className="text-stone-600 text-sm">¿Qué vas a pedir hoy?</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pedidoCerrado ? 'error' : 'success'}>
            {pedidoCerrado ? 'Cerrado' : 'Disponible'}
          </Badge>
          <ShieldCheck className={`w-4 h-4 ${pedidoCerrado ? 'text-rose-500' : 'text-leaf-500'}`} />
        </div>
      </div>

      {/* Saldo */}
      <Card variant="bordered" className="border-leaf-200 bg-leaf-50/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-leaf-700 uppercase">Saldo quincenal actual</p>
              <p className="text-[10px] text-stone-500">
                {cuenta ? `${new Date(cuenta.fecha_inicio).toLocaleDateString('es-NI')} al ${new Date(cuenta.fecha_fin).toLocaleDateString('es-NI')}` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-stone-900 font-serif">
                {cuenta ? formatCurrency(cuenta.total_acumulado) : formatCurrency(0)}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Menú del día */}
      <Card variant="raised">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-leaf-900">Menú de hoy ({nombreDia})</CardTitle>
            <p className="text-xs text-stone-500">Selecciona tus platillos y bebidas.</p>
          </div>
          <Badge variant={pedidoCerrado ? 'error' : 'brand'}>
            {pedidoCerrado ? 'Cerrado' : 'Disponible'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plato principal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-stone-400" />
              <span className="font-semibold text-stone-800 text-sm">Plato principal</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {principalOptions.map((p) => {
                const seleccionado = selectedPrincipalId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrincipalId(p.id)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-lg border transition-all duration-200',
                      seleccionado
                        ? 'border-leaf-600 bg-leaf-50 ring-2 ring-leaf-600 shadow-sm shadow-leaf/20'
                        : 'border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => setSelectedPrincipalId(p.id)}
                        className="w-4 h-4 text-leaf-600 accent-leaf-600"
                        readOnly
                      />
                      <span className="text-sm font-medium text-stone-800 leading-tight">{p.nombre}</span>
                    </div>
                    <span className="text-leaf-700 font-bold">
                      {formatCurrency(p.precio_unitario)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bebida */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-stone-400" />
              <span className="font-semibold text-stone-800 text-sm">Bebida</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bebidaOptions.map((p) => {
                const seleccionado = selectedBebidaId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedBebidaId(p.id)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-lg border transition-all duration-200',
                      seleccionado
                        ? 'border-leaf-600 bg-leaf-50 ring-2 ring-leaf-600 shadow-sm shadow-leaf/20'
                        : 'border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => setSelectedBebidaId(p.id)}
                        className="w-4 h-4 text-leaf-600 accent-leaf-600"
                        readOnly
                      />
                      <span className="text-sm font-medium text-stone-800 leading-tight">{p.nombre}</span>
                    </div>
                    <span className="text-leaf-700 font-bold">
                      {formatCurrency(p.precio_unitario)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cantidad */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-stone-400" />
              <span className="font-semibold text-stone-800 text-sm">Cantidad de porciones</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
                −
              </Button>
              <span className="w-10 text-center font-bold text-stone-800">{cantidad}</span>
              <Button variant="outline" size="sm" onClick={() => setCantidad((c) => c + 1)}>
                +
              </Button>
            </div>
          </div>

          {pedidoCerrado && (
            <div className="rounded-lg bg-ember-50 border border-ember-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-ember-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-ember-800">
                    Hora límite de corte superada
                  </p>
                  <p className="text-xs text-ember-600 mt-1">
                    Los pedidos cierran a las 11:00 AM. No se pueden tomar más pedidos hoy.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen y acción */}
      <Card variant="raised">
        <CardContent className="p-6">
          <div className="flex justify-between items-baseline mb-6">
            <div>
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Total estimado</p>
              <span className="text-2xl font-bold text-stone-900 font-serif">{formatCurrency(totalSeleccionado)}</span>
            </div>
          </div>
          <p className="text-[10px] text-stone-500 mb-6">
            Los pedidos se confirman antes de la hora límite de corte.
          </p>
          <Button
            variant="ember"
            className="w-full py-4 text-lg font-bold shadow-lg shadow-ember/30 hover:shadow-ember/50"
            disabled={pedidoCerrado || !selectedPrincipalId || confirmLoading}
            onClick={handleConfirmar}
          >
            {btnConfirmContent}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-ember-50 border border-ember-200 p-4 text-ember-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
