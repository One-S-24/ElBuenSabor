-- ============================================
-- 1. Crear perfil de cliente
-- ============================================
insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
select id, 'Cliente Prueba', '+50588887777', 'cliente', 2000.00
from auth.users
where email = 'cliente@prueba.com'
on conflict (id) do update set rol = 'cliente';

-- ============================================
-- 2. Crear perfil de administrador
-- ============================================
insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
select id, 'Admin Prueba', '+50577778888', 'administrador', 2000.00
from auth.users
where email = 'admin@prueba.com'
on conflict (id) do update set rol = 'administrador';