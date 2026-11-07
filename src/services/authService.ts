import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

/**
 * Deja el teléfono en formato internacional.
 * Acepta 88887777, 50588887777 o +50588887777.
 */
export function normalizarTelefono(valor: string): string {
  const limpio = (valor ?? '').trim()
  if (!limpio) return ''

  const tieneMas = limpio.startsWith('+')
  const digitos = limpio.replace(/\D/g, '')
  if (!digitos) return ''

  if (tieneMas) return `+${digitos}`
  if (digitos.length === 8) return `+505${digitos}`
  if (digitos.startsWith('505') && digitos.length === 11) return `+${digitos}`
  return `+${digitos}`
}

export function telefonoValido(valor: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizarTelefono(valor))
}

export interface RegistroPayload {
  nombre: string
  email: string
  password: string
  telefono_whatsapp: string
}

export interface RegistroResultado {
  user: User
}

/**
 * Crea la cuenta en Supabase Auth y su perfil en `perfiles`.
 *
 * El proyecto tiene `enable_confirmations = false`, por lo que
 * `signUp` devuelve una sesión activa inmediatamente sin requerir
 * que el usuario confirme su correo. El trigger
 * `on_auth_user_created` (migración 20261107000001) crea el perfil
 * automáticamente desde los metadatos insertados en el sign‑up.
 *
 * El teléfono se guarda tanto en los metadatos del usuario como en el perfil,
 * porque de ahí lo toma la Edge Function de WhatsApp para enviar recordatorios.
 */
export async function registrarCliente(payload: RegistroPayload): Promise<RegistroResultado> {
  const nombre = payload.nombre.trim()
  const email = payload.email.trim().toLowerCase()
  const telefono = normalizarTelefono(payload.telefono_whatsapp)

  if (!nombre) throw new Error('Ingresa tu nombre completo.')
  if (!telefonoValido(telefono)) {
    throw new Error('Ingresa un número de WhatsApp válido. Ejemplo: 8888 7777.')
  }
  if (payload.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: payload.password,
    options: {
      data: {
        nombre,
        telefono_whatsapp: telefono,
        rol: 'cliente',
      },
    },
  })

  if (error) throw new Error('No se pudo crear la cuenta. Inténtalo de nuevo.')
  if (!data.user) throw new Error('No se pudo crear la cuenta. Inténtalo de nuevo.')

  // Con enable_confirmations = false, data.session siempre está presente
  // y el trigger on_auth_user_created ya creó el perfil. Solo devolvemos
  // el usuario; el resto lo maneja el sistema automáticamente.
  return {
    user: data.user,
  }
}

/**
 * Actualiza únicamente el teléfono del usuario autenticado.
 * Usa una RPC con `security definer` para no exponer el resto del perfil.
 */
export async function actualizarTelefono(telefono: string): Promise<string> {
  const normalizado = normalizarTelefono(telefono)
  if (!telefonoValido(normalizado)) {
    throw new Error('Ingresa un número de WhatsApp válido. Ejemplo: 8888 7777.')
  }

  const { data, error } = await supabase.rpc('actualizar_mi_telefono', {
    p_telefono: normalizado,
  })

  if (error) throw new Error(error.message)
  if (!data?.success) {
    throw new Error(data?.error || 'No se pudo actualizar el teléfono.')
  }

  return normalizado
}