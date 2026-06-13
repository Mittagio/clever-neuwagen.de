# Clever lokal vom Handy testen (gleiches WLAN)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$node = Join-Path $root '.tools\node\node.exe'
if (-not (Test-Path $node)) {
  Write-Host 'Bitte zuerst: npm run dev:win'
  exit 1
}

function Get-LanIp {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($ip) { return $ip }
  return 'localhost'
}

Write-Host 'Frontend bauen ...'
& $node (Join-Path $root 'node_modules/vite/bin/vite.js') build | Out-Host

$port = 3001
$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  Write-Host "Port $port belegt (PID $($conn.OwningProcess)) - beende ..."
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

Write-Host "Server starten auf 0.0.0.0 Port $port ..."
$env:NODE_ENV = 'production'
$env:HOST = '0.0.0.0'
Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $root -WindowStyle Minimized
Start-Sleep -Seconds 2

$lanIp = Get-LanIp
$urlPc = 'http://localhost:' + $port + '/haendler/autohaus-trinkle'
$urlPhone = 'http://' + $lanIp + ':' + $port + '/haendler/autohaus-trinkle'

Write-Host ''
Write-Host 'Am PC:    ' $urlPc
Write-Host 'Am Handy: ' $urlPhone
Write-Host ''
Write-Host 'Voraussetzung: Handy im gleichen WLAN wie dieser PC.'
Write-Host 'Windows-Firewall ggf. Zugriff auf Port 3001 erlauben.'
