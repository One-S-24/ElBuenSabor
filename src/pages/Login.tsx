import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { Mail, Lock, AlertTriangle, UserPlus } from 'lucide-react'
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
    <div className="flex min-h-svh items-center justify-center bg-brand-50 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-brand-700">Bienvenido</CardTitle>
          <CardDescription>
            Inicia sesión en Comedor El Buen Sabor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-700">Correo electrónico</label>
              <Input
                placeholder="juan@ejemplo.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                leftIcon={<Mail className="w-4 h-4 text-stone-400" />}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-700">Contraseña</label>
              <Input
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                leftIcon={<Lock className="w-4 h-4 text-stone-400" />}
              />
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>
        </CardContent>
        <CardContent className="pt-0 border-t border-stone-200">
          <div className="text-center text-sm text-stone-600">
            ¿No tienes cuenta?{' '}
            <button
              onClick={() => navigate('/login?register=true')}
              className="text-brand-600 font-medium underline underline-offset-4 hover:text-brand-700"
            >
              <UserPlus className="w-3 h-3 inline mr-1" /> Crear cuenta
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
