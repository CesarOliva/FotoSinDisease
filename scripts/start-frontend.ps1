$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $frontend '.next'))) {
    throw 'Falta el build de produccion. Ejecuta scripts\build-frontend.ps1 primero.'
}

Set-Location $frontend
npm run start -- -H 127.0.0.1 -p 3000
