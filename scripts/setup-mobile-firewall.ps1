# Einmalig als Administrator ausfuehren – erlaubt Handy-Zugriff auf Port 3001 + 5173
# Rechtsklick PowerShell → "Als Administrator ausfuehren":
#   npm run dev:mobile:firewall

$ErrorActionPreference = 'Stop'

function Ensure-FirewallRule {
  param([string]$RuleName, [int]$Port)
  $null = netsh advfirewall firewall show rule name="$RuleName" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Firewall-Regel '$RuleName' existiert bereits."
    return
  }
  netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port profile=private,domain
  Write-Host "Firewall-Regel erstellt: TCP $Port (privat + Domäne)."
}

Ensure-FirewallRule -RuleName 'Clever Neuwagen 3001' -Port 3001
Ensure-FirewallRule -RuleName 'Clever Neuwagen 5173' -Port 5173

Write-Host ''
Write-Host 'Fertig. Jetzt: npm run dev:wlan'
