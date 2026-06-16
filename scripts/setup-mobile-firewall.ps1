# Einmalig als Administrator ausfuehren – erlaubt Handy-Zugriff auf Port 3001
# Rechtsklick PowerShell → "Als Administrator ausfuehren":
#   powershell -ExecutionPolicy Bypass -File scripts/setup-mobile-firewall.ps1

$ErrorActionPreference = 'Stop'
$ruleName = 'Clever Neuwagen 3001'
$port = 3001

$existing = netsh advfirewall firewall show rule name="$ruleName" 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Firewall-Regel '$ruleName' existiert bereits."
} else {
  netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$port profile=private,domain
  Write-Host "Firewall-Regel erstellt: TCP $port (privat + Domäne)."
}

Write-Host ''
Write-Host 'Fertig. Jetzt: npm run dev:mobile'
