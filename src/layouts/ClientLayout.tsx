import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Home, FileText, User, LogOut, Settings, Bell } from 'lucide-react'
import { cn } from '../lib/utils'
import Button from '../components/ui/button'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/pedidos', label: 'Pedidos', icon: FileText },
  { to: '/cuenta', label: 'Cuenta', icon: User },
]

export default function ClientLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-svh bg-brand-50 flex flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-100 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-700 tracking-tight">El Buen Sabor</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="p-2.5 rounded-2xl text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Cuenta de usuario"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="relative">
            <button className="p-2.5 rounded-2xl text-stone-500 hover:bg-stone-100 transition-colors relative group">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping border-2 border-white"></span>
            </button>
          </div>
        </div>
      </header>

      {/* User menu dropdown */}
      <div
        className={cn('fixed inset-0 z-40 pointer-events-none', userMenuOpen ? '' : 'hidden')}
        onClick={() => setUserMenuOpen(false)}
      >
        <div className="pointer-events-auto absolute top-14 right-4 w-72 bg-white border border-stone-100 rounded-3xl shadow-2xl py-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="px-4 py-3 border-b border-stone-50">
            <div className="flex items-center gap-3 mb-2">
              <Avatar src={profile?.nombre ? profile.nombre.charAt(0) : undefined} size="sm" />
              <div>
                <p className="text-sm font-semibold text-stone-900 leading-tight">{profile?.nombre}</p>
                <p className="text-xs text-stone-500">{profile?.telefono_whatsapp}</p>
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
              Rol: {profile?.rol === 'administrador' ? 'Administrador' : 'Cliente'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await handleLogout()
              setUserMenuOpen(false)
            }}
            className="w-full justify-start px-4 text-left text-sm text-stone-700 hover:text-brand-700"
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Outlet />
      </main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-stone-100 flex z-30 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = window.location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setUserMenuOpen(false)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'text-brand-600'
                  : 'text-stone-400 hover:text-stone-600'
              )}
            >
              <div className={cn('relative w-6 h-6', active ? 'text-brand-600' : 'text-stone-400')}>
                <Icon className="w-5 h-5" />
                {active && (
                  <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-brand-600 rounded-full border-2 border-white"></div>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

import Avatar from '../components/ui/avatar'
