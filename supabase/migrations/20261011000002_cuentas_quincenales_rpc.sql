-- ==========================================
-- MIGRACIÓN: RPCs para Cuentas Quincenales y Cobranza
-- ==========================================

-- Función RPC: Obtener cuenta quincenal actual del cliente
create or replace function public.obtener_cuenta_actual(
    p_cliente_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
    v_fecha_actual date := current_date;
    v_fecha_inicio_q date;
    v_fecha_fin_q date;
    v_cuenta record;
    v_detalle json;
begin
    -- Calcular quincena actual
    if extract(day from v_fecha_actual) <= 15 then
        v_fecha_inicio_q := date_trunc('month', v_fecha_actual)::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '14 days')::date;
    else
        v_fecha_inicio_q := (date_trunc('month', v_fecha_actual) + interval '15 days')::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '1 month' - interval '1 day')::date;
    end if;

    -- Buscar cuenta actual
    select * into v_cuenta
    from public.cuentas_quincenales
    where cliente_id = p_cliente_id and fecha_inicio = v_fecha_inicio_q;

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

    -- Obtener detalle de pedidos de esta quincena
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
      and p.fecha_hora >= v_fecha_inicio_q
      and p.fecha_hora <= v_fecha_fin_q + interval '1 day'
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

-- Función RPC: Historial de cuentas quincenales del cliente
create or replace function public.historial_cuentas_cliente(
    p_cliente_id uuid,
    p_limit integer default 12
)
returns json
language plpgsql
security definer
as $$
declare
    v_cuentas json;
begin
    select json_agg(json_build_object(
        'id', cq.id,
        'fecha_inicio', cq.fecha_inicio,
        'fecha_fin', cq.fecha_fin,
        'total_acumulado', cq.total_acumulado,
        'estado_pago', cq.estado_pago,
        'updated_at', cq.updated_at,
        'total_pedidos', (
            select count(*) from public.pedidos p
            where p.cliente_id = p_cliente_id
              and p.fecha_hora >= cq.fecha_inicio
              and p.fecha_hora <= cq.fecha_fin + interval '1 day'
              and p.estado = 'CONFIRMADO'
        )
    )) into v_cuentas
    from public.cuentas_quincenales cq
    where cq.cliente_id = p_cliente_id
    order by cq.fecha_inicio desc
    limit p_limit;

    return json_build_object('success', true, 'historial', coalesce(v_cuentas, '[]'::json));
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Función RPC: Registrar pago/abono (admin)
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
as $$
declare
    v_cuenta record;
    v_nuevo_total numeric(10,2);
    v_nuevo_estado estado_pago;
begin
    -- Verificar cuenta existe
    select * into v_cuenta
    from public.cuentas_quincenales
    where id = p_cuenta_id;

    if not found then
        return json_build_object('success', false, 'error', 'Cuenta no encontrada');
    end if;

    if p_monto <= 0 then
        return json_build_object('success', false, 'error', 'Monto debe ser mayor a 0');
    end if;

    if p_monto > v_cuenta.total_acumulado then
        return json_build_object('success', false, 'error', 'Monto excede deuda actual');
    end if;

    v_nuevo_total := v_cuenta.total_acumulado - p_monto;
    v_nuevo_estado := case when v_nuevo_total <= 0 then 'AL_DIA'::estado_pago else 'PENDIENTE_PAGO'::estado_pago end;

    -- Actualizar cuenta
    update public.cuentas_quincenales
    set total_acumulado = v_nuevo_total,
        estado_pago = v_nuevo_estado,
        updated_at = now()
    where id = p_cuenta_id;

    -- Registrar en bitácora de notificaciones como pago
    insert into public.bitacora_notificaciones (cliente_id, monto_notificado, enviado_exitosamente, respuesta_api)
    values (v_cuenta.cliente_id, p_monto, true, json_build_object(
        'tipo', 'PAGO_REGISTRADO',
        'metodo', p_metodo,
        'referencia', p_referencia,
        'observaciones', p_observaciones,
        'saldo_anterior', v_cuenta.total_acumulado,
        'saldo_nuevo', v_nuevo_total
    )::text);

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

-- Función RPC: Ejecutar corte quincenal (admin) - genera resumen y clasifica morosos
create or replace function public.ejecutar_corte_quincenal(
    p_fecha_inicio date,
    p_fecha_fin date
)
returns json
language plpgsql
security definer
as $$
declare
    v_cuenta record;
    v_resumen json;
    v_cuentas_procesadas integer := 0;
    v_total_cobrar numeric(12,2) := 0;
    v_morosos integer := 0;
    v_al_dia integer := 0;
begin
    -- Validar rango
    if p_fecha_inicio > p_fecha_fin then
        return json_build_object('success', false, 'error', 'Fecha inicio debe ser anterior a fecha fin');
    end if;

    -- Procesar cada cuenta en el rango
    for v_cuenta in
        select cq.*, p.nombre, p.telefono_whatsapp, p.limite_credito
        from public.cuentas_quincenales cq
        join public.perfiles p on p.id = cq.cliente_id
        where cq.fecha_inicio = p_fecha_inicio
          and cq.fecha_fin = p_fecha_fin
    loop
        v_cuentas_procesadas := v_cuentas_procesadas + 1;
        v_total_cobrar := v_total_cobrar + v_cuenta.total_acumulado;

        if v_cuenta.total_acumulado > 0 then
            v_morosos := v_morosos + 1;
            -- Actualizar estado a MOROSO si no estaba
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

    v_resumen := json_build_object(
        'periodo', json_build_object('inicio', p_fecha_inicio, 'fin', p_fecha_fin),
        'cuentas_procesadas', v_cuentas_procesadas,
        'total_cobrar', v_total_cobrar,
        'morosos', v_morosos,
        'al_dia', v_al_dia,
        'ejecutado_en', now()
    );

    return json_build_object('success', true, 'resumen', v_resumen);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Función RPC: Obtener lista de morosos para notificación WhatsApp
create or replace function public.obtener_morosos_para_notificar(
    p_fecha_inicio date,
    p_fecha_fin date
)
returns json
language plpgsql
security definer
as $$
declare
    v_morosos json;
begin
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

-- Función RPC: Marcar notificación WhatsApp como enviada
create or replace function public.registrar_notificacion_whatsapp(
    p_cliente_id uuid,
    p_monto numeric(10,2),
    p_enviado boolean,
    p_respuesta_api text default null
)
returns json
language plpgsql
security definer
as $$
begin
    insert into public.bitacora_notificaciones (cliente_id, monto_notificado, enviado_exitosamente, respuesta_api)
    values (p_cliente_id, p_monto, p_enviado, p_respuesta_api);

    return json_build_object('success', true);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;