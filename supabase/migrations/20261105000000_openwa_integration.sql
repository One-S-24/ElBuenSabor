-- ==========================================================
-- MIGRACIÓN: Integración con OpenWA (WhatsApp API Gateway)
-- ==========================================================
-- OpenWA pasa a ser el proveedor de WhatsApp del sistema.
-- La configuración (URL, API key y sesión) se guarda en
-- public.whatsapp_config y solo los administradores pueden leerla.
-- ==========================================================

-- 1. Eliminar únicamente las filas de ejemplo creadas por la migración
--    20261011000003 (claves ficticias). No se tocan configuraciones reales.
delete from public.whatsapp_config
where proveedor in ('twilio', 'gupshup', 'wati', 'oficial', 'personalizado')
  and (api_key is null or api_key = '' or api_key like 'TU_%');

-- 2. OpenWA como proveedor por defecto. Se mantienen los valores
--    históricos permitidos para no romper filas existentes; la UI
--    únicamente ofrece OpenWA.
alter table public.whatsapp_config
    drop constraint if exists whatsapp_config_proveedor_check;

alter table public.whatsapp_config
    add constraint whatsapp_config_proveedor_check
    check (proveedor in ('openwa', 'twilio', 'gupshup', 'wati', 'oficial', 'personalizado'));

alter table public.whatsapp_config
    alter column proveedor set default 'openwa';

-- 3. Sesión de OpenWA (nombre único de la sesión en el gateway)
alter table public.whatsapp_config
    add column if not exists session_id text not null default 'el-buen-sabor';

-- 4. Configuración inicial inactiva para facilitar el onboarding
--    desde el panel. La API key se captura en el panel (nunca en el repo).
insert into public.whatsapp_config (
    proveedor,
    nombre_config,
    api_url,
    api_key,
    telefono_origen,
    activo,
    session_id,
    configuracion_extra
)
select
    'openwa',
    'OpenWA Local',
    'http://host.docker.internal:2785',
    '',
    '',
    false,
    'el-buen-sabor',
    '{"delay_ms": 1200, "country_code": "505"}'::jsonb
where not exists (
    select 1 from public.whatsapp_config where proveedor = 'openwa'
);

-- 5. Trazabilidad real del envío en la bitácora
alter table public.bitacora_notificaciones
    add column if not exists telefono_destino text,
    add column if not exists message_id text,
    add column if not exists contenido_enviado text,
    add column if not exists error_mensaje text,
    add column if not exists idempotency_key text;

-- 6. El envío crea la fila como "pendiente" y luego la actualiza con
--    el messageId o el error devuelto por OpenWA.
drop policy if exists "Admin actualiza bitácora notificaciones" on public.bitacora_notificaciones;
create policy "Admin actualiza bitácora notificaciones" on public.bitacora_notificaciones
    for update
    using (exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol = 'administrador'
    ))
    with check (exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol = 'administrador'
    ));

-- 7. Los RPC anteriores simulaban el envío. Se desactivan para evitar
--    falsos positivos en la bitácora. El envío real ocurre en la Edge
--    Function whatsapp usando la API de OpenWA.
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
begin
    return json_build_object(
        'success', false,
        'error', 'Función obsoleta: el envío se realiza desde la Edge Function whatsapp (OpenWA).'
    );
end;
$$;

create or replace function public.procesar_cola_reintentos_whatsapp(
    p_max_reintentos integer default 3
)
returns json
language plpgsql
security definer
as $$
begin
    return json_build_object(
        'success', false,
        'error', 'Función obsoleta: los reintentos se procesan desde la Edge Function whatsapp (OpenWA).'
    );
end;
$$;

-- 8. Comentarios de documentación
comment on column public.whatsapp_config.session_id is 'Nombre de la sesión en OpenWA (solo letras, números y guiones).';
comment on column public.whatsapp_config.api_key is 'API key de OpenWA (X-API-Key). Solo visible para administradores; la UI la enmascara.';
comment on column public.bitacora_notificaciones.contenido_enviado is 'Texto final renderizado que se envió (o se intentó enviar).';
comment on column public.bitacora_notificaciones.message_id is 'messageId devuelto por OpenWA al aceptar el mensaje.';
comment on column public.bitacora_notificaciones.idempotency_key is 'Clave enviada a OpenWA para evitar duplicados en reintentos.';
