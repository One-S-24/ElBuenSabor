import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Mail, Lock, AlertTriangle, UserPlus, ArrowRight, Building } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-4">
      <div className="relative w-full max-w-md z-10">
        {/* Decorative background element */}
        <div className="absolute -inset-1 bg-brand-200/30 rounded-2xl blur-3xl -z-10" />

        <Card className="shadow-2xl shadow-brand/10 border border-brand-100/50">
          <CardHeader className="text-center pb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/40">
              <Building className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-brand-700">Bienvenido</CardTitle>
            <CardDescription>
              Inicia sesión en Comedor El Buen Sabor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-rose-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <Input
                  placeholder="juan@ejemplo.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Contraseña
                </label>
                <Input
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  leftIcon={<Lock className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="brand" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <ArrowRight className="w-4 h-4 animate-spin mr-2" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Iniciar sesión
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardContent className="pt-0 border-t border-stone-50">
            <div className="text-center text-sm text-stone-600 space-y-3">
              <p>¿No tienes cuenta?</p>
              <button
                onClick={() => navigate('/login?register=true')}
                className="text-brand-600 font-medium underline underline-offset-4 hover:text-brand-700 flex items-center justify-center gap-1"
              >
                <UserPlus className="w-3 h-3" /> Crear cuenta
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
