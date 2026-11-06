import React, { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/useAuthStore'
import ClientLayout from '../layouts/ClientLayout'
import AdminLayout from '../layouts/AdminLayout'

/* Páginas (carga perezosa) */
const Login = React.lazy(() => import('../pages/Login'))
const ClientDashboard = React.lazy(() => import('../pages/ClientDashboard'))
const MisPedidos = React.lazy(() => import('../pages/MisPedidos'))
const MiCuenta = React.lazy(() => import('../pages/MiCuenta'))
const AdminMenu = React.lazy(() => import('../pages/AdminMenu'))
const AdminPedidos = React.lazy(() => import('../pages/AdminPedidos'))
const AdminCobranza = React.lazy(() => import('../pages/AdminCobranza'))
const AdminWhatsApp = React.lazy(() => import('../pages/AdminWhatsApp'))

const ProtectedClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile.rol !== 'cliente') {
    return <Navigate to="/admin/menu" replace />
  }

  return <>{children}</>
}

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile.rol !== 'administrador') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function AppRouter() {
  const { setUser, setProfile, setIsLoading, fetchProfile } = useAuthStore()

  // Restaurar sesión y mantener el usuario sincronizado con Supabase Auth
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted && data.session) {
          setUser(data.session.user)
          await fetchProfile()
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    initAuth()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setProfile(null)
      } else if (session) {
        setUser(session.user)
        await fetchProfile()
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [setUser, setProfile, fetchProfile])

  const { profile } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Cliente (mobile-first) */}
        <Route
          path="/"
          element={
            <ProtectedClientRoute>
              <ClientLayout />
            </ProtectedClientRoute>
          }
        >
          <Route index element={<ClientDashboard />} />
          <Route path="pedidos" element={<MisPedidos />} />
          <Route path="cuenta" element={<MiCuenta />} />
        </Route>

        {/* Administrador (desktop & tablet) */}
        <Route
          path="/admin/*"
          element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }
        >
          <Route path="menu" element={<AdminMenu />} />
          <Route path="pedidos" element={<AdminPedidos />} />
          <Route path="cobranza" element={<AdminCobranza />} />
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          <Route index element={<Navigate to="menu" replace />} />
        </Route>

        {/* Redirección raíz según rol cuando no hay layout envuelto */}
        <Route path="/" element={<Navigate to={profile?.rol === 'administrador' ? '/admin/menu' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
