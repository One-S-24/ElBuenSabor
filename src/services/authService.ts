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
  requiereConfirmacion: boolean
}

function traducirErrorAuth(mensaje: string): string {
  const texto = mensaje.toLowerCase()

  if (texto.includes('already registered') || texto.includes('already been registered')) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.'
  }
  if (texto.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (texto.includes('unable to validate email') || texto.includes('invalid email')) {
    return 'El correo electrónico no es válido.'
  }
  if (texto.includes('signups not allowed')) {
    return 'El registro está deshabilitado. Contacta al administrador.'
  }

  return mensaje
}

/**
 * Crea la cuenta en Supabase Auth y su perfil en `perfiles`.
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

  if (error) throw new Error(traducirErrorAuth(error.message))
  if (!data.user) throw new Error('No se pudo crear la cuenta. Inténtalo de nuevo.')

  // Con la confirmación de correo desactivada, Supabase devuelve una sesión.
  // La usamos para crear el perfil (la política RLS permite auth.uid() = id).
  if (data.session) {
    const { error: perfilError } = await supabase.from('perfiles').upsert(
      {
        id: data.user.id,
        nombre,
        telefono_whatsapp: telefono,
        rol: 'cliente',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

    if (perfilError) {
      throw new Error(`No se pudo crear el perfil: ${perfilError.message}`)
    }
  }

  return {
    user: data.user,
    requiereConfirmacion: !data.session,
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
