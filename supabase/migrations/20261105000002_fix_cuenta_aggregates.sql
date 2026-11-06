-- ==========================================================
-- MIGRACIÓN: Corrige agregados con ORDER BY a nivel de consulta
-- ==========================================================
-- `obtener_cuenta_actual`, `historial_cuentas_cliente` y
-- `obtener_morosos_para_notificar` usaban `ORDER BY` fuera de
-- `json_agg`, lo que PostgreSQL rechaza con:
--   "column ... must appear in the GROUP BY clause or be used
--    in an aggregate function".
-- El orden se mueve dentro del agregado (o a una subconsulta).
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

    select json_agg(
        json_build_object(
            'fecha', (p.fecha_hora at time zone 'America/Managua')::date,
            'pedido_id', p.id,
            'total', p.total_calculado,
            'items', (
                select json_agg(json_build_object(
                    'platillo', pl.nombre,
                    'cantidad', dp.cantidad,
                    'precio_unitario', pl.precio_unitario,
                    'subtotal', dp.subtotal
                ) order by pl.nombre)
                from public.detalle_pedidos dp
                join public.platillos pl on pl.id = dp.platillo_id
                where dp.pedido_id = p.id
            )
        )
        order by p.fecha_hora desc
    ) into v_detalle
    from public.pedidos p
    where p.cliente_id = p_cliente_id
      and p.fecha_hora >= (v_fecha_inicio_q::timestamp at time zone 'America/Managua')
      and p.fecha_hora < ((v_fecha_fin_q + 1)::timestamp at time zone 'America/Managua')
      and p.estado = 'CONFIRMADO';

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

    select json_agg(x.cuenta order by x.fecha_inicio desc)
      into v_cuentas
      from (
        select
            cq.fecha_inicio,
            json_build_object(
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
            ) as cuenta
        from public.cuentas_quincenales cq
        where cq.cliente_id = p_cliente_id
        order by cq.fecha_inicio desc
        limit v_limit
      ) x;

    return json_build_object('success', true, 'historial', coalesce(v_cuentas, '[]'::json));
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

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

    select json_agg(
        json_build_object(
            'cuenta_id', cq.id,
            'cliente_id', cq.cliente_id,
            'nombre', p.nombre,
            'telefono_whatsapp', p.telefono_whatsapp,
            'total_deuda', cq.total_acumulado,
            'fecha_inicio', cq.fecha_inicio,
            'fecha_fin', cq.fecha_fin
        )
        order by cq.total_acumulado desc
    ) into v_morosos
    from public.cuentas_quincenales cq
    join public.perfiles p on p.id = cq.cliente_id
    where cq.fecha_inicio = p_fecha_inicio
      and cq.fecha_fin = p_fecha_fin
      and cq.total_acumulado > 0
      and cq.estado_pago in ('PENDIENTE_PAGO', 'MOROSO');

    return json_build_object('success', true, 'morosos', coalesce(v_morosos, '[]'::json));
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.obtener_cuenta_actual(uuid) from public, anon;
revoke execute on function public.historial_cuentas_cliente(uuid, integer) from public, anon;
revoke execute on function public.obtener_morosos_para_notificar(date, date) from public, anon;

grant execute on function public.obtener_cuenta_actual(uuid) to authenticated, service_role;
grant execute on function public.historial_cuentas_cliente(uuid, integer) to authenticated, service_role;
grant execute on function public.obtener_morosos_para_notificar(date, date) to authenticated, service_role;

comment on function public.obtener_cuenta_actual(uuid) is 'Cuenta quincenal actual con detalle de pedidos; solo el dueño o un administrador.';
comment on function public.historial_cuentas_cliente(uuid, integer) is 'Historial de cuentas quincenales; solo el dueño o un administrador.';
comment on function public.obtener_morosos_para_notificar(date, date) is 'Clientes con saldo pendiente del período para notificación; solo administradores.';
