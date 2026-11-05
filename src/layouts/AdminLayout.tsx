import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { LogOut, ShieldUser, Menu, X, CreditCard, List, Utensils, Building } from 'lucide-react'
import Button from '../components/ui/button'
import { cn } from '../lib/utils'

const adminNavItems = [
  { to: '/admin/menu', label: 'Gestión de Menú', icon: Utensils },
  { to: '/admin/pedidos', label: 'Pedidos del Día', icon: List },
  { to: '/admin/cobranza', label: 'Cobranza Quincenal', icon: CreditCard },
]

export default function AdminLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh bg-brand-50">
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-stone-200 transform transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-stone-200">
          <span className="font-bold text-brand-700 text-lg">El Buen Sabor</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-stone-500 hover:text-stone-700"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const active = window.location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-stone-200">
          <p className="text-xs text-stone-500 mb-3">Administrador</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await handleLogout()
              setSidebarOpen(false)
            }}
            className="w-full justify-start text-sm"
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-stone-900/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-white border border-stone-300 rounded-xl text-stone-700"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 border-b border-stone-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-brand-600" />
            <span className="font-bold text-stone-800">Panel de Administración</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500">
              {profile?.nombre ?? 'Admin'}
            </span>
            <ShieldUser className="w-5 h-5 text-stone-500" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
