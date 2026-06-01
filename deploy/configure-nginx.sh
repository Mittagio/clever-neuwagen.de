#!/usr/bin/env bash
# nginx-Site für clever-neuwagen.de aktivieren
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clever-neuwagen}"
SITE_NAME="clever-neuwagen"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

if [[ ! -f "${APP_DIR}/deploy/clever-neuwagen.de.nginx" ]]; then
  echo "Fehler: ${APP_DIR}/deploy/clever-neuwagen.de.nginx nicht gefunden."
  echo "APP_DIR setzen oder aus dem Projektverzeichnis ausführen."
  exit 1
fi

echo "==> nginx-Site installieren"
cp "${APP_DIR}/deploy/clever-neuwagen.de.nginx" "${NGINX_AVAILABLE}"
ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
  echo "    Standard-Site deaktiviert"
fi

echo "==> nginx testen & neu laden"
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "nginx aktiv. Nächster Schritt:"
echo "  sudo certbot --nginx -d clever-neuwagen.de -d www.clever-neuwagen.de"
