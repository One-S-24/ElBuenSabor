import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Home, FileText, User, LogOut, Settings, Bell, Menu, X } from 'lucide-react'
import { cn } from '../lib/utils'
import Button from '../components/ui/button'
import Avatar from '../components/ui/avatar'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/pedidos', label: 'Pedidos', icon: FileText },
  { to: '/cuenta', label: 'Cuenta', icon: User },
]

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

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <div className="min-h-svh bg-brand-50">
      {/* Barra lateral de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white md:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-stone-200 px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold tracking-tight text-leaf-900">
              El Buen Sabor
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-leaf-50 text-leaf-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className="h-full w-full" />
                </span>
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-leaf-600" />}
              </Link>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-stone-200 p-4">
          <div className="px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Cuenta
            </p>
            <div className="mb-2 flex items-center gap-2">
              <Avatar name={profile?.nombre} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium leading-tight text-stone-800">
                  {profile?.nombre ?? ''}
                </p>
                <p className="truncate text-[10px] text-stone-500">
                  {profile?.telefono_whatsapp ?? ''}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start px-3 text-left text-sm text-stone-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-stone-200 bg-white/85 px-3 py-2.5 backdrop-blur-md md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-md p-2.5 text-stone-600 transition-colors hover:bg-stone-100 active:bg-stone-200"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="min-w-0 truncate px-1">
          <span className="font-serif text-lg font-bold tracking-tight text-leaf-900">
            El Buen Sabor
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2.5 text-stone-600 transition-colors hover:bg-stone-100 active:bg-stone-200"
            aria-label="Cuenta de usuario"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            className="relative rounded-md p-2.5 text-stone-500 transition-colors hover:bg-stone-100 active:bg-stone-200"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-ember-600" />
          </button>
        </div>
      </header>

      {/* Menú móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl transition-transform duration-300 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold tracking-tight text-leaf-900">
              El Buen Sabor
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-leaf-50 text-leaf-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className="h-full w-full" />
                </span>
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-leaf-600" />}
              </Link>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-stone-200 p-4">
          <div className="px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Cuenta
            </p>
            <div className="mb-2 flex items-center gap-2">
              <Avatar name={profile?.nombre} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium leading-tight text-stone-800">
                  {profile?.nombre ?? ''}
                </p>
                <p className="truncate text-[10px] text-stone-500">
                  {profile?.telefono_whatsapp ?? ''}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start px-3 text-left text-sm text-stone-700"
            onClick={async () => {
              await handleLogout()
              setSidebarOpen(false)
            }}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="min-h-svh p-4 pb-28 sm:p-6 sm:pb-28 md:pl-72 md:pb-8">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Navegación inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.35)] backdrop-blur md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-colors',
                active ? 'text-leaf-600' : 'text-stone-400 hover:text-stone-600',
              )}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Icon className="h-5 w-5" />
                {active && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border-2 border-white bg-leaf-600" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
