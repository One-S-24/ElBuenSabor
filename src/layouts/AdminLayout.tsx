import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { LogOut, ShieldUser, Menu, X, CreditCard, List, Utensils, MessageCircle, UtensilsCrossed } from 'lucide-react'
import Button from '../components/ui/button'
import { cn } from '../lib/utils'
import Avatar from '../components/ui/avatar'
import { AdminRouteSkeleton } from '../components/ui/skeleton'

const adminNavItems = [
  { to: '/admin/menu', label: 'Gestión de menú', icon: Utensils },
  { to: '/admin/pedidos', label: 'Pedidos del día', icon: List },
  { to: '/admin/cobranza', label: 'Cobranza quincenal', icon: CreditCard },
  { to: '/admin/whatsapp', label: 'WhatsApp OpenWA', icon: MessageCircle },
]

/** El sidebar es fijo en escritorio y un drawer en móvil. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  )

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const handleChange = () => setIsDesktop(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}

export default function AdminLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const isDesktop = useIsDesktop()
  const drawerHidden = !sidebarOpen && !isDesktop

  React.useEffect(() => {
    if (!sidebarOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [sidebarOpen])

  React.useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  React.useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const seccionActual =
    adminNavItems.find((item) => location.pathname === item.to)?.label ?? 'Panel'

  return (
    <div className="flex min-h-svh bg-brand-50">
      {/* Barra lateral: fija en escritorio, deslizable en móvil */}
      <aside
        className={cn(
          'ink-surface fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 ease-out md:z-30 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={drawerHidden}
        inert={drawerHidden}
        aria-label="Navegación de administración"
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-4">
          <Link to="/admin/menu" className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-leaf-400/15 text-leaf-200 ring-1 ring-leaf-300/20"
              aria-hidden="true"
            >
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-base font-bold leading-tight tracking-tight text-leaf-50">
                El Buen Sabor
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf-300/80">
                Administración
              </span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-leaf-200/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf-300/60">
            Operación
          </p>
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                  active
                    ? 'bg-white/12 text-white ring-1 ring-white/15'
                    : 'text-leaf-100/70 hover:bg-white/8 hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                    active ? 'bg-leaf-400 text-leaf-950' : 'bg-white/5 text-leaf-200/70',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-300" />}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 p-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={profile?.nombre} size="default" className="ring-2 ring-white/20" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-white">
                  {profile?.nombre ?? 'Administrador'}
                </p>
                <p className="truncate text-[11px] capitalize text-leaf-300/80">
                  {profile?.rol ?? 'administrador'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-3 text-leaf-200/80 hover:bg-white/10 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 shrink-0" /> Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-stone-200/70 bg-brand-50/85 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400 sm:block">
                El Buen Sabor
              </p>
              <p className="truncate text-sm font-bold text-stone-800 sm:text-base">{seccionActual}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-leaf-800 sm:inline-flex">
              <ShieldUser className="h-3.5 w-3.5" /> Admin
            </span>
            <Avatar name={profile?.nombre} size="sm" className="ring-2 ring-white sm:h-10 sm:w-10" />
            <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-stone-700 lg:inline">
              {profile?.nombre ?? 'Admin'}
            </span>
          </div>
        </header>

        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <React.Suspense fallback={<AdminRouteSkeleton />}>
              <Outlet />
            </React.Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
