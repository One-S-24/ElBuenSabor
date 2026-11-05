import { supabase } from '../lib/supabaseClient'
import type { RpcResult } from '../lib/types'

export const getCuentaActual = async (clienteId: string): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('obtener_cuenta_actual', {
    p_cliente_id: clienteId,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}

export const getHistorialCuentas = async (
  clienteId: string,
  limit = 12
): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('historial_cuentas_cliente', {
    p_cliente_id: clienteId,
    p_limit: limit,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}
