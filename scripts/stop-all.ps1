$ErrorActionPreference = 'SilentlyContinue'

foreach ($port in 3000, 8000, 8080) {
    Get-NetTCPConnection -State Listen -LocalPort $port |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force }
}

Get-Process cloudflared | Stop-Process -Force
Get-Process caddy | Stop-Process -Force

Write-Host 'Servicios detenidos.'
