-- ==========================================================
-- MIGRACIÓN: Permitir que el cliente actualice su WhatsApp
-- ==========================================================
-- El teléfono es la vía por la que Cobranza envía los recordatorios.
-- En lugar de abrir un UPDATE genérico sobre `perfiles` (que permitiría
-- cambiar `rol` o `limite_credito`), se expone una RPC que solo toca
-- el teléfono del usuario autenticado.
-- ==========================================================

create or replace function public.actualizar_mi_telefono(p_telefono text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_id uuid := auth.uid();
    v_tel text;
    v_digitos text;
begin
    if v_id is null then
        return json_build_object('success', false, 'error', 'No autenticado');
    end if;

    v_tel := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');

    if left(v_tel, 1) = '+' then
        v_tel := '+' || regexp_replace(substr(v_tel, 2), '[^0-9]', '', 'g');
    else
        v_digitos := regexp_replace(v_tel, '[^0-9]', '', 'g');
        if length(v_digitos) = 8 then
            -- Número local de Nicaragua: 88887777 -> +50588887777
            v_tel := '+505' || v_digitos;
        elsif left(v_digitos, 3) = '505' and length(v_digitos) = 11 then
            v_tel := '+' || v_digitos;
        else
            v_tel := '+' || v_digitos;
        end if;
    end if;

    if v_tel !~ '^\+[1-9][0-9]{7,14}$' then
        return json_build_object(
            'success', false,
            'error', 'Teléfono inválido. Usa el formato +50588887777.'
        );
    end if;

    update public.perfiles
    set telefono_whatsapp = v_tel
    where id = v_id;

    if not found then
        return json_build_object('success', false, 'error', 'Perfil no encontrado');
    end if;

    return json_build_object('success', true, 'telefono_whatsapp', v_tel);
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.actualizar_mi_telefono(text) from public, anon;
grant execute on function public.actualizar_mi_telefono(text) to authenticated;
