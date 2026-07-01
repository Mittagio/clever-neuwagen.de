# App lokal starten (Windows, auch ohne Node im PATH)
# Hinweis: Cursor Simple Browser zeigt Port 5173 oft leer – externer Browser + Port 3001 nutzen.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $root '.tools'
$nodeDir = Join-Path $tools 'node'
$node = Join-Path $nodeDir 'node.exe'
$zip = Join-Path $tools 'node-win-x64.zip'
$edge = @(
  "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not (Test-Path $node)) {
  Write-Host 'Node.js wird nach .tools/node heruntergeladen …'
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip' -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tools -Force
  Rename-Item (Join-Path $tools 'node-v22.16.0-win-x64') $nodeDir -Force
}

function Test-Port($port) {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 2
      return $r.StatusCode -eq 200
    } catch { return $false }
  }
}

function Stop-ServerOnPort($port) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($conn in $connections) {
    if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
      Write-Host "Beende Prozess auf Port $port (PID $($conn.OwningProcess)) …"
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
  if ($connections) { Start-Sleep -Seconds 1 }
}

Write-Host 'Frontend bauen …'
& $node node_modules/vite/bin/vite.js build | Out-Host

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
  return $null
}

if (Test-Port 3001) {
  Write-Host 'Server auf Port 3001 wird neu gestartet (aktueller Code) …'
  Stop-ServerOnPort 3001
}

Write-Host 'Server starten (Port 3001, Production, WLAN-faehig) …'
$env:NODE_ENV = 'production'
$env:HOST = '0.0.0.0'
Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $root -WindowStyle Minimized
Start-Sleep -Seconds 2

function Get-OpenAiHealth {
  try {
    $h = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/v1/clever/customer-query/health' -TimeoutSec 3
    return $h
  } catch {
    return $null
  }
}

$url = 'http://localhost:3001'
$lanIp = Get-LanIp
Write-Host ''
Write-Host "App (PC):     $url"
Write-Host "Händler:      $url/haendler/autohaus-trinkle"
if ($lanIp) {
  Write-Host "WLAN (Handy): http://${lanIp}:3001/haendler/autohaus-trinkle"
}
Write-Host "API:          $url/health"
$openAi = Get-OpenAiHealth
if ($openAi) {
  $configured = if ($openAi.openAiConfigured) { 'ja' } else { 'nein (OPENAI_API_KEY in .env.local setzen)' }
  $advisor = if ($openAi.advisorUseOpenAi) { 'aktiv' } else { 'aus (ADVISOR_USE_OPENAI=true)' }
  Write-Host "OpenAI:       konfiguriert=$configured, Berater=$advisor"
}
Write-Host ''
Write-Host 'Im externen Browser oeffnen (nicht Cursor Simple Browser auf :5173).'

if ($edge) {
  Start-Process $edge $url
} else {
  Start-Process $url
}
