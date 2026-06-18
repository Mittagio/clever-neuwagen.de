# Clever lokal + WLAN (Handy im gleichen Netz)
# Ein Port (3001), externer Browser – kein Cursor Simple Browser noetig.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

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

function Test-FirewallRule($name) {
  $null = netsh advfirewall firewall show rule name="$name" 2>$null
  return $LASTEXITCODE -eq 0
}

Write-Host 'Frontend bauen ...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$port = 3001
$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  Write-Host "Port $port belegt (PID $($conn.OwningProcess)) - beende ..."
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

if (-not (Test-FirewallRule 'Clever Neuwagen 3001')) {
  Write-Host ''
  Write-Host 'WARNUNG: Windows-Firewall blockiert vermutlich Handy-Zugriff.' -ForegroundColor Yellow
  Write-Host 'Einmalig als Administrator:'
  Write-Host '  npm run dev:mobile:firewall'
  Write-Host ''
}

$lanIp = Get-LanIp
$path = '/haendler/autohaus-trinkle'
$urlPc = "http://localhost:$port$path"
$urlPhone = "http://${lanIp}:$port$path"

Write-Host ''
Write-Host '=== Clever Neuwagen (WLAN) ===' -ForegroundColor Green
Write-Host "Am PC (Edge/Chrome):  $urlPc"
Write-Host "Am Handy (WLAN):      $urlPhone"
Write-Host ''
Write-Host 'Wichtig:'
Write-Host '  - Nicht Cursor Simple Browser – externer Browser nutzen'
Write-Host '  - Am Handy nie localhost – immer die IP oben'
Write-Host '  - Gleiches WLAN, kein Gast-WLAN / kein Mobilfunk'
Write-Host ''
Write-Host 'Server startet – Strg+C zum Beenden.' -ForegroundColor Cyan
Write-Host ''

$env:NODE_ENV = 'production'
$env:HOST = '0.0.0.0'
node server/index.js
