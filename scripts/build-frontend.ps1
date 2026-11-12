$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $frontend '.env.production.local'))) {
    throw 'Falta frontend/.env.production.local'
}

Set-Location $frontend
npm run build
