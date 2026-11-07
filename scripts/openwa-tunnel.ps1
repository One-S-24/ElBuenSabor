# ============================================================
# Expone OpenWA (contenedor local) con una URL HTTPS publica
# usando un Quick Tunnel de Cloudflare.
#
# Uso:
#   npm run openwa:tunnel
#   npm run openwa:tunnel -- -NoUpdate   # solo muestra la URL
#
# Requisitos:
#   - Docker Desktop encendido y `npm run openwa:up` ejecutado.
#   - Supabase CLI logueado (para actualizar la URL en la nube).
#
# NOTA: los Quick Tunnels generan una URL aleatoria nueva cada vez
# que se reinician. Este script actualiza automaticamente
# public.whatsapp_config.api_url para que produccion siga funcionando.
# ============================================================

param(
    [switch]$NoUpdate,
    [string]$ProjectRef = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cfDir = Join-Path $env:LOCALAPPDATA 'cloudflared'
$cfExe = Join-Path $cfDir 'cloudflared.exe'
$cfLog = Join-Path $cfDir 'quick-tunnel.log'
$cfOut = Join-Path $cfDir 'quick-tunnel.out.log'
$cfErr = Join-Path $cfDir 'quick-tunnel.err.log'
$cfPid = Join-Path $cfDir 'quick-tunnel.pid'
$openwaUrl = 'http://localhost:2785'

New-Item -ItemType Directory -Force -Path $cfDir | Out-Null

# 1. Descargar cloudflared si no existe
if (-not (Test-Path $cfExe)) {
    Write-Host 'Descargando cloudflared...' -ForegroundColor Cyan
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cfExe -TimeoutSec 180
}

# 2. Comprobar que OpenWA responde localmente (espera hasta 60 s)
$openwaReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-RestMethod -Uri "$openwaUrl/api/health" -TimeoutSec 5 | Out-Null
        $openwaReady = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $openwaReady) {
    throw "OpenWA no responde en $openwaUrl. Ejecuta primero: npm run openwa:up"
}

# 3. Detener un tunel anterior
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item $cfLog, $cfOut, $cfErr -ErrorAction SilentlyContinue

# 4. Arrancar el Quick Tunnel
$proc = Start-Process -FilePath $cfExe `
    -ArgumentList @('tunnel', '--url', $openwaUrl, '--no-autoupdate', '--logfile', $cfLog, '--loglevel', 'info') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $cfOut `
    -RedirectStandardError $cfErr `
    -PassThru
$proc.Id | Set-Content $cfPid

# 5. Esperar la URL publica
$publicUrl = $null
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $cfLog) {
        $match = Select-String -Path $cfLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($match) {
            $publicUrl = $match.Matches[0].Value
            break
        }
    }
}

if (-not $publicUrl) {
    throw "No se pudo obtener la URL del tunel. Revisa $cfLog"
}

# 6. Mostrar la URL publica
Write-Host ''
Write-Host 'URL publica de OpenWA:' -ForegroundColor Green
Write-Host "  $publicUrl" -ForegroundColor Green
Write-Host "  API: $publicUrl/api"
Write-Host ''

# 7. Actualizar la configuracion activa en Supabase Cloud
if (-not $NoUpdate) {
    Write-Host 'Actualizando la configuracion en Supabase Cloud...' -ForegroundColor Cyan
    try {
        if (-not $ProjectRef) {
            $refFile = Join-Path $repoRoot 'supabase\.temp\project-ref'
            if (-not (Test-Path $refFile)) {
                throw 'No se encontro supabase/.temp/project-ref. Vincula el proyecto con: supabase link'
            }
            $ProjectRef = (Get-Content $refFile -Raw).Trim()
        }

        $previousEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $rawKeys = supabase projects api-keys --project-ref $ProjectRef --output json 2>$null 3>$null
        $cliExit = $LASTEXITCODE
        $ErrorActionPreference = $previousEap
        if ($cliExit -ne 0 -or -not $rawKeys) {
            throw 'El CLI de Supabase no devolvio las API keys.'
        }
        $keys = $rawKeys | ConvertFrom-Json
        $serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
        if (-not $serviceKey) { throw 'No se pudo obtener la service_role key del CLI de Supabase.' }

        $headers = @{
            apikey        = $serviceKey
            Authorization = "Bearer $serviceKey"
            'Content-Type' = 'application/json'
            Prefer         = 'return=representation'
        }
        $body = @{ api_url = "$publicUrl/api" } | ConvertTo-Json
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

        $updated = Invoke-RestMethod -Method Patch `
            -Uri "https://$ProjectRef.supabase.co/rest/v1/whatsapp_config?activo=eq.true" `
            -Headers $headers -Body $bytes -TimeoutSec 30

        if ($updated.Count -gt 0) {
            Write-Host 'Configuracion de Supabase actualizada:' -ForegroundColor Green
            $updated | Select-Object id, nombre_config, api_url, activo | Format-List
        } else {
            Write-Warning 'No hay una fila activa en whatsapp_config. Configura la URL en /admin/whatsapp.'
        }
    } catch {
        Write-Warning "No se pudo actualizar Supabase automaticamente: $($_.Exception.Message)"
        Write-Host 'Actualiza la URL manualmente en /admin/whatsapp con:' -ForegroundColor Yellow
        Write-Host "  $publicUrl/api" -ForegroundColor Yellow
    }
}

# 8. Verificar el acceso publico (rapido; no bloquea la actualizacion)
$reachable = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        Invoke-RestMethod -Uri "$publicUrl/api/health" -TimeoutSec 8 | Out-Null
        $reachable = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if ($reachable) {
    Write-Host 'El tunel responde correctamente por HTTPS.' -ForegroundColor Green
} else {
    Write-Warning 'El tunel se creo pero aun no responde. Espera unos segundos y prueba de nuevo.'
}

Write-Host ''
Write-Host 'El tunel queda corriendo en segundo plano.' -ForegroundColor Cyan
Write-Host 'Si apagas el PC, reinicias Docker o cierras cloudflared, vuelve a ejecutar: npm run openwa:tunnel'
