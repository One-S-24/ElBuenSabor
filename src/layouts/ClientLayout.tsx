import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Home, FileText, User, LogOut, Settings, Bell } from 'lucide-react'
import { cn } from '../lib/utils'
import Button from '../components/ui/button'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/pedidos', label: 'Pedidos', icon: FileText },
  { to: '/cuenta', label: 'Mi Cuenta', icon: User },
]

export default function ClientLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-svh bg-brand-50 flex flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-brand-700 tracking-tight">El Buen Sabor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-2 rounded-xl text-stone-600 hover:bg-stone-100"
            aria-label="Cuenta"
          >
            <Settings className="w-5 h-5" />
          </button>
          <Bell className="w-5 h-5 text-stone-500" />
        </div>
      </header>

      {/* Account dropdown */}
      <div
        className={cn('fixed inset-0 z-40 pointer-events-none', open ? '' : 'hidden')}
        onClick={() => setOpen(false)}
      >
        <div className="pointer-events-auto absolute top-14 right-4 w-64 bg-white border border-stone-200 rounded-2xl shadow-lg py-2">
          {profile && (
            <>
              <div className="px-4 py-2 border-b border-stone-100">
                <p className="text-sm font-semibold text-stone-900">{profile.nombre}</p>
                <p className="text-xs text-stone-500">{profile.telefono_whatsapp}</p>
                <p className="text-xs text-brand-600 font-medium mt-1">
                  Rol: {profile.rol === 'administrador' ? 'Administrador' : 'Cliente'}
                </p>
              </div>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await handleLogout()
              setOpen(false)
            }}
            className="w-full justify-start px-4 text-left text-sm"
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex z-30">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = window.location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2 text-sm transition-colors',
                active ? 'text-brand-600' : 'text-stone-500 hover:text-stone-700'
              )}
            >
              <Icon className={cn('w-5 h-5', active ? 'text-brand-600' : 'text-stone-400')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
