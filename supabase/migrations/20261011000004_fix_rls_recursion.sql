-- ============================================
-- MIGRACIÓN: Corregir recursión infinita en políticas RLS de perfiles
-- ============================================

-- La política original consultaba la misma tabla 'perfiles' dentro de su propia
-- definición, causando "infinite recursion detected in policy for relation perfiles".
drop policy if exists "Usuarios pueden ver su propio perfil o admin ve todos" on public.perfiles;

-- 1. Usuario autenticado puede ver su propio perfil (sin recursión)
create policy "Usuarios pueden ver su propio perfil" on public.perfiles
    for select using (auth.uid() = id);

-- 2. Administradores pueden gestionar perfiles.
--    Se verifica el rol en auth.users (tabla diferente, sin recursión en perfiles).
--    Requiere que el usuario tenga 'rol' en raw_user_meta_data al crearse en Auth.
create policy "Administradores pueden gestionar perfiles" on public.perfiles
    for all using (
        exists (
            select 1 from auth.users
            where auth.users.id = auth.uid()
              and auth.users.raw_user_meta_data->>'rol' = 'administrador'
        )
    );

-- 3. Clientes pueden crear su propio perfil al registrarse
create policy "Clientes pueden crear su propio perfil" on public.perfiles
    for insert with check (auth.uid() = id);

-- ============================================
-- Nota: Al crear usuarios de prueba en Supabase Studio (Authentication > Users),
-- asegúrate de agregar en "User metadata" el campo rol:
--   {"rol": "cliente"} o {"rol": "administrador"}
-- ============================================
