import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import {
  Mail,
  Lock,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  Loader2,
  UtensilsCrossed,
  Wallet,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import Button from '../components/ui/button'
import Input from '../components/ui/input'

const beneficios = [
  {
    icon: UtensilsCrossed,
    title: 'Menú del día',
    desc: 'Elige tu plato principal y bebida en segundos.',
  },
  {
    icon: Wallet,
    title: 'Cuenta transparente',
    desc: 'Consulta tu saldo quincenal y tu historial.',
  },
  {
    icon: ShieldCheck,
    title: 'Pedido confirmado',
    desc: 'Recibe el aviso de confirmación por WhatsApp.',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca: escritorio */}
      <section className="relative hidden overflow-hidden bg-leaf-950 p-10 text-leaf-50 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(58rem_40rem_at_8%_-8%,rgba(74,222,128,0.3),transparent_62%),radial-gradient(42rem_30rem_at_100%_105%,rgba(194,65,12,0.32),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-400 text-leaf-950 shadow-lg">
              <UtensilsCrossed className="h-6 w-6" />
            </span>
            <div>
              <p className="font-serif text-xl font-bold leading-tight tracking-tight">El Buen Sabor</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-leaf-300/80">
                Comedor
              </p>
            </div>
          </div>

          <h1 className="mt-12 max-w-lg text-balance font-serif text-4xl font-bold leading-[1.05] tracking-tight text-white xl:text-5xl">
            El almuerzo de cada día, sin complicaciones.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-leaf-100/75">
            Pide desde el teléfono, revisa tu cuenta cuando quieras y deja que la cocina haga
            el resto. Así de simple.
          </p>

          <ul className="mt-10 space-y-4">
            {beneficios.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-leaf-200 ring-1 ring-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-[13px] leading-relaxed text-leaf-100/60">{item.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Muestra del menú del día */}
        <div className="relative mt-12 max-w-sm rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf-300/80">
              Menú de hoy
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-leaf-200 ring-1 ring-leaf-300/20">
              <Clock className="h-3 w-3" /> Hasta las 11:00 a. m.
            </span>
          </div>
          <p className="mt-3 font-serif text-lg font-semibold leading-snug text-white">
            Sopa de verduras · Pollo a la plancha · Refresco natural
          </p>
          <p className="mt-2 text-[13px] text-leaf-100/60">Un plato completo, todos los días.</p>
        </div>
      </section>

      {/* Formulario */}
      <section className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-8 lg:min-h-0 lg:py-12">
        <div className="w-full max-w-md">
          {/* Marca en móvil */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-600 text-white shadow-[0_12px_26px_-16px_rgba(20,83,45,0.9)]">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div>
              <p className="font-serif text-lg font-bold leading-tight tracking-tight text-stone-900">
                El Buen Sabor
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf-700">
                Comedor
              </p>
            </div>
          </div>

          <div className="surface rounded-3xl p-6 sm:p-8">
            <p className="eyebrow">Bienvenido</p>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Inicia sesión
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Usa tu correo para pedir tu almuerzo y consultar tu cuenta.
            </p>

            {error && (
              <div
                className="mt-5 flex items-start gap-2.5 rounded-2xl border border-ember-200 bg-ember-50 p-3.5 text-sm text-ember-700"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email">Correo electrónico</label>
                <Input
                  id="login-email"
                  placeholder="juan@ejemplo.com"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leftIcon={<Mail className="h-4 w-4" />}
                />
              </div>
              <div>
                <label htmlFor="login-password">Contraseña</label>
                <Input
                  id="login-password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </div>
              <Button type="submit" variant="leaf" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-stone-200/80 pt-5 text-center text-sm text-stone-500">
              <p>¿No tienes cuenta?</p>
              <button
                type="button"
                onClick={() => navigate('/login?register=true')}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-leaf-700 transition-colors hover:bg-leaf-50 hover:text-leaf-900"
              >
                <UserPlus className="h-3.5 w-3.5" /> Crear cuenta
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-stone-400">
            El Buen Sabor · Comedor institucional
          </p>
        </div>
      </section>
    </div>
  )
}
