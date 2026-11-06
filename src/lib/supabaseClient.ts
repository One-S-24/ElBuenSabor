import { createClient } from '@supabase/supabase-js'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * En desarrollo la URL de Supabase suele apuntar a 127.0.0.1, lo que solo
 * funciona en la misma máquina. Si la página se abre desde otro dispositivo
 * de la red local (por ejemplo el teléfono), reemplazamos el host por el de
 * la página para que apunte a la misma máquina que sirve Vite.
 */
function resolveSupabaseUrl(envUrl: string | undefined): string {
  const fallback = envUrl ?? 'http://127.0.0.1:54321'
  if (typeof window === 'undefined') return fallback

  let parsed: URL
  try {
    parsed = new URL(fallback)
  } catch {
    return fallback
  }

  const currentHost = window.location.hostname
  if (LOOPBACK_HOSTS.has(currentHost)) return fallback

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return fallback

  parsed.hostname = currentHost
  return parsed.toString().replace(/\/$/, '')
}

const supabaseUrl = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
