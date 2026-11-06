import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useOrderStore } from '../stores/useOrderStore'
import { getCuentaActual } from '../services/accountService'
import { getMenusHoy, getPlatillosPorMenu } from '../services/adminService'
import { notificarPedidoConfirmado } from '../services/whatsappService'
import { formatCurrency } from '../lib/utils'
import { formatearFechaISO, minutosDelDiaManagua, nombreDiaManagua } from '../lib/date'
import { CheckCircle2, AlertCircle, Utensils, Coffee, Droplets, Clock, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'
import { cn } from '../lib/utils'

export default function ClientDashboard() {
  const { profile } = useAuthStore()
  const { items, addItem, removeItem, updateCantidad, clearCart, submitOrder } = useOrderStore()
  const clienteId = profile?.id

  const [menu, setMenu] = useState<any>(null)
  const [platillos, setPlatillos] = useState<any[]>([])
  const [cuenta, setCuenta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmOk, setConfirmOk] = useState(false)

  const horaLimiteMinutos = useCallback(() => {
    if (!menu?.hora_limite_pedido) return 11 * 60
    const [h, m] = menu.hora_limite_pedido.split(':').map(Number)
    return h * 60 + m
  }, [menu])

  const pedidoCerrado = horaLimiteMinutos() <= minutosDelDiaManagua()

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      try {
        setLoading(true)
        const [menus, cuentaRes] = await Promise.all([
          getMenusHoy(true),
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

  // El carrito global se reinicia al entrar a un menú distinto para no
  // arrastrar platillos de otra fecha.
  useEffect(() => {
    if (menu?.id) clearCart()
  }, [menu?.id, clearCart])

  const principalOptions = platillos.filter((p) => p.tipo === 'principal')
  const bebidaOptions = platillos.filter((p) => p.tipo === 'bebida')

  const principalItem = items.find((i) => principalOptions.some((p) => p.id === i.platilloId))
  const bebidaItem = items.find((i) => bebidaOptions.some((p) => p.id === i.platilloId))
  const selectedPrincipalId = principalItem?.platilloId ?? null
  const selectedBebidaId = bebidaItem?.platilloId ?? null
  const cantidad = principalItem?.cantidad ?? bebidaItem?.cantidad ?? 1

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

  const seleccionarPrincipal = (p: any) => {
    if (selectedPrincipalId === p.id) {
      removeItem(p.id)
      return
    }
    if (selectedPrincipalId) removeItem(selectedPrincipalId)
    addItem({
      platilloId: p.id,
      nombre: p.nombre,
      precioUnitario: p.precio_unitario,
      cantidad,
    })
  }

  const seleccionarBebida = (p: any) => {
    if (selectedBebidaId === p.id) {
      removeItem(p.id)
      return
    }
    if (selectedBebidaId) removeItem(selectedBebidaId)
    addItem({
      platilloId: p.id,
      nombre: p.nombre,
      precioUnitario: p.precio_unitario,
      cantidad,
    })
  }

  const cambiarCantidad = (delta: number) => {
    const nueva = Math.max(1, cantidad + delta)
    items.forEach((item) => updateCantidad(item.platilloId, nueva))
  }

  const handleConfirmar = async () => {
    if (!menu) return
    if (!clienteId) {
      setError('Debes iniciar sesión para confirmar tu pedido')
      return
    }
    if (!selectedPrincipalId) {
      setError('Selecciona un plato principal')
      return
    }

    // Solo se envían al servidor los platillos del menú vigente.
    const cartItems = items.filter((item) =>
      platillos.some((p) => p.id === item.platilloId)
    )
    if (cartItems.length === 0) {
      setError('Tu carrito está vacío')
      return
    }

    setConfirmLoading(true)
    setError(null)

    try {
      // RNF2: el pedido se envía desde el carrito global de Zustand.
      const res = await submitOrder(menu.id, clienteId)
      if (res.success) {
        setConfirmOk(true)
        clearCart()
        // Flujo UWE 3.A.5: notificar al cliente la confirmación. El envío
        // es asíncrono y nunca bloquea ni revierte el pedido ya confirmado.
        const pedidoId = typeof res.pedido_id === 'string' ? res.pedido_id : null
        if (pedidoId) {
          notificarPedidoConfirmado(pedidoId).catch(() => {
            // Si WhatsApp no está disponible, el pedido sigue confirmado.
          })
        }
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
      <div className="flex h-[60svh] items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
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

  const totalSeleccionado = items
    .filter((item) => platillos.some((p) => p.id === item.platilloId))
    .reduce((total, item) => total + item.precioUnitario * item.cantidad, 0)

  const nombreDia = nombreDiaManagua()

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header de bienvenida */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-leaf-900 font-serif">Hola, {profile?.nombre ?? ''}</h1>
          <p className="text-sm text-stone-600">¿Qué vas a pedir hoy?</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={pedidoCerrado ? 'error' : 'success'}>
            {pedidoCerrado ? 'Cerrado' : 'Disponible'}
          </Badge>
          <ShieldCheck className={`h-4 w-4 ${pedidoCerrado ? 'text-rose-500' : 'text-leaf-500'}`} />
        </div>
      </div>

      {/* Saldo */}
      <Card variant="bordered" className="border-leaf-200 bg-leaf-50/40">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-leaf-700">Saldo quincenal actual</p>
              <p className="text-[10px] text-stone-500">
                {cuenta ? `${formatearFechaISO(cuenta.fecha_inicio)} al ${formatearFechaISO(cuenta.fecha_fin)}` : ''}
              </p>
            </div>
            <div className="sm:text-right">
              <span className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">
                {cuenta ? formatCurrency(cuenta.total_acumulado) : formatCurrency(0)}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Menú del día */}
      <Card variant="raised">
        <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <CardTitle className="text-leaf-900">Menú de hoy ({nombreDia})</CardTitle>
            <p className="text-xs text-stone-500">Selecciona tus platillos y bebidas.</p>
          </div>
          <Badge variant={pedidoCerrado ? 'error' : 'brand'} className="shrink-0">
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
                    onClick={() => seleccionarPrincipal(p)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-lg border transition-all duration-200',
                      seleccionado
                        ? 'border-leaf-600 bg-leaf-50 ring-2 ring-leaf-600 shadow-sm shadow-leaf-500/20'
                        : 'border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => seleccionarPrincipal(p)}
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
                    onClick={() => seleccionarBebida(p)}
                    className={cn(
                      'flex flex-col items-center justify-between p-3 rounded-lg border transition-all duration-200',
                      seleccionado
                        ? 'border-leaf-600 bg-leaf-50 ring-2 ring-leaf-600 shadow-sm shadow-leaf-500/20'
                        : 'border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        type="radio"
                        checked={seleccionado}
                        onChange={() => seleccionarBebida(p)}
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
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" className="h-10 w-10 text-lg" onClick={() => cambiarCantidad(-1)}>
                −
              </Button>
              <span className="w-10 text-center font-bold text-stone-800">{cantidad}</span>
              <Button variant="outline" size="sm" className="h-10 w-10 text-lg" onClick={() => cambiarCantidad(1)}>
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
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 sm:mb-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Total estimado</p>
              <span className="font-serif text-2xl font-bold text-stone-900">{formatCurrency(totalSeleccionado)}</span>
            </div>
          </div>
          <p className="mb-4 text-[10px] text-stone-500 sm:mb-6">
            Los pedidos se confirman antes de la hora límite de corte.
          </p>
          <Button
            variant="ember"
            className="w-full py-4 text-base font-bold shadow-lg shadow-ember-500/30 hover:shadow-ember-500/50 sm:text-lg"
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
