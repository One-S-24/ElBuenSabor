-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";

-- ==========================================
-- TIPOS ENUMERADOS
-- ==========================================
create type estado_pedido as enum ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO_FUERA_DE_TIEMPO');
create type estado_pago as enum ('AL_DIA', 'PENDIENTE_PAGO', 'MOROSO');

-- ==========================================
-- TABLA: perfiles (Extensión de auth.users de Supabase)
-- ==========================================
create table public.perfiles (
    id uuid references auth.users(id) primary key,
    nombre text not null,
    telefono_whatsapp text not null,
    limite_credito numeric(10,2) default 2000.00,
    rol text check (rol in ('cliente', 'administrador')) default 'cliente',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- TABLA: menus_diarios
-- ==========================================
create table public.menus_diarios (
    id uuid default uuid_generate_v4() primary key,
    fecha date not null unique,
    hora_limite_pedido time not null default '11:00:00',
    activo boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- TABLA: platillos
-- ==========================================
create table public.platillos (
    id uuid default uuid_generate_v4() primary key,
    menu_id uuid references public.menus_diarios(id) on delete cascade not null,
    nombre text not null,
    descripcion text,
    precio_unitario numeric(10,2) not null,
    porciones_disponibles integer not null default 0,
    tipo text check (tipo in ('principal', 'bebida', 'adicional')) default 'principal',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- TABLA: pedidos
-- ==========================================
create table public.pedidos (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references public.perfiles(id) not null,
    fecha_hora timestamp with time zone default timezone('utc'::text, now()) not null,
    estado estado_pedido default 'PENDIENTE',
    total_calculado numeric(10,2) not null default 0.00
);

-- ==========================================
-- TABLA: detalle_pedidos
-- ==========================================
create table public.detalle_pedidos (
    id uuid default uuid_generate_v4() primary key,
    pedido_id uuid references public.pedidos(id) on delete cascade not null,
    platillo_id uuid references public.platillos(id) not null,
    cantidad integer not null check (cantidad > 0),
    subtotal numeric(10,2) not null
);

-- ==========================================
-- TABLA: cuentas_quincenales
-- ==========================================
create table public.cuentas_quincenales (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references public.perfiles(id) not null,
    fecha_inicio date not null,
    fecha_fin date not null,
    total_acumulado numeric(10,2) not null default 0.00,
    estado_pago estado_pago default 'AL_DIA',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- TABLA: bitacora_notificaciones_whatsapp
-- ==========================================
create table public.bitacora_notificaciones (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references public.perfiles(id) not null,
    monto_notificado numeric(10,2) not null,
    enviado_exitosamente boolean default false,
    respuesta_api text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- FUNCIÓN: crear_pedido_diario (RPC)
-- ==========================================
create or replace function public.crear_pedido_diario(
    p_cliente_id uuid,
    p_menu_id uuid,
    p_items json
)
returns json
language plpgsql
security definer
as $$
declare
    v_hora_limite time;
    v_menu_activo boolean;
    v_item json;
    v_platillo_record record;
    v_subtotal numeric(10,2);
    v_total_pedido numeric(10,2) := 0;
    v_nuevo_pedido_id uuid;
    v_cuenta_id uuid;
    v_fecha_actual date := current_date;
    v_fecha_inicio_q date;
    v_fecha_fin_q date;
begin
    select hora_limite_pedido, activo into v_hora_limite, v_menu_activo
    from public.menus_diarios
    where id = p_menu_id;

    if not found or not v_menu_activo then
        return json_build_object('success', false, 'error', 'El menú seleccionado no está activo.');
    end if;

    if current_time > v_hora_limite then
        return json_build_object('success', false, 'error', 'Horario de pedidos cerrado. Límite: ' || v_hora_limite);
    end if;

    insert into public.pedidos (cliente_id, estado, total_calculado)
    values (p_cliente_id, 'CONFIRMADO', 0)
    returning id into v_nuevo_pedido_id;

    for v_item in select * from json_array_elements(p_items)
    loop
        select id, precio_unitario, porciones_disponibles 
        into v_platillo_record
        from public.platillos
        where id = (v_item->>'platillo_id')::uuid
        for update;

        if not found then
            raise exception 'Platillo no encontrado.';
        end if;

        if v_platillo_record.porciones_disponibles < (v_item->>'cantidad')::integer then
            raise exception 'Porciones agotadas para el platillo solicitado.';
        end if;

        v_subtotal := v_platillo_record.precio_unitario * (v_item->>'cantidad')::integer;
        v_total_pedido := v_total_pedido + v_subtotal;

        update public.platillos
        set porciones_disponibles = porciones_disponibles - (v_item->>'cantidad')::integer
        where id = v_platillo_record.id;

        insert into public.detalle_pedidos (pedido_id, platillo_id, cantidad, subtotal)
        values (v_nuevo_pedido_id, v_platillo_record.id, (v_item->>'cantidad')::integer, v_subtotal);
    end loop;

    update public.pedidos
    set total_calculado = v_total_pedido
    where id = v_nuevo_pedido_id;

    if extract(day from v_fecha_actual) <= 15 then
        v_fecha_inicio_q := date_trunc('month', v_fecha_actual)::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '14 days')::date;
    else
        v_fecha_inicio_q := (date_trunc('month', v_fecha_actual) + interval '15 days')::date;
        v_fecha_fin_q := (date_trunc('month', v_fecha_actual) + interval '1 month' - interval '1 day')::date;
    end if;

    select id into v_cuenta_id
    from public.cuentas_quincenales
    where cliente_id = p_cliente_id and fecha_inicio = v_fecha_inicio_q;

    if not found then
        insert into public.cuentas_quincenales (cliente_id, fecha_inicio, fecha_fin, total_acumulado, estado_pago)
        values (p_cliente_id, v_fecha_inicio_q, v_fecha_fin_q, v_total_pedido, 'PENDIENTE_PAGO')
        returning id into v_cuenta_id;
    else
        update public.cuentas_quincenales
        set total_acumulado = total_acumulado + v_total_pedido,
            estado_pago = 'PENDIENTE_PAGO',
            updated_at = now()
        where id = v_cuenta_id;
    end if;

    return json_build_object('success', true, 'pedido_id', v_nuevo_pedido_id, 'total', v_total_pedido);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ==========================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ==========================================
alter table public.perfiles enable row level security;
alter table public.pedidos enable row level security;
alter table public.cuentas_quincenales enable row level security;
alter table public.menus_diarios enable row level security;
alter table public.platillos enable row level security;

create policy "Usuarios pueden ver su propio perfil o admin ve todos" on public.perfiles
    for select using (auth.uid() = id or exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Todos pueden ver menús activos" on public.menus_diarios
    for select using (true);

create policy "Todos pueden ver platillos" on public.platillos
    for select using (true);

create policy "Admin gestiona menús y platillos" on public.menus_diarios
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Admin gestiona platillos" on public.platillos
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Clientes ven sus propios pedidos" on public.pedidos
    for select using (auth.uid() = cliente_id or exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Clientes ven sus cuentas quincenales" on public.cuentas_quincenales
    for select using (auth.uid() = cliente_id or exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

-- Permitir insert en pedidos para usuarios autenticados (se usa via RPC)
create policy "Clientes pueden crear pedidos" on public.pedidos
    for insert with check (auth.uid() = cliente_id);

-- Permitir insert en detalle_pedidos para usuarios autenticados
create policy "Clientes pueden crear detalle de pedidos" on public.detalle_pedidos
    for insert with check (exists (
        select 1 from public.pedidos p 
        where p.id = detalle_pedidos.pedido_id 
        and p.cliente_id = auth.uid()
    ));

-- Admin puede ver todo en detalle_pedidos
create policy "Admin ve todos los detalles" on public.detalle_pedidos
    for select using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

-- Admin gestiona cuentas quincenales
create policy "Admin gestiona cuentas quincenales" on public.cuentas_quincenales
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

-- Admin ve bitácora
create policy "Admin ve bitácora notificaciones" on public.bitacora_notificaciones
    for select using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

create policy "Admin inserta bitácora notificaciones" on public.bitacora_notificaciones
    for insert with check (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));