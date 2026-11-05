-- ============================================
-- SEED: Datos de prueba para "El Buen Sabor"
-- Ejecutado después de las migraciones con `supabase db reset`
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. Perfiles de prueba (busca el UUID del usuario en auth.users por email)
--    Crea los usuarios primero desde Supabase Studio (Authentication > Users)
--    o con `supabase auth signup`.
-- ---------------------------------------------------------------------------

-- Cliente de prueba
insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
select id, 'Juan Manuel Pérez', '+50588887777', 'cliente', 2000.00
from auth.users
where email = 'cliente@prueba.com'
on conflict (id) do nothing;

-- Administrador de prueba
insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
select id, 'Silvana Torres', '+50577778888', 'administrador', 2000.00
from auth.users
where email = 'admin@prueba.com'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Menú del día (para hoy, activo, hora límite 11:00 AM)
-- ---------------------------------------------------------------------------

insert into public.menus_diarios (fecha, hora_limite_pedido, activo)
values (current_date, '11:00:00', true)
on conflict (fecha) do update
set activo = true,
    hora_limite_pedido = '11:00:00';

-- ---------------------------------------------------------------------------
-- 3. Platillos del menú de hoy
-- ---------------------------------------------------------------------------

insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
select m.id, 'Cerdo Asado con Tajadas', 'Plato típico con carne de cerdo asado y tajadas de plátano', 150.00, 20, 'principal'
from public.menus_diarios m
where m.fecha = current_date
on conflict do nothing;

insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
select m.id, 'Pollo en Salsa', 'Pechuga de pollo en salsa de tomate con arroz', 140.00, 20, 'principal'
from public.menus_diarios m
where m.fecha = current_date
on conflict do nothing;

insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
select m.id, 'Cacao', 'Bebida caliente tradicional de cacao', 30.00, 30, 'bebida'
from public.menus_diarios m
where m.fecha = current_date
on conflict do nothing;

insert into public.platillos (menu_id, nombre, descripcion, precio_unitario, porciones_disponibles, tipo)
select m.id, 'Gramo', 'Refresco natural de granos', 30.00, 30, 'bebida'
from public.menus_diarios m
where m.fecha = current_date
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Fin del seed
-- ---------------------------------------------------------------------------
