-- ============================================
-- MIGRACIÓN: Corregir permiso denegado en tabla auth.users
-- ============================================

-- La política anterior consultaba auth.users directamente, lo que causa
-- "permission denied for table users" para el rol autenticated.
-- Se reemplaza por auth.jwt() que lee los claims del token JWT sin
-- consultar ninguna tabla del sistema.

drop policy if exists "Administradores pueden gestionar perfiles" on public.perfiles;

create policy "Administradores pueden gestionar perfiles" on public.perfiles
    for all using (
        (auth.jwt() -> 'user_metadata' ->> 'rol') = 'administrador'
    );

-- ============================================
-- Nota: Al crear usuarios en Supabase Studio (Authentication > Users),
-- agrega en "User metadata" el campo rol:
--   {"rol": "cliente"} o {"rol": "administrador"}
-- ============================================
