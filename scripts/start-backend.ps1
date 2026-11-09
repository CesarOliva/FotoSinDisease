$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$python = Join-Path $backend '.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    throw "No existe el entorno virtual: $python"
}

Set-Location $backend
& $python -m uvicorn main:app --host 127.0.0.1 --port 8000
