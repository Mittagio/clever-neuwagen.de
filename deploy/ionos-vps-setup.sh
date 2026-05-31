#!/usr/bin/env bash
# Clever-Neuwagen – Erstinstallation auf IONOS VPS (Ubuntu 22.04/24.04)
# Als root oder mit sudo ausführen.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clever-neuwagen}"
APP_USER="${APP_USER:-www-data}"

echo "==> System aktualisieren & Basis-Pakete"
apt-get update -qq
apt-get install -y curl git nginx

echo "==> Node.js 22 (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> PM2 global"
npm install -g pm2

echo "==> App-Verzeichnis"
mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$(dirname "$APP_DIR")"

echo ""
echo "Nächste Schritte (manuell):"
echo "  1. Projekt nach $APP_DIR kopieren (git clone / scp / rsync)"
echo "  2. cd $APP_DIR && npm ci && npm run build"
echo "  3. cp .env.example .env && nano .env"
echo "  4. pm2 start ecosystem.config.cjs --env production"
echo "  5. pm2 save && pm2 startup"
echo "  6. sudo cp deploy/clever-neuwagen.de.nginx /etc/nginx/sites-available/clever-neuwagen"
echo "  7. DNS A @ + www → VPS-IP | certbot --nginx -d clever-neuwagen.de -d www.clever-neuwagen.de"
