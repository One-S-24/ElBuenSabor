-- ==========================================================
-- MIGRACIÓN: el cliente puede leer sus propias notificaciones
-- ==========================================================
-- La tabla ya tenía RLS habilitado, pero solo existían políticas
-- para administradores. La Edge Function `notificaciones` consulta
-- con el JWT del cliente, por lo que necesita esta política.

drop policy if exists "Clientes ven sus notificaciones" on public.bitacora_notificaciones;

create policy "Clientes ven sus notificaciones" on public.bitacora_notificaciones
    for select
    using (auth.uid() = cliente_id);
