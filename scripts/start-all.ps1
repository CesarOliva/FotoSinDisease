$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$cloudflared = Join-Path $env:LOCALAPPDATA 'FotoSinDisease\bin\cloudflared.exe'

if (-not (Test-Path (Join-Path $frontend '.next'))) {
    throw 'Falta el build de produccion. Ejecuta scripts\build-frontend.ps1 primero.'
}
if (-not (Test-Path $cloudflared)) {
    throw "Falta cloudflared en $cloudflared"
}

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Wait-Port($port, $timeoutSec = 45) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Start-Window($scriptPath, $title) {
    $args = "-NoExit -ExecutionPolicy Bypass -Command `"`$Host.UI.RawUI.WindowTitle = '$title'; & '$scriptPath'`""
    Start-Process powershell -ArgumentList $args | Out-Null
}

if (-not (Test-Port 11434)) {
    Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden
    if (-not (Wait-Port 11434 30)) { throw 'Ollama no arranco en el puerto 11434' }
}

if (-not (Test-Port 8000)) { Start-Window (Join-Path $PSScriptRoot 'start-backend.ps1') 'FotoSinDisease backend' }
if (-not (Wait-Port 8000)) { throw 'El backend no arranco en el puerto 8000' }

if (-not (Test-Port 3000)) { Start-Window (Join-Path $PSScriptRoot 'start-frontend.ps1') 'FotoSinDisease frontend' }
if (-not (Wait-Port 3000)) { throw 'El frontend no arranco en el puerto 3000' }

if (-not (Test-Port 8080)) { Start-Window (Join-Path $PSScriptRoot 'start-caddy.ps1') 'FotoSinDisease proxy' }
if (-not (Wait-Port 8080)) { throw 'Caddy no arranco en el puerto 8080' }

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host ''
Write-Host 'Servicios locales activos:'
Write-Host "  LAN:  http://${lanIp}:8080"
Write-Host ''
Write-Host 'Iniciando tunel publico...'

$outLog = Join-Path $env:TEMP 'florasense-tunnel.out.log'
$errLog = Join-Path $env:TEMP 'florasense-tunnel.err.log'
Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

$tunnel = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--url', 'http://localhost:8080', '--no-autoupdate') -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden

$publicUrl = $null
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline -and -not $publicUrl) {
    Start-Sleep -Milliseconds 800
    $text = ''
    foreach ($f in @($outLog, $errLog)) {
        if (Test-Path $f) { $text += (Get-Content $f -Raw -ErrorAction SilentlyContinue) }
    }
    $match = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) { $publicUrl = $match.Value }
}

if ($publicUrl) {
    Write-Host ''
    Write-Host "  Publica: $publicUrl"
} else {
    throw "No se pudo obtener la URL del tunel. Revisa $errLog"
}
