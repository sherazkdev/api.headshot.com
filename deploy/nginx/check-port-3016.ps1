# Check whether port 3016 is free for headshot-api nginx (Windows / local dev).
$Port = 3016
Write-Host "=== headshot-api port $Port check ===" -ForegroundColor Cyan

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
    Write-Host "IN USE - port $Port is already listening:" -ForegroundColor Red
    $listeners | Format-Table LocalAddress, LocalPort, OwningProcess -AutoSize
    Get-Process -Id ($listeners.OwningProcess | Select-Object -Unique) -ErrorAction SilentlyContinue |
        Format-Table Id, ProcessName -AutoSize
    exit 1
}

$nginx = Get-Command nginx -ErrorAction SilentlyContinue
if ($nginx) {
    $conf = & nginx -T 2>$null
    if ($conf -match "listen\s+$Port") {
        Write-Host "IN USE - nginx config already listens on $Port" -ForegroundColor Red
        exit 1
    }
    Write-Host "nginx: no existing listen $Port in loaded config"
} else {
    Write-Host "nginx: not installed (skip config scan)"
}

Write-Host "FREE - port $Port is available for headshot-api.conf" -ForegroundColor Green
exit 0
