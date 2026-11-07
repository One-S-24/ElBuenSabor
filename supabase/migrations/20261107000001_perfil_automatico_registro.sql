-- ==========================================================
-- MIGRACIÓN: Crear el perfil automáticamente al registrarse
-- ==========================================================
-- En producción la confirmación de correo está activada, por lo que
-- `auth.signUp()` no devuelve una sesión y el frontend no puede insertar
-- el perfil (RLS exige auth.uid()). Este trigger crea el perfil desde los
-- metadatos del usuario en el momento del registro, sin importar si la
-- cuenta queda pendiente de confirmar.
-- ==========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_nombre text;
    v_telefono text;
    v_rol text;
begin
    v_nombre := coalesce(
        nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
        split_part(coalesce(new.email, 'cliente'), '@', 1)
    );
    v_telefono := coalesce(
        nullif(trim(new.raw_user_meta_data->>'telefono_whatsapp'), ''),
        nullif(trim(new.raw_user_meta_data->>'telefono'), ''),
        ''
    );
    v_rol := case
        when new.raw_user_meta_data->>'rol' = 'administrador' then 'administrador'
        else 'cliente'
    end;

    insert into public.perfiles (id, nombre, telefono_whatsapp, rol)
    values (new.id, v_nombre, v_telefono, v_rol)
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
