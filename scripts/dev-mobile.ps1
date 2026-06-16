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

function Test-FirewallRule {
  $null = netsh advfirewall firewall show rule name='Clever Neuwagen 3001' 2>$null
  return $LASTEXITCODE -eq 0
}

Write-Host 'Frontend bauen ...'
& $node (Join-Path $root 'node_modules/vite/bin/vite.js') build | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$port = 3001
$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  Write-Host "Port $port belegt (PID $($conn.OwningProcess)) - beende ..."
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

if (-not (Test-FirewallRule)) {
  Write-Host ''
  Write-Host 'WARNUNG: Windows-Firewall blockiert vermutlich den Handy-Zugriff.' -ForegroundColor Yellow
  Write-Host 'Einmalig als Administrator ausfuehren:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File scripts/setup-mobile-firewall.ps1'
  Write-Host ''
}

$lanIp = Get-LanIp
$urlPc = "http://localhost:$port/haendler/autohaus-trinkle"
$urlPhone = "http://${lanIp}:$port/haendler/autohaus-trinkle"

Write-Host ''
Write-Host '=== Handy-Test ===' -ForegroundColor Cyan
Write-Host "Am PC:    $urlPc"
Write-Host "Am Handy: $urlPhone"
Write-Host ''
Write-Host 'Voraussetzungen:'
Write-Host '  - Handy im gleichen WLAN (nicht Mobilfunk)'
Write-Host '  - Nicht localhost am Handy – immer die IP oben nutzen'
Write-Host '  - Gast-WLAN oft isoliert (Handy sieht PC nicht)'
Write-Host ''
Write-Host 'Server laeuft – Strg+C zum Beenden.' -ForegroundColor Green
Write-Host ''

$env:NODE_ENV = 'production'
$env:HOST = '0.0.0.0'
& $node (Join-Path $root 'server/index.js')
