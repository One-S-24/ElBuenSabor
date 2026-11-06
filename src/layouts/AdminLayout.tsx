import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { LogOut, ShieldUser, Menu, X, CreditCard, List, Utensils, Building, MessageCircle } from 'lucide-react'
import Button from '../components/ui/button'
import { cn } from '../lib/utils'
import Avatar from '../components/ui/avatar'

const adminNavItems = [
  { to: '/admin/menu', label: 'Gestión de menú', icon: Utensils },
  { to: '/admin/pedidos', label: 'Pedidos del día', icon: List },
  { to: '/admin/cobranza', label: 'Cobranza quincenal', icon: CreditCard },
  { to: '/admin/whatsapp', label: 'WhatsApp OpenWA', icon: MessageCircle },
]

export default function AdminLayout() {
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

  return (
    <div className="flex min-h-svh bg-stone-50">
      {/* Barra lateral: fija en escritorio, deslizable en móvil */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200 bg-white shadow-2xl transition-transform duration-300 md:z-30 md:translate-x-0 md:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
          <Link to="/admin/menu" className="flex min-w-0 items-center gap-2">
            <span className="truncate font-serif text-lg font-bold tracking-tight text-leaf-900">
              El Buen Sabor
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-700 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
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
                  'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-leaf-50 text-leaf-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className="h-full w-full" />
                </span>
                <span className="truncate">{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-600" />}
              </Link>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-stone-200 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Panel</p>
          <div className="mt-1 flex items-center gap-2">
            <Avatar name={profile?.nombre} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-stone-800">
                {profile?.nombre ?? 'Administrador'}
              </p>
              <p className="truncate text-[10px] capitalize text-stone-500">
                {profile?.rol ?? 'administrador'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-start px-3 text-left text-sm text-stone-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white/85 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              className="shrink-0 rounded-md border border-stone-200 bg-white p-2 text-stone-700 shadow-sm transition-colors hover:bg-stone-50 active:bg-stone-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-leaf-100 text-leaf-700 sm:flex">
              <Building className="h-4 w-4" />
            </div>
            <span className="truncate text-sm font-bold text-stone-800">
              <span className="sm:hidden">Panel</span>
              <span className="hidden sm:inline">Panel de administración</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Avatar name={profile?.nombre} size="default" />
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-stone-700 sm:inline">
              {profile?.nombre ?? 'Admin'}
            </span>
            <ShieldUser className="hidden h-4 w-4 text-stone-400 lg:inline" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
