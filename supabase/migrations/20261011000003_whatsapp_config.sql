-- ==========================================
-- MIGRACIÓN: Configuración WhatsApp y Plantillas
-- ==========================================

-- Tabla configuración de proveedores WhatsApp
create table public.whatsapp_config (
    id uuid default uuid_generate_v4() primary key,
    proveedor text check (proveedor in ('twilio', 'gupshup', 'wati', 'oficial', 'personalizado')) not null,
    nombre_config text not null,
    api_url text not null,
    api_key text not null,           -- Se encripta en frontend o se usa vault
    telefono_origen text not null,   -- Número verificado del negocio
    activo boolean default true,
    configuracion_extra jsonb default '{}', -- Parámetros específicos del proveedor
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla plantillas de mensajes
create table public.whatsapp_plantillas (
    id uuid default uuid_generate_v4() primary key,
    nombre text not null unique,
    descripcion text,
    tipo text check (tipo in ('corte_quincenal', 'recordatorio_pago', 'pedido_confirmado', 'stock_bajo', 'personalizado')) not null,
    contenido text not null,         -- Plantilla con variables {{variable}}
    variables_requeridas text[] not null default '{}',
    activa boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Extender bitacora_notificaciones para trazabilidad completa
alter table public.bitacora_notificaciones
add column if not exists plantilla_id uuid references public.whatsapp_plantillas(id),
add column if not exists config_id uuid references public.whatsapp_config(id),
add column if not exists tipo_notificacion text check (tipo_notificacion in ('corte_quincenal', 'recordatorio_pago', 'pedido_confirmado', 'stock_bajo', 'personalizado')),
add column if not exists reintentos integer default 0,
add column if not exists proximo_reintento timestamp with time zone;

-- Índices
create index idx_bitacora_cliente_fecha on public.bitacora_notificaciones(cliente_id, created_at desc);
create index idx_bitacora_estado on public.bitacora_notificaciones(enviado_exitosamente);
create index idx_bitacora_reintento on public.bitacora_notificaciones(proximo_reintento) where proximo_reintento is not null;

-- RLS
alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_plantillas enable row level security;

-- Políticas
create policy "Admin gestiona config WhatsApp" on public.whatsapp_config
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Admin gestiona plantillas" on public.whatsapp_plantillas
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

-- Plantillas por defecto
insert into public.whatsapp_plantillas (nombre, descripcion, tipo, contenido, variables_requeridas, activa) values
('Corte Quincenal Estándar', 'Notificación de corte quincenal con monto a pagar', 'corte_quincenal',
'🍽️ *Comedor El Buen Sabor* - Corte Quincenal

Hola *{{nombre}}*,

Te informamos tu estado de cuenta del {{fecha_inicio}} al {{fecha_fin}}:

💰 *Total a pagar:* C$ {{monto}}
📋 *Período:* Quincena del {{fecha_inicio}} al {{fecha_fin}}

Por favor realiza tu pago a la brevedad posible. Puedes pagar en efectivo en el comedor o por transferencia.

¡Gracias por tu preferencia!
_Equipo El Buen Sabor_',
ARRAY['nombre', 'fecha_inicio', 'fecha_fin', 'monto'], true),

('Recordatorio Pago Vencido', 'Recordatorio para clientes morosos', 'recordatorio_pago',
'⚠️ *Recordatorio de Pago* - Comedor El Buen Sabor

Hola *{{nombre}}*,

Tu pago de *C$ {{monto}}* correspondiente a la quincena del {{fecha_inicio}} al {{fecha_fin}} sigue pendiente.

Por favor regulariza tu situación para evitar suspensión del servicio de pedidos.

📍 Pago en comedor | 💳 Transferencia bancaria

_Equipo El Buen Sabor_',
ARRAY['nombre', 'monto', 'fecha_inicio', 'fecha_fin'], true),

('Pedido Confirmado', 'Confirmación de pedido diario', 'pedido_confirmado',
'✅ *Pedido Confirmado* - Comedor El Buen Sabor

Hola *{{nombre}}*,

Tu pedido ha sido confirmado:
{{#each items}}
• {{cantidad}}x {{platillo}} - C$ {{subtotal}}
{{/each}}
💰 *Total:* C$ {{total}}
🕐 *Hora límite:* {{hora_limite}}

¡Gracias por tu pedido!
_Equipo El Buen Sabor_',
ARRAY['nombre', 'items', 'total', 'hora_limite'], true),

('Stock Bajo Admin', 'Alerta para admin cuando stock es bajo', 'stock_bajo',
'📦 *Alerta Stock Bajo* - Comedor El Buen Sabor

Los siguientes platillos tienen stock bajo (≤5 porciones):
{{#each items}}
• {{nombre}}: {{stock}} porciones restantes
{{/each}}

Revisar y reabastecer.
_Sistema Automatizado_',
ARRAY['items'], true);

-- Configuración de ejemplo (reemplazar con credenciales reales)
insert into public.whatsapp_config (proveedor, nombre_config, api_url, api_key, telefono_origen, activo, configuracion_extra) values
('twilio', 'Twilio Principal', 'https://api.twilio.com/2010-04-01/Accounts/{{account_sid}}/Messages.json', 'TU_TWILIO_AUTH_TOKEN', '+15551234567', false, '{"account_sid": "TU_ACCOUNT_SID", "messaging_service_sid": "TU_MESSAGING_SID"}'),
('gupshup', 'Gupshup WhatsApp', 'https://api.gupshup.io/sm/api/v1/msg', 'TU_GUPSHUP_API_KEY', '+50588887777', false, '{"source_name": "ElBuenSabor"}');

-- Trigger updated_at para nuevas tablas
create trigger update_whatsapp_config_updated_at
    before update on public.whatsapp_config
    for each row execute function public.update_updated_at_column();

create trigger update_whatsapp_plantillas_updated_at
    before update on public.whatsapp_plantillas
    for each row execute function public.update_updated_at_column();

-- Función RPC: Renderizar plantilla con variables
create or replace function public.renderizar_plantilla_whatsapp(
    p_plantilla_id uuid,
    p_variables json
)
returns json
language plpgsql
security definer
as $$
declare
    v_plantilla record;
    v_contenido text;
begin
    select * into v_plantilla from public.whatsapp_plantillas where id = p_plantilla_id and activa = true;
    if not found then
        return json_build_object('success', false, 'error', 'Plantilla no encontrada o inactiva');
    end if;

    v_contenido := v_plantilla.contenido;

    -- Reemplazo simple de variables {{variable}}
    for key in select json_object_keys(p_variables) loop
        v_contenido := replace(v_contenido, '{{' || key || '}}', p_variables->>key);
    end loop;

    -- Verificar variables faltantes
    declare
        v_faltantes text[] := '{}';
    begin
        for i in 1..array_length(v_plantilla.variables_requeridas, 1) loop
            if v_contenido like '%{{' || v_plantilla.variables_requeridas[i] || '}}%' then
                v_faltantes := v_faltantes || v_plantilla.variables_requeridas[i];
            end if;
        end loop;
        if array_length(v_faltantes, 1) > 0 then
            return json_build_object('success', false, 'error', 'Variables faltantes: ' || array_to_string(v_faltantes, ', '), 'contenido_parcial', v_contenido);
        end if;
    end;

    return json_build_object('success', true, 'contenido', v_contenido, 'plantilla', v_plantilla.nombre);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Función RPC: Enviar notificación WhatsApp (genérica, usa config activa)
create or replace function public.enviar_notificacion_whatsapp(
    p_cliente_id uuid,
    p_plantilla_id uuid,
    p_variables json,
    p_config_id uuid default null,
    p_tipo_notificacion text default 'personalizado'
)
returns json
language plpgsql
security definer
as $$
declare
    v_config record;
    v_cliente record;
    v_render json;
    v_contenido text;
    v_enviado boolean := false;
    v_respuesta json;
    v_message_sid text;
begin
    -- Obtener cliente
    select id, nombre, telefono_whatsapp into v_cliente
    from public.perfiles where id = p_cliente_id;
    if not found then
        return json_build_object('success', false, 'error', 'Cliente no encontrado');
    end if;

    if v_cliente.telefono_whatsapp is null or v_cliente.telefono_whatsapp = '' then
        return json_build_object('success', false, 'error', 'Cliente sin WhatsApp configurado');
    end if;

    -- Renderizar plantilla
    v_render := public.renderizar_plantilla_whatsapp(p_plantilla_id, p_variables);
    if not (v_render->>'success')::boolean then
        return v_render;
    end if;
    v_contenido := v_render->>'contenido';

    -- Obtener config activa
    if p_config_id is not null then
        select * into v_config from public.whatsapp_config where id = p_config_id and activo = true;
    else
        select * into v_config from public.whatsapp_config where activo = true order by created_at limit 1;
    end if;

    if not found then
        return json_build_object('success', false, 'error', 'No hay configuración WhatsApp activa');
    end if;

    -- 🔗 AQUÍ LA INTEGRACIÓN REAL CON CADA PROVEEDOR
    -- Este es un stub que simula éxito. Reemplazar con lógica real por proveedor.
    /*
    if v_config.proveedor = 'twilio' then
        -- Llamada a Twilio API
    elsif v_config.proveedor = 'gupshup' then
        -- Llamada a Gupshup API
    ...
    */

    -- Simulación exitosa
    v_enviado := true;
    v_message_sid := 'msg_' || md5(random()::text || clock_timestamp()::text);
    v_respuesta := json_build_object('message_sid', v_message_sid, 'provider', v_config.proveedor, 'status', 'sent');

    -- Registrar en bitácora
    insert into public.bitacora_notificaciones (
        cliente_id, monto_notificado, enviado_exitosamente, respuesta_api,
        plantilla_id, config_id, tipo_notificacion
    ) values (
        p_cliente_id,
        coalesce((p_variables->>'monto')::numeric, 0),
        v_enviado,
        v_respuesta::text,
        p_plantilla_id,
        v_config.id,
        p_tipo_notificacion
    );

    return json_build_object(
        'success', v_enviado,
        'message_sid', v_message_sid,
        'contenido_enviado', v_contenido,
        'proveedor', v_config.proveedor
    );
exception
    when others then
        -- Log del error
        insert into public.bitacora_notificaciones (
            cliente_id, monto_notificado, enviado_exitosamente, respuesta_api,
            plantilla_id, config_id, tipo_notificacion
        ) values (
            p_cliente_id,
            coalesce((p_variables->>'monto')::numeric, 0),
            false,
            json_build_object('error', sqlerrm)::text,
            p_plantilla_id,
            coalesce(p_config_id, '00000000-0000-0000-0000-000000000000'::uuid),
            p_tipo_notificacion
        );
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Función RPC: Procesar cola de reintentos (para cron job)
create or replace function public.procesar_cola_reintentos_whatsapp(
    p_max_reintentos integer default 3
)
returns json
language plpgsql
security definer
as $$
declare
    v_notificacion record;
    v_procesados integer := 0;
    v_enviados integer := 0;
begin
    for v_notificacion in
        select bn.*, wp.contenido as plantilla_contenido, wp.variables_requeridas, wc.proveedor, wc.api_url, wc.api_key, wc.telefono_origen, wc.configuracion_extra
        from public.bitacora_notificaciones bn
        join public.whatsapp_plantillas wp on wp.id = bn.plantilla_id
        join public.whatsapp_config wc on wc.id = bn.config_id
        where bn.enviado_exitosamente = false
          and bn.reintentos < p_max_reintentos
          and (bn.proximo_reintento is null or bn.proximo_reintento <= now())
          and wc.activo = true
        order by bn.created_at asc
        limit 50
    loop
        v_procesados := v_procesados + 1;

        -- Reintentar envío (stub - integrar proveedor real)
        v_enviados := v_enviados + 1;

        update public.bitacora_notificaciones
        set reintentos = reintentos + 1,
            enviado_exitosamente = true,
            respuesta_api = json_build_object('reintento', v_notificacion.reintentos + 1, 'status', 'sent')::text,
            proximo_reintento = null
        where id = v_notificacion.id;
    end loop;

    return json_build_object('success', true, 'procesados', v_procesados, 'enviados', v_enviados);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;