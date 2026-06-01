#!/usr/bin/env bash
# Update nach git push – auf dem VPS ausführen
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clever-neuwagen}"
APP_NAME="${APP_NAME:-clever-neuwagen}"

cd "${APP_DIR}"

echo "==> Git pull"
git pull --ff-only

echo "==> Dependencies & Build"
npm ci
npm run build

echo "==> PM2 restart"
pm2 restart "${APP_NAME}" --update-env
pm2 save

echo ""
echo "Update fertig. Health:"
curl -sf "http://127.0.0.1:3001/health" || echo "(Health-Check fehlgeschlagen – pm2 logs prüfen)"
