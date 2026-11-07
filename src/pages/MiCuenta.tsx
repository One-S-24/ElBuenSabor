import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getCuentaActual, getHistorialCuentas } from '../services/accountService'
import { getPedidosEnRango } from '../services/adminService'
import { actualizarTelefono } from '../services/authService'
import { formatCurrency } from '../lib/utils'
import { formatearFechaHoraManagua, formatearFechaISO } from '../lib/date'
import { Check, ChevronRight, Clock, History, Loader2, Mail, Pencil, Phone, Wallet, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Badge from '../components/ui/badge'
import Avatar from '../components/ui/avatar'
import Button from '../components/ui/button'
import Input from '../components/ui/input'
import { Skeleton, SkeletonText } from '../components/ui/skeleton'
import { cn } from '../lib/utils'

const estadoBadge: Record<string, string> = {
  AL_DIA: 'success',
  PENDIENTE_PAGO: 'warning',
  MOROSO: 'error',
}

const estadoTexto: Record<string, string> = {
  AL_DIA: 'Al día',
  PENDIENTE_PAGO: 'Pendiente de pago',
  MOROSO: 'Moroso',
}

export default function MiCuenta() {
  const { profile, user, fetchProfile } = useAuthStore()
  const clienteId = profile?.id
  const [cuenta, setCuenta] = useState<any>(null)
  const [detalle, setDetalle] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null)
  const [periodoDetalle, setPeriodoDetalle] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [editandoTelefono, setEditandoTelefono] = useState(false)
  const [telefonoInput, setTelefonoInput] = useState('')
  const [guardandoTelefono, setGuardandoTelefono] = useState(false)
  const [errorTelefono, setErrorTelefono] = useState('')

  const abrirEdicionTelefono = () => {
    setTelefonoInput(profile?.telefono_whatsapp ?? '')
    setErrorTelefono('')
    setEditandoTelefono(true)
  }

  const cancelarEdicionTelefono = () => {
    setEditandoTelefono(false)
    setErrorTelefono('')
  }

  const guardarTelefono = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorTelefono('')
    setGuardandoTelefono(true)
    try {
      const telefono = await actualizarTelefono(telefonoInput)
      await fetchProfile()
      setTelefonoInput(telefono)
      setEditandoTelefono(false)
    } catch (err: any) {
      setErrorTelefono(err.message || 'No se pudo actualizar el teléfono')
    } finally {
      setGuardandoTelefono(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      if (!clienteId) return
      try {
        setLoading(true)
        const [ctaRes, histRes] = await Promise.all([
          getCuentaActual(clienteId),
          getHistorialCuentas(clienteId, 12),
        ])
        if (mounted) {
          if (ctaRes.success) {
            setCuenta(ctaRes.cuenta ?? null)
            setDetalle(Array.isArray(ctaRes.detalle) ? ctaRes.detalle : [])
          }
          if (histRes.success) setHistorial(Array.isArray(histRes.historial) ? histRes.historial : [])
        }
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

  const verPeriodo = async (fechaInicio: string, fechaFin: string) => {
    setSelectedPeriodo(`${fechaInicio} al ${fechaFin}`)
    try {
      const data = await getPedidosEnRango(clienteId!, fechaInicio, fechaFin)
      setPeriodoDetalle(data)
    } catch (err: any) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando estado de cuenta…</span>

        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="surface flex items-center gap-4 rounded-2xl p-5 sm:p-6">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </div>
          <div className="rounded-3xl bg-leaf-900 p-5 shadow-[var(--shadow-float)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-2.5 w-32 bg-white/15" />
              <Skeleton className="h-5 w-24 rounded-full bg-white/15" />
            </div>
            <Skeleton className="mt-5 h-10 w-40 bg-white/15" />
            <Skeleton className="mt-3 h-2.5 w-48 bg-white/10" />
          </div>
        </div>

        <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
          <Skeleton className="h-6 w-56 max-w-full" />
          {[0, 1, 2].map((day) => (
            <div key={day} className="space-y-3 rounded-2xl border border-stone-200/70 p-3.5">
              <Skeleton className="h-2.5 w-24" />
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>

        <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 rounded-2xl border border-stone-200/70 p-4">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-5 w-24" />
                <SkeletonText lines={1} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const estado = cuenta?.estado_pago ?? 'AL_DIA'

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="min-w-0">
        <p className="eyebrow">Mi cuenta</p>
        <h1 className="text-stone-900">Estado de cuenta</h1>
        <p className="mt-1.5 text-sm text-stone-500">
          Tu saldo acumulado, el consumo de la quincena y tu historial.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] sm:gap-5">
        {/* Perfil */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <Avatar name={profile?.nombre} size="xl" className="ring-4 ring-leaf-50" />
            <div className="min-w-0 flex-1">
              <Badge variant="brand" className="mb-2">
                Cliente
              </Badge>
              <p className="truncate font-serif text-xl font-semibold text-stone-900">
                {profile?.nombre ?? 'Cliente'}
              </p>
              <div className="mt-1.5 space-y-1">
                {editandoTelefono ? (
                  <form onSubmit={guardarTelefono} className="space-y-2">
                    <label htmlFor="perfil-telefono" className="sr-only">
                      Número de WhatsApp
                    </label>
                    <Input
                      id="perfil-telefono"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="8888 7777"
                      value={telefonoInput}
                      onChange={(e) => setTelefonoInput(e.target.value)}
                      required
                      leftIcon={<Phone className="h-4 w-4" />}
                      className="h-10 text-xs"
                    />
                    <p className="text-[11px] text-stone-400">
                      Puedes escribir 8888 7777 o +505 8888 7777.
                    </p>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={guardandoTelefono}>
                        {guardandoTelefono ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Guardar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelarEdicionTelefono}
                        disabled={guardandoTelefono}
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                    {errorTelefono && (
                      <p className="break-words text-[11px] font-medium text-ember-700" role="alert">
                        {errorTelefono}
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-leaf-600" />
                    <span className="truncate text-xs text-stone-500">
                      {profile?.telefono_whatsapp || 'Sin teléfono registrado'}
                    </span>
                    <button
                      type="button"
                      onClick={abrirEdicionTelefono}
                      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-leaf-700 transition-colors hover:bg-leaf-50 hover:text-leaf-900"
                      aria-label="Editar número de WhatsApp"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  </div>
                )}
                {user?.email && (
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-leaf-600" />
                    <span className="truncate">{user.email}</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo actual */}
        <Card variant="ink" className="relative overflow-hidden">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
          <CardContent className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-leaf-200 ring-1 ring-white/10">
                  <Wallet className="h-4 w-4" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf-300/80">
                  Saldo quincena actual
                </p>
              </div>
              <Badge variant={estadoBadge[estado] as any}>{estadoTexto[estado] ?? estado}</Badge>
            </div>

            <p className="mt-4 font-serif text-4xl font-bold leading-none text-white">
              {formatCurrency(cuenta?.total_acumulado ?? 0)}
            </p>
            <p className="mt-2 text-xs text-leaf-100/60">
              {cuenta
                ? `${formatearFechaISO(cuenta.fecha_inicio)} al ${formatearFechaISO(cuenta.fecha_fin)}`
                : 'Sin quincena activa'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de la quincena actual */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Consumo</p>
            <CardTitle>Platillos de esta quincena</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">Detalle día por día de tu consumo actual.</p>
          </div>
          <span className="shrink-0 rounded-full bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-800 ring-1 ring-leaf-600/10">
            {detalle.length} día(s)
          </span>
        </CardHeader>
        <CardContent>
          {detalle.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center">
              <Clock className="mb-3 h-8 w-8 text-stone-300" />
              <p className="text-sm font-medium text-stone-600">
                No hay consumos registrados en esta quincena.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {detalle.map((dia: any, i: number) => {
                const items = dia.items ?? []
                return (
                  <div key={i} className="rounded-2xl border border-stone-200/80 bg-white/60 p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-leaf-600" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                        {formatearFechaISO(dia.fecha)}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item: any, j: number) => (
                        <div key={j} className="flex items-start justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600">
                              {item.cantidad}x
                            </span>
                            <span className="break-words text-stone-700">{item.platillo}</span>
                          </div>
                          <span className="shrink-0 font-semibold text-stone-900">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-leaf-50 px-4 py-3 ring-1 ring-leaf-600/10">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-leaf-800">
                  Total quincena
                </span>
                <span className="font-serif text-xl font-bold text-leaf-900">
                  {formatCurrency(cuenta?.total_acumulado ?? 0)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial y filtro de quincenas anteriores */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Historial</p>
            <CardTitle>Quincenas anteriores</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">
              Toca una quincena para revisar sus pedidos.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">
            {historial.length} registro(s)
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {historial.map((c) => {
              const clave = `${c.fecha_inicio} al ${c.fecha_fin}`
              const activo = selectedPeriodo === clave
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => verPeriodo(c.fecha_inicio, c.fecha_fin)}
                  aria-pressed={activo}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                    activo
                      ? 'border-leaf-600 bg-leaf-50 ring-1 ring-leaf-600/20'
                      : 'border-stone-200 bg-white hover:border-leaf-300 hover:bg-leaf-50/40',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                      {formatearFechaISO(c.fecha_inicio, { month: 'short', day: 'numeric' })} ·{' '}
                      {formatearFechaISO(c.fecha_fin, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="mt-0.5 block truncate font-serif text-lg font-bold text-stone-900">
                      {formatCurrency(c.total_acumulado)}
                    </span>
                    <span className="block truncate text-[11px] text-stone-500">
                      {estadoTexto[c.estado_pago] ?? c.estado_pago}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform',
                      activo ? 'translate-x-0.5 text-leaf-700' : 'text-stone-300',
                    )}
                  />
                </button>
              )
            })}
            {historial.length === 0 && (
              <span className="col-span-full py-4 text-center text-sm text-stone-400">
                No hay quincenas anteriores.
              </span>
            )}
          </div>

          {selectedPeriodo && (
            <div className="rounded-2xl border border-stone-200/80 bg-white/60 p-4">
              <div className="mb-3 flex items-start gap-2">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" />
                <span className="min-w-0 break-words text-sm font-semibold text-stone-800">
                  Detalle: {selectedPeriodo}
                </span>
              </div>
              {periodoDetalle.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-500">Sin pedidos en este período.</p>
              ) : (
                <div className="space-y-2">
                  {periodoDetalle.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 border-b border-stone-200/70 pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700">
                          {formatearFechaHoraManagua(p.fecha_hora, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                        <p className="mt-0.5 break-words text-[11px] text-stone-500">
                          {(p.detalle_pedidos ?? [])
                            .map((d: any) => `${d.cantidad}x ${d.platillos?.nombre ?? 'Platillo'}`)
                            .join(' · ')}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-stone-900">
                        {formatCurrency(p.total_calculado)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-end gap-2 border-t border-stone-200/70 pt-3 text-sm">
                    <span className="text-stone-500">Total:</span>
                    <span className="font-serif text-base font-bold text-stone-900">
                      {formatCurrency(periodoDetalle.reduce((s, p) => s + p.total_calculado, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
