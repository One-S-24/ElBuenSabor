export type Rol = 'cliente' | 'administrador'

export type EstadoPedido = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO_FUERA_DE_TIEMPO'

export type EstadoPago = 'AL_DIA' | 'PENDIENTE_PAGO' | 'MOROSO'

export type TipoPlatillo = 'principal' | 'bebida' | 'adicional'

export interface Profile {
  id: string
  nombre: string
  telefono_whatsapp: string
  limite_credito: number
  rol: Rol
  created_at: string
}

export interface Platillo {
  id: string
  menu_id: string
  nombre: string
  descripcion: string | null
  precio_unitario: number
  porciones_disponibles: number
  tipo: TipoPlatillo
  created_at: string
}

export interface MenuDiario {
  id: string
  fecha: string
  hora_limite_pedido: string
  activo: boolean
  created_at: string
}

export interface Pedido {
  id: string
  cliente_id: string
  fecha_hora: string
  estado: EstadoPedido
  total_calculado: number
}

export interface DetallePedido {
  id: string
  pedido_id: string
  platillo_id: string
  cantidad: number
  subtotal: number
}

export interface CuentaQuincenal {
  id: string
  cliente_id: string
  fecha_inicio: string
  fecha_fin: string
  total_acumulado: number
  estado_pago: EstadoPago
  updated_at: string
}

export interface CartItem {
  platilloId: string
  nombre: string
  precioUnitario: number
  cantidad: number
}

export interface RpcResult {
  success: boolean
  error?: string
  [key: string]: unknown
}
