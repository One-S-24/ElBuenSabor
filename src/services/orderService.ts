import { supabase } from '../lib/supabaseClient'
import type { CartItem, RpcResult } from '../lib/types'

export const enviarPedido = async (
  clienteId: string,
  menuId: string,
  items: CartItem[]
): Promise<RpcResult> => {
  const formattedItems = items.map((item) => ({
    platillo_id: item.platilloId,
    cantidad: item.cantidad,
  }))

  const { data, error } = await supabase.rpc('crear_pedido_diario', {
    p_cliente_id: clienteId,
    p_menu_id: menuId,
    p_items: formattedItems,
  })

  if (error) return { success: false, error: error.message }
  return data as RpcResult
}
