import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useOrderStore } from '../stores/useOrderStore'
import { getCuentaActual } from '../services/accountService'
import { getMenusHoy, getPlatillosPorMenu } from '../services/adminService'
import { notificarPedidoConfirmado } from '../services/whatsappService'
import { formatCurrency } from '../lib/utils'
import { formatearFechaISO, formatearHora12, hoyManaguaISO, minutosDelDiaManagua, nombreDiaManagua } from '../lib/date'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Minus,
  Plus,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Badge from '../components/ui/badge'
import { ClientRouteSkeleton } from '../components/ui/skeleton'
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
          clienteId
            ? getCuentaActual(clienteId)
            : Promise.resolve({ success: true, cuenta: { total_acumulado: 0 } }),
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
      <CheckCircle2 className="h-5 w-5" /> ¡Pedido confirmado!
    </>
  ) : confirmLoading ? (
    <>
      <Clock className="h-4 w-4 animate-spin" />
      Confirmando...
    </>
  ) : (
    <>
      <ShieldCheck className="h-4 w-4" />
      Confirmar pedido diario
    </>
  )

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
    const cartItems = items.filter((item) => platillos.some((p) => p.id === item.platilloId))
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
    return <ClientRouteSkeleton />
  }

  if (!menu) {
    return (
      <div className="py-10">
        <Card className="mx-auto max-w-sm text-center">
          <CardContent className="flex flex-col items-center py-10">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-100 text-stone-300">
              <Clock className="h-8 w-8" />
            </span>
            <CardTitle>Sin menú hoy</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              El menú del día aún no se ha publicado. Vuelve más tarde.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalSeleccionado = items
    .filter((item) => platillos.some((p) => p.id === item.platilloId))
    .reduce((total, item) => total + item.precioUnitario * item.cantidad, 0)

  const itemsDelMenu = items.filter((item) => platillos.some((p) => p.id === item.platilloId))
  const nombreDia = nombreDiaManagua()
  const fechaHoy = formatearFechaISO(hoyManaguaISO())
  const horaLimite = menu.hora_limite_pedido ?? '11:00'

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero de bienvenida */}
      <Card variant="ink" className="relative overflow-hidden">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-200/80">
              <CalendarDays className="h-3.5 w-3.5" />
              {nombreDia} · {fechaHoy}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ring-1',
                pedidoCerrado
                  ? 'bg-ember-500/20 text-ember-200 ring-ember-300/30'
                  : 'bg-leaf-400/15 text-leaf-100 ring-leaf-300/30',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', pedidoCerrado ? 'bg-ember-400' : 'bg-leaf-300')} />
              {pedidoCerrado ? 'Pedidos cerrados' : 'Pedidos abiertos'}
            </span>
          </div>

          <h1 className="mt-5 text-white">Hola, {(profile?.nombre ?? '').split(' ')[0] || 'comensal'}</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-leaf-100/70">
            Arma tu almuerzo de hoy. Elige un plato principal y, si quieres, una bebida.
          </p>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf-300/80">
                Saldo quincenal actual
              </p>
              <p className="mt-1 font-serif text-3xl font-bold leading-none text-white">
                {formatCurrency(cuenta?.total_acumulado ?? 0)}
              </p>
              <p className="mt-1.5 text-[11px] text-leaf-100/55">
                {cuenta
                  ? `${formatearFechaISO(cuenta.fecha_inicio)} al ${formatearFechaISO(cuenta.fecha_fin)}`
                  : 'Sin cuenta activa'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf-300/80">
                Hora límite
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-white">{formatearHora12(horaLimite)}</p>
              <p className="mt-1 text-[11px] text-leaf-100/55">Para pedidos del día</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Menú del día */}
        <Card variant="raised">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Menú del día</p>
              <CardTitle>Elige tu almuerzo</CardTitle>
              <p className="mt-1.5 text-sm text-stone-500">
                Toca un plato para seleccionarlo. Puedes cambiar tu elección.
              </p>
            </div>
            <Badge variant={pedidoCerrado ? 'error' : 'brand'} className="mt-0.5 shrink-0">
              {pedidoCerrado ? 'Cerrado' : 'Disponible'}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Plato principal */}
            <section aria-labelledby="principal-title">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                </span>
                <h4 id="principal-title" className="text-sm font-semibold text-stone-800">
                  Plato principal
                </h4>
                <span className="text-[11px] text-stone-400">Obligatorio</span>
              </div>

              {principalOptions.length === 0 ? (
                <p className="rounded-xl bg-stone-50 px-3 py-4 text-sm text-stone-500">
                  No hay platos principales publicados para hoy.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {principalOptions.map((p) => {
                    const seleccionado = selectedPrincipalId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionarPrincipal(p)}
                        aria-pressed={seleccionado}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200',
                          seleccionado
                            ? 'border-leaf-600 bg-leaf-50 ring-1 ring-leaf-600/20'
                            : 'border-stone-200 bg-white hover:border-leaf-300 hover:bg-leaf-50/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            seleccionado
                              ? 'border-leaf-600 bg-leaf-600 text-white'
                              : 'border-stone-300 text-transparent',
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-800">
                            {p.nombre}
                          </span>
                          <span className="text-[11px] text-stone-400">Porción individual</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-leaf-700">
                          {formatCurrency(p.precio_unitario)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Bebida */}
            <section aria-labelledby="bebida-title">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ember-50 text-ember-600">
                  <Coffee className="h-3.5 w-3.5" />
                </span>
                <h4 id="bebida-title" className="text-sm font-semibold text-stone-800">
                  Bebida
                </h4>
                <span className="text-[11px] text-stone-400">Opcional</span>
              </div>

              {bebidaOptions.length === 0 ? (
                <p className="rounded-xl bg-stone-50 px-3 py-4 text-sm text-stone-500">
                  No hay bebidas publicadas para hoy.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {bebidaOptions.map((p) => {
                    const seleccionado = selectedBebidaId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionarBebida(p)}
                        aria-pressed={seleccionado}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200',
                          seleccionado
                            ? 'border-leaf-600 bg-leaf-50 ring-1 ring-leaf-600/20'
                            : 'border-stone-200 bg-white hover:border-leaf-300 hover:bg-leaf-50/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            seleccionado
                              ? 'border-leaf-600 bg-leaf-600 text-white'
                              : 'border-stone-300 text-transparent',
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-800">
                            {p.nombre}
                          </span>
                          <span className="text-[11px] text-stone-400">Bebida natural</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-leaf-700">
                          {formatCurrency(p.precio_unitario)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Cantidad */}
            <section aria-labelledby="cantidad-title">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <h4 id="cantidad-title" className="text-sm font-semibold text-stone-800">
                  Cantidad de porciones
                </h4>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(-1)}
                  disabled={cantidad <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
                  aria-label="Quitar una porción"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-stone-900" aria-live="polite">
                  {cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
                  aria-label="Agregar una porción"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </section>

            {pedidoCerrado && (
              <div className="rounded-2xl border border-ember-200 bg-ember-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ember-600" />
                  <div>
                    <p className="text-sm font-semibold text-ember-800">Hora límite de corte superada</p>
                    <p className="mt-1 text-xs leading-relaxed text-ember-700">
                      Los pedidos cierran a las {formatearHora12(horaLimite)}. No se pueden tomar más
                      pedidos hoy.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen del pedido */}
        <Card variant="raised" className="lg:sticky lg:top-6">
          <CardHeader className="pb-4">
            <p className="eyebrow">Tu pedido</p>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Resumen</CardTitle>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-leaf-50 px-2 text-xs font-bold text-leaf-800 ring-1 ring-leaf-600/10">
                {itemsDelMenu.length}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pb-5">
            {itemsDelMenu.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-6 text-center">
                <UtensilsCrossed className="mx-auto mb-2 h-6 w-6 text-stone-300" />
                <p className="text-sm font-medium text-stone-500">Aún no eliges tu plato</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
                  Selecciona un principal para ver el total.
                </p>
              </div>
            ) : (
              itemsDelMenu.map((item) => (
                <div key={item.platilloId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800">{item.nombre}</p>
                    <p className="text-[11px] text-stone-400">
                      {item.cantidad} x {formatCurrency(item.precioUnitario)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-stone-800">
                    {formatCurrency(item.precioUnitario * item.cantidad)}
                  </span>
                </div>
              ))
            )}

            <div className="border-t border-stone-200/80 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-500">
                  Total estimado
                </span>
                <span className="font-serif text-2xl font-bold text-stone-900">
                  {formatCurrency(totalSeleccionado)}
                </span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            <Button
              variant="ember"
              size="lg"
              className="w-full"
              disabled={pedidoCerrado || !selectedPrincipalId || confirmLoading}
              onClick={handleConfirmar}
            >
              {btnConfirmContent}
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-stone-400">
              {pedidoCerrado
                ? 'El plazo para pedir hoy ya cerró.'
                : 'Los pedidos se confirman antes de la hora límite de corte.'}
            </p>
          </CardFooter>
        </Card>
      </div>

      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-ember-200 bg-ember-50 p-4 text-sm text-ember-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
    </div>
  )
}
