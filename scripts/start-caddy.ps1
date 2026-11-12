$ErrorActionPreference = 'Stop'

$caddy = Join-Path $env:LOCALAPPDATA 'FotoSinDisease\bin\caddy.exe'
$config = Join-Path $PSScriptRoot 'Caddyfile'

if (-not (Test-Path $caddy)) {
    throw "Falta Caddy en $caddy"
}

& $caddy run --config $config --adapter caddyfile
