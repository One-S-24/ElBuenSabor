import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Mail, Lock, AlertTriangle, UserPlus, ArrowRight, Building } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
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
    <div className="flex min-h-svh items-center justify-center bg-leaf-50 px-4">
      <div className="relative w-full max-w-md z-10">
        <Card className="shadow-xl shadow-leaf/10 border border-leaf-100/50 raised">
          <CardHeader className="text-center pb-8">
            <div className="w-12 h-12 rounded-md bg-leaf-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-leaf/40">
              <Building className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-leaf-900 font-serif">El Buen Sabor</CardTitle>
            <CardDescription>
              Inicia sesión para pedir tu almuerzo diario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-ember-50 border border-ember-200 p-3 text-ember-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-600 tracking-wider">Correo electrónico</label>
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
                <label className="text-xs font-semibold text-stone-600 tracking-wider">Contraseña</label>
                <Input
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  leftIcon={<Lock className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="leaf" className="w-full" disabled={isLoading}>
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
          <CardContent className="pt-0 border-t border-stone-100">
            <div className="text-center text-sm text-stone-600 space-y-3">
              <p>¿No tienes cuenta?</p>
              <button
                onClick={() => navigate('/login?register=true')}
                className="text-leaf-600 font-medium underline underline-offset-4 hover:text-leaf-900 flex items-center justify-center gap-1"
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
