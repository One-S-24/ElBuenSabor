# Comedor El Buen Sabor

Aplicación web para gestionar pedidos, menú diario y cobranza quincenal de un
comedor, con panel de administración y notificaciones por WhatsApp.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions en Deno)
- **WhatsApp:** [OpenWA](https://github.com/rmyndharis/OpenWA) autoalojado con Docker

## Inicio rápido

```bash
npm install

# Variables del frontend (.env)
# VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
# VITE_SUPABASE_ANON_KEY=tu_anon_key

npm run dev
```

## Acceso desde el teléfono (red local)

Vite escucha en todas las interfaces, así que el teléfono puede abrir la app si
está en la misma red Wi-Fi que la computadora:

1. Obtén la IP local de la computadora:

   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 |
     Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
     Select-Object IPAddress, InterfaceAlias
   ```

2. Con `npm run dev` activo, abre en el teléfono
   `http://<IP_LOCAL>:5173/login` (por ejemplo `http://192.168.1.26:5173/login`).
3. En la computadora usa `http://localhost:5173/login` o la misma IP.

La URL de Supabase se ajusta sola: si `VITE_SUPABASE_URL` apunta a
`127.0.0.1` y la página se abre desde otra IP, el cliente reemplaza el host por
el de la página. Ambos dispositivos deben poder alcanzar los puertos `54321`
(Supabase) y `2785` (OpenWA).

Si el teléfono no carga la página, permite Node.js/Vite en el Firewall de
Windows para redes privadas y públicas, y verifica que la red Wi-Fi esté
marcada como privada cuando sea posible.

## Base de datos

```bash
supabase link --project-ref tu-proyecto
supabase db push
```

Las migraciones están en `supabase/migrations/`. Incluyen el esquema inicial,
las RPC de cuentas quincenales y la integración con OpenWA.

## Edge Functions

```bash
# Solo la integración de WhatsApp
supabase functions deploy whatsapp
```

La función `whatsapp` (carpeta `supabase/functions/whatsapp`) requiere JWT de
un usuario con rol `administrador`. El CLI de Supabase solo descubre funciones
en carpetas de primer nivel, por eso no está anidada bajo `admin/`.

## WhatsApp (OpenWA)

La integración completa está documentada en **[OPENWA.md](./OPENWA.md)**.

Resumen:

```bash
npm run openwa:up     # levanta el gateway en http://localhost:2785
npm run openwa:key    # muestra la API key
```

Luego entra a `/admin/whatsapp`, guarda la URL, la sesión y la API key, conecta
la sesión y escanea el QR con WhatsApp.

> OpenWA no es la API oficial de WhatsApp. Usa un número dedicado y respeta las
> pausas entre envíos para reducir el riesgo de bloqueo.

## Scripts

| Comando | Descripción |
| ------- | ----------- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | Linter (oxlint) |
| `npm run openwa:up` | Levantar OpenWA con Docker |
| `npm run openwa:down` | Detener OpenWA (conserva datos) |
| `npm run openwa:key` | Leer la API key del contenedor |
| `npm run openwa:logs` | Ver logs de OpenWA |

## Estructura

```
src/
  pages/          Vistas de cliente y administración
  services/       Acceso a Supabase y Edge Functions
  layouts/        Layouts de cliente y admin
  router/         Rutas protegidas por rol
supabase/
  migrations/     Esquema y RPC de Postgres
  functions/      Edge Functions (Deno)
docker-compose.openwa.yml
OPENWA.md
```
