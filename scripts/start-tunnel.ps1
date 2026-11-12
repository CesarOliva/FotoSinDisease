$ErrorActionPreference = 'Stop'

$cloudflared = Join-Path $env:LOCALAPPDATA 'FotoSinDisease\bin\cloudflared.exe'

if (-not (Test-Path $cloudflared)) {
    throw "Falta cloudflared en $cloudflared"
}

& $cloudflared tunnel --url http://localhost:8080 --no-autoupdate
