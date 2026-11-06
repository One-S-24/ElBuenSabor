import { create } from 'zustand'
import type { CartItem, RpcResult } from '../lib/types'

export interface OrderState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (platilloId: string) => void
  updateCantidad: (platilloId: string, cantidad: number) => void
  clearCart: () => void
  submitOrder: (menuId: string, clienteId: string) => Promise<RpcResult>
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.platilloId === item.platilloId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.platilloId === item.platilloId
              ? { ...i, cantidad: i.cantidad + item.cantidad }
              : i
          ),
        }
      }
      return { items: [...state.items, item] }
    }),

  removeItem: (platilloId) =>
    set((state) => ({ items: state.items.filter((i) => i.platilloId !== platilloId) })),

  updateCantidad: (platilloId, cantidad) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.platilloId === platilloId
          ? { ...i, cantidad: Math.max(1, Math.trunc(cantidad)) }
          : i
      ),
    })),

  clearCart: () => set({ items: [] }),

  submitOrder: async (menuId, clienteId) => {
    const items = get().items
    if (items.length === 0) {
      return { success: false, error: 'El carrito está vacío' }
    }
    const { enviarPedido } = await import('../services/orderService')
    return enviarPedido(clienteId, menuId, items)
  },
}))
