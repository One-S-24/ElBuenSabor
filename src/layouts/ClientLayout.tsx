import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Home, FileText, User, LogOut, Menu, X, UtensilsCrossed } from 'lucide-react'
import { cn } from '../lib/utils'
import Button from '../components/ui/button'
import Avatar from '../components/ui/avatar'
import { ClientRouteSkeleton } from '../components/ui/skeleton'

const navItems = [
  { to: '/', label: 'Inicio', short: 'Inicio', icon: Home },
  { to: '/pedidos', label: 'Mis pedidos', short: 'Pedidos', icon: FileText },
  { to: '/cuenta', label: 'Mi cuenta', short: 'Cuenta', icon: User },
]

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-leaf-600 text-white shadow-[0_10px_24px_-14px_rgba(20,83,45,0.9)]',
        className,
      )}
      aria-hidden="true"
    >
      <UtensilsCrossed className="h-5 w-5" />
    </span>
  )
}

export default function ClientLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

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

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const renderNav = (onNavigate?: () => void) =>
    navItems.map((item) => {
      const Icon = item.icon
      const active = isActive(item.to)
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200',
            active
              ? 'bg-leaf-50 text-leaf-800 ring-1 ring-leaf-600/10'
              : 'text-stone-500 hover:bg-stone-100/80 hover:text-stone-900',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
              active
                ? 'bg-leaf-700 text-white'
                : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-stone-700',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />}
        </Link>
      )
    })

  const renderAccount = (onLogout?: () => void) => (
    <div className="rounded-2xl border border-stone-200/80 bg-white/70 p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={profile?.nombre} size="default" className="ring-2 ring-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-stone-800">
            {profile?.nombre ?? 'Comensal'}
          </p>
          <p className="truncate text-[11px] text-stone-500">
            {profile?.telefono_whatsapp ?? 'Sin teléfono'}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start px-3 text-stone-500 hover:text-ember-700"
        onClick={onLogout ?? handleLogout}
      >
        <LogOut className="h-4 w-4 shrink-0" /> Cerrar sesión
      </Button>
    </div>
  )

  return (
    <div className="min-h-svh bg-brand-50">
      {/* Barra lateral de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200/80 bg-white/70 backdrop-blur-xl md:flex">
        <div className="flex h-20 shrink-0 items-center gap-3 px-5">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate font-serif text-base font-bold leading-tight tracking-tight text-stone-900">
                El Buen Sabor
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf-700">
                Comedor
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Navegación principal">
          <p className="eyebrow px-3 pt-2">Menú</p>
          {renderNav()}
        </nav>

        <div className="shrink-0 p-3">{renderAccount()}</div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-stone-200/70 bg-brand-50/85 px-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 transition-colors hover:bg-white active:bg-stone-100"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <BrandMark className="h-8 w-8 rounded-xl" />
          <span className="truncate font-serif text-base font-bold tracking-tight text-stone-900">
            El Buen Sabor
          </span>
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-stone-200 transition-colors hover:bg-white"
          aria-label="Abrir mi cuenta"
        >
          <Avatar name={profile?.nombre} size="sm" />
        </button>
      </header>

      {/* Menú móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-col bg-brand-50 shadow-2xl transition-transform duration-300 ease-out md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        aria-label="Menú lateral"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="truncate font-serif text-base font-bold tracking-tight text-stone-900">
              El Buen Sabor
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-stone-800"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Navegación móvil">
          <p className="eyebrow px-3 pt-2">Menú</p>
          {renderNav(() => setSidebarOpen(false))}
        </nav>
        <div className="shrink-0 p-3">
          {renderAccount(async () => {
            await handleLogout()
            setSidebarOpen(false)
          })}
        </div>
      </aside>

      {/* Contenido */}
      <main className="min-h-svh px-3 pb-32 pt-4 sm:px-6 sm:pt-6 md:pl-72 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">
          <React.Suspense fallback={<ClientRouteSkeleton />}>
            <Outlet />
          </React.Suspense>
        </div>
      </main>

      {/* Navegación inferior móvil tipo dock */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 mb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación rápida"
      >
        <div className="flex items-center justify-around gap-1 rounded-full border border-stone-200/80 bg-white/90 p-1.5 shadow-[0_18px_40px_-20px_rgba(28,25,23,0.45)] backdrop-blur-xl">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold transition-all duration-200',
                  active
                    ? 'bg-leaf-700 text-white shadow-[0_8px_18px_-10px_rgba(20,83,45,0.9)]'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.short}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
