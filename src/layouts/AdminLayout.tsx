import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { LogOut, ShieldUser, Menu, X, CreditCard, List, Utensils, Building } from 'lucide-react'
import Button from '../components/ui/button'
import { cn } from '../lib/utils'
import Avatar from '../components/ui/avatar'

const adminNavItems = [
  { to: '/admin/menu', label: 'Gestión de menú', icon: Utensils },
  { to: '/admin/pedidos', label: 'Pedidos del día', icon: List },
  { to: '/admin/cobranza', label: 'Cobranza quincenal', icon: CreditCard },
]

export default function AdminLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const isDesktop = window.matchMedia('(min-width: 768px)').matches

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh bg-stone-50">
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-stone-200 transform transition-transform duration-300 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-stone-200 shrink-0">
          <Link to="/admin/menu" className="flex items-center gap-2">
            <span className="font-bold text-leaf-900 text-lg tracking-tight font-serif">El Buen Sabor</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-md transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const active = window.location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-leaf-50 text-leaf-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                )}
              >
                <div className="w-5 h-5 flex-shrink-0">
                  <Icon className="w-full h-full" />
                </div>
                {item.label}
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 bg-leaf-600 rounded-full"></div>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-stone-200 shrink-0">
          <div className="px-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">Panel</p>
            <div className="flex items-center gap-2">
              <ShieldUser className="w-4 h-4 text-leaf-600" />
              <p className="text-xs font-medium text-stone-800">{profile?.nombre ?? 'Administrador'}</p>
            </div>
            <p className="text-[10px] text-stone-500 mt-1">{profile?.rol ?? 'administrador'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 justify-start px-3 text-left text-sm text-stone-700"
            onClick={async () => {
              await handleLogout()
              setSidebarOpen(false)
            }}
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && !isDesktop && (
        <div
          className="fixed inset-0 z-20 bg-stone-900/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 bg-white border border-stone-200 rounded-md shadow-md text-stone-700"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 border-b border-stone-200 bg-white/80 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-leaf-100 flex items-center justify-center text-leaf-700 font-bold text-sm">
              <Building className="w-4 h-4" />
            </div>
            <span className="font-bold text-stone-800 text-sm">Panel de administración</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar src={profile?.nombre ? profile.nombre.charAt(0) : undefined} size="default" />
            <span className="text-sm font-medium text-stone-700 hidden sm:inline">{profile?.nombre ?? 'Admin'}</span>
            <ShieldUser className="w-4 h-4 text-stone-400 hidden sm:inline" />
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isDesktop ? 'md:pl-64' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
