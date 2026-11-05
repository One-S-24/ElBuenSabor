insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
values (
  'e734f02d-ea24-4edd-a0d9-471685d0f1c1',  -- reemplaza con el id de auth.users
  'Juan Manuel Pérez',
  '+50588887777',
  'cliente',
  2000.00
);

-- Perfil administrador
insert into public.perfiles (id, nombre, telefono_whatsapp, rol, limite_credito)
values (
  '21a37ec9-75ba-448c-be93-4e3142577f3f',    -- reemplaza con el id de auth.users
  'Silvana Torres',
  '+50577778888',
  'administrador',
  2000.00
);