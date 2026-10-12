# Módulo de Autenticación - El Buen Sabor

## Estructura de Edge Functions

```
supabase/functions/
├── auth/
│   ├── signup/           # Registro de usuarios (admin crea usuarios)
│   ├── login/            # Inicio de sesión
│   ├── logout/           # Cierre de sesión
│   ├── password-reset/   # Recuperación de contraseña
│   ├── me/               # Obtener perfil del usuario autenticado
│   ├── update-profile/   # Actualizar perfil propio
│   └── admin/
│       ├── users/        # Listar todos los usuarios (solo admin)
│       ├── update-role/  # Cambiar rol de usuario (solo admin)
│       └── delete-user/  # Eliminar usuario (solo admin)
└── _shared/
    └── supabase.ts       # Cliente Supabase compartido
```

## Endpoints de Autenticación

### POST `/functions/v1/auth/signup`
Registra un nuevo usuario (requiere service role key).

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123",
  "nombre": "Juan Pérez",
  "telefono_whatsapp": "+50588887777",
  "rol": "cliente"
}
```

### POST `/functions/v1/auth/login`
Inicia sesión con email y password.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": { ... },
  "session": { ... },
  "perfil": { "id": "...", "nombre": "...", "rol": "cliente", ... }
}
```

### POST `/functions/v1/auth/logout`
Cierra la sesión actual.

### POST `/functions/v1/auth/password-reset`
Solicita email de recuperación o restablece contraseña.

**Solicitar email:**
```json
{ "email": "usuario@ejemplo.com" }
```

**Restablecer con token:**
```json
{ "reset_token": "token_desde_email", "password": "nueva_password" }
```

### GET `/functions/v1/auth/me`
Obtiene el perfil del usuario autenticado (requiere Authorization header).

### PATCH `/functions/v1/auth/update-profile`
Actualiza el perfil del usuario autenticado.

**Body:**
```json
{
  "nombre": "Nuevo Nombre",
  "telefono_whatsapp": "+50588887777"
}
```

## Endpoints de Administración (requieren rol administrador)

### GET `/functions/v1/auth/admin/users`
Lista todos los usuarios con sus perfiles.

### PATCH `/functions/v1/auth/admin/update-role`
Cambia el rol de un usuario.

**Body:**
```json
{
  "user_id": "uuid-del-usuario",
  "rol": "administrador"
}
```

### DELETE `/functions/v1/auth/admin/delete-user`
Elimina un usuario.

**Body:**
```json
{
  "user_id": "uuid-del-usuario"
}
```

## Despliegue Local

1. Instalar Supabase CLI:
```bash
npm install -g supabase
```

2. Iniciar stack local:
```bash
supabase start
```

3. Desplegar funciones:
```bash
supabase functions deploy
```

## Variables de Entorno Requeridas

Copiar `.env.example` a `.env` y configurar:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `JWT_SECRET`

## Base de Datos

Ejecutar migración:
```bash
supabase db reset
```

Esto creará todas las tablas, enums, funciones RPC y políticas RLS definidas en `migrations/20261011000000_initial_schema.sql`.