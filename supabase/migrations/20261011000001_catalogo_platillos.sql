-- ==========================================
-- MIGRACIÓN: Catálogo Maestro de Platillos
-- ==========================================

-- Tabla catálogo maestro (platillos reutilizables)
create table public.catalogo_platillos (
    id uuid default uuid_generate_v4() primary key,
    nombre text not null,
    descripcion text,
    precio_referencia numeric(10,2) not null,
    tipo text check (tipo in ('principal', 'bebida', 'adicional', 'postre', 'sopa', 'ensalada')) default 'principal',
    imagen_url text,
    activo boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índices
create index idx_catalogo_platillos_tipo on public.catalogo_platillos(tipo);
create index idx_catalogo_platillos_activo on public.catalogo_platillos(activo);

-- RLS
alter table public.catalogo_platillos enable row level security;

-- Todos pueden ver catálogo activo
create policy "Catálogo público visible" on public.catalogo_platillos
    for select using (activo = true);

-- Admin gestiona catálogo
create policy "Admin gestiona catálogo" on public.catalogo_platillos
    for all using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'));

-- Trigger para updated_at
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end; $$;

create trigger update_catalogo_platillos_updated_at
    before update on public.catalogo_platillos
    for each row execute function public.update_updated_at_column();

-- Función RPC: Agregar platillo del catálogo al menú diario
create or replace function public.agregar_platillo_desde_catalogo(
    p_menu_id uuid,
    p_catalogo_id uuid,
    p_porciones_disponibles integer,
    p_precio_override numeric(10,2) default null
)
returns json
language plpgsql
security definer
as $$
declare
    v_catalogo record;
    v_existe boolean;
begin
    -- Verificar menú existe y está activo
    if not exists (select 1 from public.menus_diarios where id = p_menu_id and activo = true) then
        return json_build_object('success', false, 'error', 'Menú no encontrado o inactivo');
    end if;

    -- Obtener datos del catálogo
    select * into v_catalogo from public.catalogo_platillos where id = p_catalogo_id and activo = true;
    if not found then
        return json_build_object('success', false, 'error', 'Platillo no encontrado en catálogo');
    end if;

    -- Verificar si ya existe en el menú
    select exists(select 1 from public.platillos where menu_id = p_menu_id and nombre = v_catalogo.nombre) into v_existe;
    if v_existe then
        return json_build_object('success', false, 'error', 'Ya existe un platillo con ese nombre en este menú');
    end if;

    -- Insertar en platillos del menú
    insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
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

-- Función RPC: Crear menú desde plantilla (copiar de otro menú)
create or replace function public.crear_menu_desde_plantilla(
    p_fecha date,
    p_menu_plantilla_id uuid,
    p_hora_limite_pedido time default '11:00:00'
)
returns json
language plpgsql
security definer
as $$
declare
    v_nuevo_menu_id uuid;
    v_platillo record;
begin
    -- Verificar plantilla existe
    if not exists (select 1 from public.menus_diarios where id = p_menu_plantilla_id) then
        return json_build_object('success', false, 'error', 'Menú plantilla no encontrado');
    end if;

    -- Verificar no existe menú para esa fecha
    if exists (select 1 from public.menus_diarios where fecha = p_fecha) then
        return json_build_object('success', false, 'error', 'Ya existe un menú para esa fecha');
    end if;

    -- Crear nuevo menú
    insert into public.menus_diarios (fecha, hora_limite_pedido, activo)
    values (p_fecha, p_hora_limite_pedido, true)
    returning id into v_nuevo_menu_id;

    -- Copiar platillos
    for v_platillo in
        select nombre, descripcion, precio_unitario, porciones_disponibles, tipo
        from public.platillos
        where menu_id = p_menu_plantilla_id
    loop
        insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
        values (v_nuevo_menu_id, v_platillo.nombre, v_platillo.descripcion, v_platillo.precio_unitario, v_platillo.porciones_disponibles, v_platillo.tipo);
    end loop;

    return json_build_object('success', true, 'menu_id', v_nuevo_menu_id, 'message', 'Menú creado desde plantilla');
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Datos de ejemplo para catálogo
insert into public.catalogo_platillos (nombre, descripcion, precio_referencia, tipo, activo) values
('Gallo Pinto', 'Arroz con frijoles rojos, cebolla y cilantro', 80.00, 'principal', true),
('Carne Asada', 'Res marinada a la parrilla con chimichurri', 120.00, 'principal', true),
('Pollo a la Plancha', 'Pechuga de pollo marinada con hierbas', 90.00, 'principal', true),
('Pescado Frito', 'Filete de pescado empanizado crujiente', 100.00, 'principal', true),
('Arroz Blanco', 'Arroz grano largo cocido al vapor', 20.00, 'adicional', true),
('Frijoles Molidos', 'Frijoles rojos licuados con mantequilla', 25.00, 'adicional', true),
('Plátanos Maduros', 'Plátanos fritos dulces', 30.00, 'adicional', true),
('Ensalada Mixta', 'Lechuga, tomate, cebolla, zanahoria', 35.00, 'ensalada', true),
('Sopa de Verduras', 'Caldo con verduras de temporada', 40.00, 'sopa', true),
('Refresco Natural', 'Fresco de frutas natural (tamarindo, piña, marañón)', 20.00, 'bebida', true),
('Agua Purificada', 'Botella 500ml', 15.00, 'bebida', true),
('Jugo Natural', 'Jugo de fruta de temporada (naranja, mango, papaya)', 25.00, 'bebida', true),
('Flan de Leche', 'Postre tradicional nicaragüense', 30.00, 'postre', true),
('Tres Leches', 'Pastel húmedo con tres tipos de leche', 40.00, 'postre', true);