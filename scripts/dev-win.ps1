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

Write-Host 'Frontend bauen …'
& $node node_modules/vite/bin/vite.js build | Out-Host

if (-not (Test-Port 3001)) {
  Write-Host 'Server starten (Port 3001, Production) …'
  $env:NODE_ENV = 'production'
  Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $root -WindowStyle Minimized
  Start-Sleep -Seconds 2
}

$url = 'http://localhost:3001'
Write-Host ''
Write-Host "App:     $url"
Write-Host "Händler: $url/haendler/autohaus-trinkle"
Write-Host "API:     $url/health"
Write-Host ''
Write-Host 'Im externen Browser öffnen (nicht Cursor Simple Browser auf :5173).'

if ($edge) {
  Start-Process $edge $url
} else {
  Start-Process $url
}
