#!/usr/bin/env bash
# Update nach git push – auf dem VPS ausführen
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clever-neuwagen}"
APP_NAME="${APP_NAME:-clever-neuwagen}"
PILOT_DATA_DIR="${PILOT_DATA_DIR:-/var/lib/clever-neuwagen/data}"
APP_USER="${APP_USER:-www-data}"

echo "==> Pilot-Datenverzeichnis"
mkdir -p "${PILOT_DATA_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${PILOT_DATA_DIR}" 2>/dev/null || true

cd "${APP_DIR}"

echo "==> Git pull"
git pull --ff-only

echo "==> Dependencies & Build"
npm ci
npm run build:test

echo "==> PM2 restart"
pm2 restart "${APP_NAME}" --update-env
pm2 save

echo ""
echo "Update fertig. Health:"
curl -sf "http://127.0.0.1:3001/health" || echo "(Health-Check fehlgeschlagen – pm2 logs prüfen)"
echo ""
echo "Berater-Speicher:"
curl -sf "http://127.0.0.1:3001/api/v1/advisor/storage" || echo "(Storage-Diagnose fehlgeschlagen)"
