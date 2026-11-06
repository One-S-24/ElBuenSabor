# Integración con OpenWA (WhatsApp)

Este proyecto envía notificaciones reales de WhatsApp usando
[OpenWA](https://github.com/rmyndharis/OpenWA), un gateway autoalojado que
controla WhatsApp Web mediante `whatsapp-web.js`.

La API key **nunca** llega al navegador: el frontend llama a la Edge Function
`whatsapp`, y esta habla con OpenWA del lado del servidor.

```
React (panel admin)
   │  supabase.functions.invoke('whatsapp/...')
   ▼
Edge Function (Deno) ── X-API-Key ──► OpenWA ──► WhatsApp
   │
   └── registra el envío en public.bitacora_notificaciones
```

## 1. Levantar OpenWA

Requisitos: Docker Desktop encendido.

```bash
npm run openwa:up
```

Esto usa `docker-compose.openwa.yml` y deja:

- Dashboard/API: <http://localhost:2785>
- Swagger: <http://localhost:2785/api/docs>
- Datos persistentes en el volumen `openwa-data` (SQLite + sesión de WhatsApp).

Comandos útiles:

```bash
npm run openwa:logs    # ver logs
npm run openwa:down    # detener (los datos se conservan)
```

### Obtener la API key

```bash
npm run openwa:key
```

Copia el valor completo, sin espacios ni saltos de línea. Es la clave que se
guarda en el panel de administración.

## 2. Aplicar la migración

```bash
supabase db push
# o, en local:
supabase migration up
```

La migración `20261105000000_openwa_integration.sql`:

- agrega `openwa` al check de `whatsapp_config.proveedor`;
- agrega la columna `session_id`;
- agrega columnas de trazabilidad a `bitacora_notificaciones`
  (`telefono_destino`, `message_id`, `contenido_enviado`, `error_mensaje`,
  `idempotency_key`);
- permite al administrador actualizar la bitácora;
- deja obsoletos los RPC que simulaban envíos.

## 3. Configurar desde el panel

1. Entra como administrador a **WhatsApp OpenWA** (`/admin/whatsapp`).
2. Completa:
   - **URL base**: `http://host.docker.internal:2785` si OpenWA corre en el
     host y Supabase en Docker. Si OpenWA está en otro equipo de la red, usa la
     IP LAN (`http://192.168.x.x:2785`). En producción usa HTTPS.
   - **Sesión**: `el-buen-sabor` (solo letras, números y guiones).
   - **API key**: la obtenida con `npm run openwa:key`.
   - **Código de país**: `505` para Nicaragua.
   - **Pausa entre envíos**: 1200 ms o más.
3. Marca **Configuración activa** y guarda.
4. Pulsa **Conectar / Iniciar**.
5. Escanea el QR desde WhatsApp → **Dispositivos vinculados** →
   **Vincular dispositivo**.
6. Cuando el estado sea **Conectado**, usa **Enviar mensaje de prueba**.

> El QR se refresca automáticamente mientras la sesión está iniciando.
> Si expira, pulsa **Actualizar QR** o reinicia la conexión.

### Alternativa: secrets de Supabase

La configuración también puede venir de secrets (útil en producción sin panel):

```bash
supabase secrets set \
  OPENWA_BASE_URL=https://openwa.tudominio.com \
  OPENWA_API_KEY=tu_api_key \
  OPENWA_SESSION_ID=el-buen-sabor
```

Si existe una fila activa en `whatsapp_config`, esa tiene prioridad. Si no,
la Edge Function usa las variables `OPENWA_*`.

## 4. Enviar notificaciones

- **Cobranza quincenal** (`/admin/cobranza`): el botón *Enviar WA* de cada
  cliente y el botón masivo llaman a la Edge Function. El envío masivo aplica
  pausas entre mensajes y limita el lote a 100 destinatarios.
- **Panel WhatsApp** (`/admin/whatsapp`): prueba de conexión, QR, bitácora y
  reintento de fallidos.
- Cada envío queda registrado en `bitacora_notificaciones` con el `message_id`
  de OpenWA, el texto enviado, el teléfono normalizado y el error si falló.

Los teléfonos se normalizan así:

| Entrada        | chatId            |
| -------------- | ----------------- |
| `+50588887777` | `50588887777@c.us` |
| `88887777`     | `50588887777@c.us` |

## 5. Endpoints de la Edge Function

Base: `supabase.functions.invoke('whatsapp', ...)`

| Ruta | Método | Descripción |
| ---- | ------ | ----------- |
| `/config` | GET, POST | Listar / crear configuración |
| `/config/{id}` | GET, PUT, DELETE | Editar / eliminar configuración |
| `/plantillas` | GET, POST | Listar / crear plantillas |
| `/plantillas/{id}` | GET, PUT, DELETE | Editar / eliminar plantilla |
| `/enviar` | POST | Enviar a un cliente con una plantilla |
| `/enviar-masivo` | POST | Corte quincenal a morosos |
| `/probar` | POST | Mensaje de prueba |
| `/bitacora` | GET | Historial con filtros y paginación |
| `/reintentar` | POST | Reintentar envíos fallidos |
| `/openwa/estado` | GET | Estado de la sesión |
| `/openwa/qr` | GET | QR en data URL |
| `/openwa/conectar` | POST | Crear/iniciar sesión y obtener QR |
| `/openwa/detener` | POST | Detener sesión |

> OpenWA identifica internamente cada sesión con un UUID. La Edge Function
> traduce el nombre configurado (`session_id`) al UUID automáticamente, así que
> en el panel solo necesitas escribir el nombre.

## 6. Desarrollo local

> El CLI de Supabase descubre funciones en carpetas de **primer nivel** dentro
> de `supabase/functions/`. Por eso la función se llama `whatsapp` y no
> `admin/notificaciones`: las funciones anidadas no se sirven ni se despliegan
> con el CLI 3.x.

```bash
# 1. OpenWA
npm run openwa:up

# 2. Copiar variables de las funciones
copy supabase\functions\.env.example supabase\functions\.env

# 3. Servir las funciones (el CLI sirve todas las carpetas de primer nivel)
supabase functions serve --env-file supabase/functions/.env

# 4. Frontend
npm run dev
```

En macOS/Linux el comando de copia es `cp`.

## 7. Solución de problemas

| Síntoma | Causa probable | Solución |
| ------- | -------------- | -------- |
| `OpenWA no está disponible` | Contenedor apagado o URL incorrecta | `npm run openwa:up`; revisa `OPENWA_BASE_URL` |
| `La sesión no está conectada` (409) | QR no escaneado o sesión caída | Abre `/admin/whatsapp` y reconecta |
| `API key inválida` (401) | Clave incorrecta o revocada | Vuelve a copiar `npm run openwa:key` |
| `La sesión no existe` (404) | `session_id` distinto | Usa el mismo nombre o pulsa Conectar |
| `OpenWA limitó el envío` (429) | Pacing activo | Espera y sube `delay_ms` |

## 8. Advertencias

- OpenWA usa WhatsApp Web, **no la API oficial**. WhatsApp puede banear el
  número si detecta automatización o envíos masivos.
- Usa un número dedicado para el comedor, no el personal.
- "Calienta" el número: empieza con pocos envíos diarios y aumenta poco a poco.
- Respeta la pausa entre envíos y evita mandar mensajes idénticos en ráfaga.
- No expongas el puerto 2785 a Internet sin HTTPS, firewall y API key fuerte.
