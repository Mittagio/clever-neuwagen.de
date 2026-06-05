#!/usr/bin/env bash
# Clever-Neuwagen – Erstinstallation auf IONOS VPS (Ubuntu 22.04/24.04)
# Als root oder mit sudo ausführen.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clever-neuwagen}"
APP_USER="${APP_USER:-www-data}"
PILOT_DATA_DIR="${PILOT_DATA_DIR:-/var/lib/clever-neuwagen/data}"

echo "==> System aktualisieren & Basis-Pakete"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y curl git nginx ufw

echo "==> Node.js 22 (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> PM2 global"
npm install -g pm2

echo "==> Firewall (ufw)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> App-Verzeichnis"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$(dirname "$APP_DIR")" 2>/dev/null || true

echo "==> Pilot-Daten (Berater JSON-Stores)"
mkdir -p "$PILOT_DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$PILOT_DATA_DIR" 2>/dev/null || true

echo ""
echo "✓ Basis-Installation abgeschlossen."
echo ""
echo "Nächste Schritte (siehe DEPLOY.md):"
echo "  1. git clone https://github.com/Mittagio/clever-neuwagen.de.git $APP_DIR"
echo "  2. cd $APP_DIR && npm ci && npm run build"
echo "  3. cp .env.example .env && nano .env"
echo "  4. pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup"
echo "  5. sudo bash deploy/configure-nginx.sh"
echo "  6. DNS: A @ + www → VPS-IP"
echo "  7. sudo apt install -y certbot python3-certbot-nginx"
echo "     sudo certbot --nginx -d clever-neuwagen.de -d www.clever-neuwagen.de"
