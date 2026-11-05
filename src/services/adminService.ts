import { supabase } from '../lib/supabaseClient'
import type {
  MenuDiario,
  Platillo,
  Pedido,
  RpcResult,
} from '../lib/types'

/* ---------- Menú diario ---------- */

export const getMenusHoy = async (): Promise<MenuDiario[]> => {
  const hoy = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('menus_diarios')
    .select('*')
    .eq('fecha', hoy)
  if (error) throw error
  return (data ?? []) as MenuDiario[]
}

export const getMenus = async (): Promise<MenuDiario[]> => {
  const { data, error } = await supabase.from('menus_diarios').select('*').order('fecha', { ascending: false })
  if (error) throw error
  return (data ?? []) as MenuDiario[]
}

export const getPlatillosPorMenu = async (menuId: string): Promise<Platillo[]> => {
  const { data, error } = await supabase
    .from('platillos')
    .select('*')
    .eq('menu_id', menuId)
    .order('tipo', { ascending: true })
  if (error) throw error
  return (data ?? []) as Platillo[]
}

export const actualizarMenu = async (
  id: string,
  fecha: string,
  horaLimite: string,
  activo: boolean
) => {
  const { data, error } = await supabase
    .from('menus_diarios')
    .update({ fecha, hora_limite_pedido: horaLimite, activo })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const crearMenu = async (fecha: string, horaLimite: string = '11:00:00') => {
  const { data, error } = await supabase
    .from('menus_diarios')
    .insert({ fecha, hora_limite_pedido: horaLimite, activo: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export const guardarPlatillo = async (platillo: Partial<Platillo> & { menu_id: string }) => {
  if (platillo.id) {
    const { id, ...rest } = platillo
    const { data, error } = await supabase
      .from('platillos')
      .update(rest)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('platillos').insert(platillo).select().single()
  if (error) throw error
  return data
}

export const eliminarPlatillo = async (id: string) => {
  const { error } = await supabase.from('platillos').delete().eq('id', id)
  if (error) throw error
}

/* ---------- Pedidos del día ---------- */

export const getPedidosCliente = async (clienteId: string): Promise<Pedido[]> => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, perfiles( nombre ), detalle_pedidos( *, platillos( nombre, precio_unitario, tipo ) )')
    .eq('cliente_id', clienteId)
    .order('fecha_hora', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Pedido[]
}

export const getPedidosEnRango = async (
  clienteId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<Pedido[]> => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, perfiles( nombre ), detalle_pedidos( *, platillos( nombre, precio_unitario, tipo ) )')
    .eq('cliente_id', clienteId)
    .gte('fecha_hora', `${fechaInicio}T00:00:00Z`)
    .lt('fecha_hora', `${fechaFin}T23:59:59Z`)
    .order('fecha_hora', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Pedido[]
}

export const getPedidosQuincena = async (
  fechaInicio: string,
  fechaFin: string
): Promise<Pedido[]> => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, perfiles( nombre ), detalle_pedidos( *, platillos( nombre ) )')
    .gte('fecha_hora', `${fechaInicio}T00:00:00Z`)
    .lt('fecha_hora', `${fechaFin}T23:59:59Z`)
    .eq('estado', 'CONFIRMADO')
    .order('fecha_hora', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Pedido[]
}

export const getPedidosDelDia = async (): Promise<Pedido[]> => {
  const hoy = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, perfiles( nombre ), detalle_pedidos( *, platillos( nombre, precio_unitario, tipo ) )')
    .gte('fecha_hora', `${hoy}T00:00:00Z`)
    .lt('fecha_hora', `${hoy}T23:59:59Z`)
    .order('fecha_hora', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Pedido[]
}

/* ---------- Cobranza quincenal ---------- */

export const ejecutarCorteQuincenal = async (
  fechaInicio: string,
  fechaFin: string
): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('ejecutar_corte_quincenal', {
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}

export const obtenerMorososParaNotificar = async (
  fechaInicio: string,
  fechaFin: string
): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('obtener_morosos_para_notificar', {
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}

export const registrarPagoCuenta = async (
  cuentaId: string,
  monto: number,
  metodo = 'EFECTIVO',
  referencia?: string,
  observaciones?: string
): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('registrar_pago_cuenta', {
    p_cuenta_id: cuentaId,
    p_monto: monto,
    p_metodo: metodo,
    p_referencia: referencia ?? null,
    p_observaciones: observaciones ?? null,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}

export const getPlantillas = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('whatsapp_plantillas')
    .select('*')
    .eq('activa', true)
  if (error) throw error
  return data ?? []
}

export const enviarNotificacionWhatsApp = async (
  clienteId: string,
  plantillaId: string,
  variables: Record<string, unknown>,
  configId?: string,
  tipoNotificacion = 'recordatorio_pago'
): Promise<RpcResult> => {
  const { data, error } = await supabase.rpc('enviar_notificacion_whatsapp', {
    p_cliente_id: clienteId,
    p_plantilla_id: plantillaId,
    p_variables: variables,
    p_config_id: configId ?? null,
    p_tipo_notificacion: tipoNotificacion,
  })
  if (error) return { success: false, error: error.message }
  return data as RpcResult
}
