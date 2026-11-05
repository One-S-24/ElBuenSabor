import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
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
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isDesktop = window.matchMedia('(min-width: 768px)').matches

  return (
    <div className="min-h-svh bg-brand-50">
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 fixed inset-y-0 left-0 z-20">
          <div className="flex items-center justify-between h-16 px-5 border-b border-stone-200 shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-bold text-leaf-900 text-lg tracking-tight font-serif">El Buen Sabor</span>
            </Link>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = window.location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
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
              <p className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">Cuenta</p>
              <div className="flex items-center gap-2 mb-2">
                <Avatar src={profile?.nombre ? profile.nombre.charAt(0) : undefined} size="sm" />
                <div>
                  <p className="text-xs font-medium text-stone-800 leading-tight">{profile?.nombre ?? ''}</p>
                  <p className="text-[10px] text-stone-500">{profile?.telefono_whatsapp ?? ''}</p>
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
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        </aside>
      )}

      {/* Mobile Topbar */}
      {!isDesktop && (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 rounded-md text-stone-600 hover:bg-stone-100 transition-colors md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 md:ml-4">
            <span className="font-bold text-leaf-900 text-lg tracking-tight font-serif">El Buen Sabor</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="Cuenta de usuario"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="relative">
              <button className="p-2.5 rounded-md text-stone-500 hover:bg-stone-100 transition-colors relative group">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-ember-600 rounded-full animate-ping border-2 border-white"></span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Sidebar Overlay */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-stone-900/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {!isDesktop && sidebarOpen && (
        <aside className={cn(
          'fixed inset-y-0 left-0 z-40 w-80 bg-white transform transition-transform duration-300 flex flex-col md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-stone-200 shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-bold text-leaf-900 text-lg tracking-tight font-serif">El Buen Sabor</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = window.location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
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
              <p className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">Cuenta</p>
              <div className="flex items-center gap-2 mb-2">
                <Avatar src={profile?.nombre ? profile.nombre.charAt(0) : undefined} size="sm" />
                <div>
                  <p className="text-xs font-medium text-stone-800 leading-tight">{profile?.nombre ?? ''}</p>
                  <p className="text-[10px] text-stone-500">{profile?.telefono_whatsapp ?? ''}</p>
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
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        </aside>
      )}

      <main className={`flex-1 overflow-y-auto ${isDesktop ? 'md:pl-64' : ''} p-4 sm:p-6`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      {!isDesktop && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-stone-200 flex z-30 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = window.location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'text-leaf-600'
                    : 'text-stone-400 hover:text-stone-600'
                )}
              >
                <div className={cn('relative w-6 h-6', active ? 'text-leaf-600' : 'text-stone-400')}>
                  <Icon className="w-5 h-5" />
                  {active && (
                    <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-leaf-600 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
