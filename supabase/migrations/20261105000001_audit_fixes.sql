-- ==========================================================
-- MIGRACIÓN: Correcciones de auditoría (RF, RNF, UWE y seguridad)
-- ==========================================================
-- Esta migración corrige los hallazgos de la auditoría:
--   1. RPCs `security definer` sin verificación de rol/propietario.
--   2. RLS no habilitado en detalle_pedidos y bitacora_notificaciones.
--   3. Falta de política de lectura del detalle para el cliente.
--   4. `crear_pedido_diario` sin validar menú del día, pertenencia del
--      platillo, cantidades positivas ni zona horaria del negocio.
--   5. El corte quincenal no persistía el reporte consolidado.
-- ==========================================================

-- ==========================================================
-- 1. Helper de rol (security definer para evitar recursión en RLS)
-- ==========================================================
create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        auth.role() = 'service_role'
        or exists (
            select 1
            from public.perfiles
            where id = auth.uid()
              and rol = 'administrador'
        ),
        false
    );
$$;

grant execute on function public.es_administrador() to authenticated, service_role;

-- ==========================================================
-- 2. Perfiles: el rol se lee de la tabla, no de user_metadata
-- ==========================================================
drop policy if exists "Administradores pueden gestionar perfiles" on public.perfiles;

create policy "Administradores pueden gestionar perfiles" on public.perfiles
    for all
    using (public.es_administrador())
    with check (public.es_administrador());

-- ==========================================================
-- 3. RLS faltante y lectura del detalle por parte del cliente
-- ==========================================================
alter table public.detalle_pedidos enable row level security;
alter table public.bitacora_notificaciones enable row level security;

drop policy if exists "Clientes ven el detalle de sus pedidos" on public.detalle_pedidos;

create policy "Clientes ven el detalle de sus pedidos" on public.detalle_pedidos
    for select
    using (
        exists (
            select 1
            from public.pedidos p
            where p.id = detalle_pedidos.pedido_id
              and p.cliente_id = auth.uid()
        )
    );

-- ==========================================================
-- 4. Reporte consolidado de cortes quincenales
-- ==========================================================
create table if not exists public.cortes_quincenales (
    id uuid default gen_random_uuid() primary key,
    fecha_inicio date not null,
    fecha_fin date not null,
    cuentas_procesadas integer not null default 0,
    total_cobrar numeric(12,2) not null default 0,
    morosos integer not null default 0,
    al_dia integer not null default 0,
    detalle jsonb not null default '{}'::jsonb,
    ejecutado_por uuid references public.perfiles(id),
    ejecutado_en timestamp with time zone not null default now()
);

create index if not exists idx_cortes_quincenales_periodo
    on public.cortes_quincenales(fecha_inicio, fecha_fin);

alter table public.cortes_quincenales enable row level security;

drop policy if exists "Admin gestiona cortes quincenales" on public.cortes_quincenales;

create policy "Admin gestiona cortes quincenales" on public.cortes_quincenales
    for all
    using (public.es_administrador())
    with check (public.es_administrador());

-- ==========================================================
-- 5. Crear pedido diario (transaccional y endurecido)
-- ==========================================================
create or replace function public.crear_pedido_diario(
    p_cliente_id uuid,
    p_menu_id uuid,
    p_items json
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_ahora timestamp;
    v_hora_actual time;
    v_fecha_actual date;
    v_hora_limite time;
    v_menu_activo boolean;
    v_menu_fecha date;
    v_item json;
    v_platillo record;
    v_cantidad integer;
    v_subtotal numeric(10,2);
    v_total_pedido numeric(10,2) := 0;
    v_cantidad_total integer := 0;
    v_items_validados jsonb := '[]'::jsonb;
    v_nuevo_pedido_id uuid;
    v_cuenta_id uuid;
    v_fecha_inicio_q date;
    v_fecha_fin_q date;
begin
    -- Autorización: el cliente solo puede crear sus propios pedidos.
    if auth.uid() is null then
        if coalesce(auth.role(), '') <> 'service_role' then
            return json_build_object('success', false, 'error', 'No autenticado.');
        end if;
    elsif not public.es_administrador()
          and p_cliente_id is distinct from auth.uid() then
        return json_build_object('success', false, 'error', 'No autorizado para crear pedidos de otro cliente.');
    end if;

    if p_cliente_id is null or p_menu_id is null then
        return json_build_object('success', false, 'error', 'Cliente y menú son requeridos.');
    end if;

    if p_items is null
       or json_typeof(p_items) <> 'array'
       or json_array_length(p_items) = 0 then
        return json_build_object('success', false, 'error', 'El pedido debe incluir al menos un platillo.');
    end if;

    -- Hora y fecha del servidor en la zona horaria del negocio (Nicaragua, UTC-6).
    v_ahora := now() at time zone 'America/Managua';
    v_fecha_actual := v_ahora::date;
    v_hora_actual := v_ahora::time;

    select hora_limite_pedido, activo, fecha
      into v_hora_limite, v_menu_activo, v_menu_fecha
      from public.menus_diarios
     where id = p_menu_id;

    if not found or not v_menu_activo then
        return json_build_object('success', false, 'error', 'El menú seleccionado no está activo.');
    end if;

    if v_menu_fecha <> v_fecha_actual then
        return json_build_object('success', false, 'error', 'El menú seleccionado no corresponde al día de hoy.');
    end if;

    if v_hora_actual > v_hora_limite then
        return json_build_object('success', false, 'error', 'Horario de pedidos cerrado. Límite: ' || v_hora_limite);
    end if;

    -- Primera pasada: validar y bloquear los platillos sin modificar nada.
    for v_item in select * from json_array_elements(p_items)
    loop
        v_cantidad := coalesce((v_item->>'cantidad')::integer, 0);

        if v_cantidad <= 0 then
            return json_build_object('success', false, 'error', 'La cantidad de cada platillo debe ser mayor a cero.');
        end if;

        select id, nombre, precio_unitario, porciones_disponibles
          into v_platillo
          from public.platillos
         where id = (v_item->>'platillo_id')::uuid
           and menu_id = p_menu_id
         for update;

        if not found then
            return json_build_object(
                'success', false,
                'error', 'Platillo no encontrado o no pertenece al menú seleccionado.'
            );
        end if;

        if v_platillo.porciones_disponibles < v_cantidad then
            return json_build_object(
                'success', false,
                'error', 'Porciones agotadas para ' || v_platillo.nombre || '.'
            );
        end if;

        v_subtotal := v_platillo.precio_unitario * v_cantidad;
        v_total_pedido := v_total_pedido + v_subtotal;
        v_cantidad_total := v_cantidad_total + v_cantidad;
        v_items_validados := v_items_validados || jsonb_build_array(jsonb_build_object(
            'platillo_id', v_platillo.id,
            'cantidad', v_cantidad,
            'subtotal', v_subtotal
        ));
    end loop;

    -- El pedido se crea con estado CONFIRMADO y el total ya validado.
    insert into public.pedidos (cliente_id, estado, total_calculado)
    values (p_cliente_id, 'CONFIRMADO', v_total_pedido)
    returning id into v_nuevo_pedido_id;

    -- Segunda pasada: descontar inventario e insertar el detalle.
    for v_item in select * from jsonb_array_elements(v_items_validados)
    loop
        update public.platillos
           set porciones_disponibles = porciones_disponibles - (v_item->>'cantidad')::integer
         where id = (v_item->>'platillo_id')::uuid;

        insert into public.detalle_pedidos (pedido_id, platillo_id, cantidad, subtotal)
        values (
            v_nuevo_pedido_id,
            (v_item->>'platillo_id')::uuid,
            (v_item->>'cantidad')::integer,
            (v_item->>'subtotal')::numeric(10,2)
        );
    end loop;

    -- Cuenta quincenal correspondiente a la fecha local del negocio.
    if extract(day from v_fecha_actual) <= 15 then
        v_fecha_inicio_q := date_trunc('month', v_fecha_actual)::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '14 days')::date;
    else
        v_fecha_inicio_q := (date_trunc('month', v_fecha_actual) + interval '15 days')::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '1 month' - interval '1 day')::date;
    end if;

    select id into v_cuenta_id
      from public.cuentas_quincenales
     where cliente_id = p_cliente_id
       and fecha_inicio = v_fecha_inicio_q
     for update;

    if not found then
        insert into public.cuentas_quincenales (
            cliente_id, fecha_inicio, fecha_fin, total_acumulado, estado_pago
        )
        values (
            p_cliente_id, v_fecha_inicio_q, v_fecha_fin_q, v_total_pedido, 'PENDIENTE_PAGO'
        )
        returning id into v_cuenta_id;
    else
        update public.cuentas_quincenales
           set total_acumulado = total_acumulado + v_total_pedido,
               estado_pago = 'PENDIENTE_PAGO',
               updated_at = now()
         where id = v_cuenta_id;
    end if;

    return json_build_object(
        'success', true,
        'pedido_id', v_nuevo_pedido_id,
        'total', v_total_pedido,
        'items', v_cantidad_total
    );
exception
    when others then
        -- El bloque exception revierte automáticamente los cambios parciales.
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.crear_pedido_diario(uuid, uuid, json) from public, anon;
grant execute on function public.crear_pedido_diario(uuid, uuid, json) to authenticated, service_role;

-- ==========================================================
-- 6. Cuenta actual e historial: solo el dueño o un administrador
-- ==========================================================
create or replace function public.obtener_cuenta_actual(
    p_cliente_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_fecha_actual date := (now() at time zone 'America/Managua')::date;
    v_fecha_inicio_q date;
    v_fecha_fin_q date;
    v_cuenta record;
    v_detalle json;
begin
    if not public.es_administrador()
       and p_cliente_id is distinct from auth.uid() then
        return json_build_object('success', false, 'error', 'No autorizado para consultar esta cuenta.');
    end if;

    if extract(day from v_fecha_actual) <= 15 then
        v_fecha_inicio_q := date_trunc('month', v_fecha_actual)::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '14 days')::date;
    else
        v_fecha_inicio_q := (date_trunc('month', v_fecha_actual) + interval '15 days')::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '1 month' - interval '1 day')::date;
    end if;

    select * into v_cuenta
      from public.cuentas_quincenales
     where cliente_id = p_cliente_id
       and fecha_inicio = v_fecha_inicio_q;

    if not found then
        return json_build_object(
            'success', true,
            'cuenta', json_build_object(
                'fecha_inicio', v_fecha_inicio_q,
                'fecha_fin', v_fecha_fin_q,
                'total_acumulado', 0.00,
                'estado_pago', 'AL_DIA'::estado_pago,
                'es_nueva', true
            ),
            'detalle', '[]'::json
        );
    end if;

    select json_agg(json_build_object(
        'fecha', p.fecha_hora::date,
        'pedido_id', p.id,
        'total', p.total_calculado,
        'items', (
            select json_agg(json_build_object(
                'platillo', pl.nombre,
                'cantidad', dp.cantidad,
                'precio_unitario', pl.precio_unitario,
                'subtotal', dp.subtotal
            ))
            from public.detalle_pedidos dp
            join public.platillos pl on pl.id = dp.platillo_id
            where dp.pedido_id = p.id
        )
    )) into v_detalle
    from public.pedidos p
    where p.cliente_id = p_cliente_id
      and p.fecha_hora >= (v_fecha_inicio_q::timestamp at time zone 'America/Managua')
      and p.fecha_hora < ((v_fecha_fin_q + 1)::timestamp at time zone 'America/Managua')
      and p.estado = 'CONFIRMADO'
    order by p.fecha_hora desc;

    return json_build_object(
        'success', true,
        'cuenta', json_build_object(
            'id', v_cuenta.id,
            'fecha_inicio', v_cuenta.fecha_inicio,
            'fecha_fin', v_cuenta.fecha_fin,
            'total_acumulado', v_cuenta.total_acumulado,
            'estado_pago', v_cuenta.estado_pago,
            'updated_at', v_cuenta.updated_at,
            'es_nueva', false
        ),
        'detalle', coalesce(v_detalle, '[]'::json)
    );
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.obtener_cuenta_actual(uuid) from public, anon;
grant execute on function public.obtener_cuenta_actual(uuid) to authenticated, service_role;

create or replace function public.historial_cuentas_cliente(
    p_cliente_id uuid,
    p_limit integer default 12
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_cuentas json;
    v_limit integer := greatest(1, least(coalesce(p_limit, 12), 60));
begin
    if not public.es_administrador()
       and p_cliente_id is distinct from auth.uid() then
        return json_build_object('success', false, 'error', 'No autorizado para consultar este historial.');
    end if;

    select json_agg(json_build_object(
        'id', cq.id,
        'fecha_inicio', cq.fecha_inicio,
        'fecha_fin', cq.fecha_fin,
        'total_acumulado', cq.total_acumulado,
        'estado_pago', cq.estado_pago,
        'updated_at', cq.updated_at,
        'total_pedidos', (
            select count(*)
            from public.pedidos p
            where p.cliente_id = p_cliente_id
              and p.fecha_hora >= (cq.fecha_inicio::timestamp at time zone 'America/Managua')
              and p.fecha_hora < ((cq.fecha_fin + 1)::timestamp at time zone 'America/Managua')
              and p.estado = 'CONFIRMADO'
        )
    )) into v_cuentas
    from public.cuentas_quincenales cq
    where cq.cliente_id = p_cliente_id
    order by cq.fecha_inicio desc
    limit v_limit;

    return json_build_object('success', true, 'historial', coalesce(v_cuentas, '[]'::json));
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.historial_cuentas_cliente(uuid, integer) from public, anon;
grant execute on function public.historial_cuentas_cliente(uuid, integer) to authenticated, service_role;

-- ==========================================================
-- 7. Registrar pago/abono (solo administradores, con bloqueo)
-- ==========================================================
create or replace function public.registrar_pago_cuenta(
    p_cuenta_id uuid,
    p_monto numeric(10,2),
    p_metodo text default 'EFECTIVO',
    p_referencia text default null,
    p_observaciones text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_cuenta record;
    v_nuevo_total numeric(10,2);
    v_nuevo_estado estado_pago;
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    select * into v_cuenta
      from public.cuentas_quincenales
     where id = p_cuenta_id
     for update;

    if not found then
        return json_build_object('success', false, 'error', 'Cuenta no encontrada');
    end if;

    if p_monto is null or p_monto <= 0 then
        return json_build_object('success', false, 'error', 'Monto debe ser mayor a 0');
    end if;

    if p_monto > v_cuenta.total_acumulado then
        return json_build_object('success', false, 'error', 'Monto excede deuda actual');
    end if;

    v_nuevo_total := v_cuenta.total_acumulado - p_monto;
    v_nuevo_estado := case
        when v_nuevo_total <= 0 then 'AL_DIA'::estado_pago
        else 'PENDIENTE_PAGO'::estado_pago
    end;

    update public.cuentas_quincenales
       set total_acumulado = v_nuevo_total,
           estado_pago = v_nuevo_estado,
           updated_at = now()
     where id = p_cuenta_id;

    insert into public.bitacora_notificaciones (
        cliente_id, monto_notificado, enviado_exitosamente, respuesta_api
    )
    values (
        v_cuenta.cliente_id,
        p_monto,
        true,
        json_build_object(
            'tipo', 'PAGO_REGISTRADO',
            'metodo', p_metodo,
            'referencia', p_referencia,
            'observaciones', p_observaciones,
            'saldo_anterior', v_cuenta.total_acumulado,
            'saldo_nuevo', v_nuevo_total
        )::text
    );

    return json_build_object(
        'success', true,
        'cuenta', json_build_object(
            'id', v_cuenta.id,
            'total_acumulado', v_nuevo_total,
            'estado_pago', v_nuevo_estado
        ),
        'pago', json_build_object(
            'monto', p_monto,
            'metodo', p_metodo,
            'referencia', p_referencia
        )
    );
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.registrar_pago_cuenta(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.registrar_pago_cuenta(uuid, numeric, text, text, text) to authenticated, service_role;

-- ==========================================================
-- 8. Corte quincenal (solo admin y con reporte persistido)
-- ==========================================================
create or replace function public.ejecutar_corte_quincenal(
    p_fecha_inicio date,
    p_fecha_fin date
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_cuenta record;
    v_resumen jsonb;
    v_reporte_id uuid;
    v_cuentas_procesadas integer := 0;
    v_total_cobrar numeric(12,2) := 0;
    v_morosos integer := 0;
    v_al_dia integer := 0;
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    if p_fecha_inicio is null or p_fecha_fin is null then
        return json_build_object('success', false, 'error', 'El período de corte es requerido.');
    end if;

    if p_fecha_inicio > p_fecha_fin then
        return json_build_object('success', false, 'error', 'Fecha inicio debe ser anterior a fecha fin');
    end if;

    for v_cuenta in
        select cq.*, p.nombre, p.telefono_whatsapp, p.limite_credito
          from public.cuentas_quincenales cq
          join public.perfiles p on p.id = cq.cliente_id
         where cq.fecha_inicio = p_fecha_inicio
           and cq.fecha_fin = p_fecha_fin
         for update of cq
    loop
        v_cuentas_procesadas := v_cuentas_procesadas + 1;
        v_total_cobrar := v_total_cobrar + v_cuenta.total_acumulado;

        if v_cuenta.total_acumulado > 0 then
            v_morosos := v_morosos + 1;
            if v_cuenta.estado_pago != 'MOROSO' then
                update public.cuentas_quincenales
                   set estado_pago = 'MOROSO', updated_at = now()
                 where id = v_cuenta.id;
            end if;
        else
            v_al_dia := v_al_dia + 1;
            if v_cuenta.estado_pago != 'AL_DIA' then
                update public.cuentas_quincenales
                   set estado_pago = 'AL_DIA', updated_at = now()
                 where id = v_cuenta.id;
            end if;
        end if;
    end loop;

    v_resumen := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_fecha_inicio, 'fin', p_fecha_fin),
        'cuentas_procesadas', v_cuentas_procesadas,
        'total_cobrar', v_total_cobrar,
        'morosos', v_morosos,
        'al_dia', v_al_dia,
        'ejecutado_en', now()
    );

    insert into public.cortes_quincenales (
        fecha_inicio, fecha_fin, cuentas_procesadas, total_cobrar,
        morosos, al_dia, detalle, ejecutado_por
    )
    values (
        p_fecha_inicio, p_fecha_fin, v_cuentas_procesadas, v_total_cobrar,
        v_morosos, v_al_dia, v_resumen, auth.uid()
    )
    returning id into v_reporte_id;

    v_resumen := v_resumen || jsonb_build_object('reporte_id', v_reporte_id);

    return json_build_object('success', true, 'resumen', v_resumen);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.ejecutar_corte_quincenal(date, date) from public, anon;
grant execute on function public.ejecutar_corte_quincenal(date, date) to authenticated, service_role;

-- ==========================================================
-- 9. Morosos y bitácora (solo administradores)
-- ==========================================================
create or replace function public.obtener_morosos_para_notificar(
    p_fecha_inicio date,
    p_fecha_fin date
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_morosos json;
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    select json_agg(json_build_object(
        'cuenta_id', cq.id,
        'cliente_id', cq.cliente_id,
        'nombre', p.nombre,
        'telefono_whatsapp', p.telefono_whatsapp,
        'total_deuda', cq.total_acumulado,
        'fecha_inicio', cq.fecha_inicio,
        'fecha_fin', cq.fecha_fin
    )) into v_morosos
    from public.cuentas_quincenales cq
    join public.perfiles p on p.id = cq.cliente_id
    where cq.fecha_inicio = p_fecha_inicio
      and cq.fecha_fin = p_fecha_fin
      and cq.total_acumulado > 0
      and cq.estado_pago in ('PENDIENTE_PAGO', 'MOROSO')
    order by cq.total_acumulado desc;

    return json_build_object('success', true, 'morosos', coalesce(v_morosos, '[]'::json));
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.obtener_morosos_para_notificar(date, date) from public, anon;
grant execute on function public.obtener_morosos_para_notificar(date, date) to authenticated, service_role;

create or replace function public.registrar_notificacion_whatsapp(
    p_cliente_id uuid,
    p_monto numeric(10,2),
    p_enviado boolean,
    p_respuesta_api text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    insert into public.bitacora_notificaciones (
        cliente_id, monto_notificado, enviado_exitosamente, respuesta_api
    )
    values (p_cliente_id, p_monto, p_enviado, p_respuesta_api);

    return json_build_object('success', true);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.registrar_notificacion_whatsapp(uuid, numeric, boolean, text) from public, anon;
grant execute on function public.registrar_notificacion_whatsapp(uuid, numeric, boolean, text) to authenticated, service_role;

-- ==========================================================
-- 10. RPCs de catálogo/menú (solo administradores)
-- ==========================================================
create or replace function public.agregar_platillo_desde_catalogo(
    p_menu_id uuid,
    p_catalogo_id uuid,
    p_porciones_disponibles integer,
    p_precio_override numeric(10,2) default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_catalogo record;
    v_existe boolean;
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    if p_porciones_disponibles is null or p_porciones_disponibles < 0 then
        return json_build_object('success', false, 'error', 'Las porciones deben ser un número mayor o igual a cero.');
    end if;

    if not exists (select 1 from public.menus_diarios where id = p_menu_id and activo = true) then
        return json_build_object('success', false, 'error', 'Menú no encontrado o inactivo');
    end if;

    select * into v_catalogo
      from public.catalogo_platillos
     where id = p_catalogo_id
       and activo = true;

    if not found then
        return json_build_object('success', false, 'error', 'Platillo no encontrado en catálogo');
    end if;

    select exists(
        select 1 from public.platillos
        where menu_id = p_menu_id and nombre = v_catalogo.nombre
    ) into v_existe;

    if v_existe then
        return json_build_object('success', false, 'error', 'Ya existe un platillo con ese nombre en este menú');
    end if;

    insert into public.platillos (
        menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo
    )
    values (
        p_menu_id,
        v_catalogo.nombre,
        v_catalogo.descripcion,
        coalesce(p_precio_override, v_catalogo.precio_referencia),
        p_porciones_disponibles,
        v_catalogo.tipo
    )
    returning id into v_catalogo.id;

    return json_build_object('success', true, 'platillo_id', v_catalogo.id, 'message', 'Platillo agregado al menú');
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.agregar_platillo_desde_catalogo(uuid, uuid, integer, numeric) from public, anon;
grant execute on function public.agregar_platillo_desde_catalogo(uuid, uuid, integer, numeric) to authenticated, service_role;

create or replace function public.crear_menu_desde_plantilla(
    p_fecha date,
    p_menu_plantilla_id uuid,
    p_hora_limite_pedido time default '11:00:00'
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_nuevo_menu_id uuid;
    v_platillo record;
begin
    if not public.es_administrador() then
        return json_build_object('success', false, 'error', 'Acceso denegado: solo administradores.');
    end if;

    if not exists (select 1 from public.menus_diarios where id = p_menu_plantilla_id) then
        return json_build_object('success', false, 'error', 'Menú plantilla no encontrado');
    end if;

    if exists (select 1 from public.menus_diarios where fecha = p_fecha) then
        return json_build_object('success', false, 'error', 'Ya existe un menú para esa fecha');
    end if;

    insert into public.menus_diarios (fecha, hora_limite_pedido, activo)
    values (p_fecha, p_hora_limite_pedido, true)
    returning id into v_nuevo_menu_id;

    for v_platillo in
        select nombre, descripcion, precio_unitario, porciones_disponibles, tipo
          from public.platillos
         where menu_id = p_menu_plantilla_id
    loop
        insert into public.platillos (
            menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo
        )
        values (
            v_nuevo_menu_id,
            v_platillo.nombre,
            v_platillo.descripcion,
            v_platillo.precio_unitario,
            v_platillo.porciones_disponibles,
            v_platillo.tipo
        );
    end loop;

    return json_build_object('success', true, 'menu_id', v_nuevo_menu_id, 'message', 'Menú creado desde plantilla');
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.crear_menu_desde_plantilla(date, uuid, time) from public, anon;
grant execute on function public.crear_menu_desde_plantilla(date, uuid, time) to authenticated, service_role;

-- ==========================================================
-- 11. Documentación
-- ==========================================================
comment on table public.cortes_quincenales is 'Reporte consolidado persistido de cada corte quincenal ejecutado.';
comment on function public.crear_pedido_diario(uuid, uuid, json) is 'Crea un pedido confirmado, descuenta stock y acumula la cuenta quincenal de forma transaccional.';
