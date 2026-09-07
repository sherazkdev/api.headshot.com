#!/usr/bin/env bash
# ONE command on VPS: PM2 + nginx SSL for https://aiheadshotapi.com
#
# Kyun Cursor se nginx/pm2 auto-start nahi hota?
#   Hum tumhari VPS par SSH nahi karte — sirf code push karte hain.
#   Tum VPS terminal par ye script chalate ho.
#
# Usage (root ya user on VPS):
#   cd /var/www/headshot-api && git pull && bash deploy/start-production.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
DOMAIN="${DOMAIN:-aiheadshotapi.com}"
SITE_SSL="headshot-api-ssl"
AVAILABLE="/etc/nginx/sites-available/${SITE_SSL}"
ENABLED="/etc/nginx/sites-enabled/${SITE_SSL}"
OLD_SITE="/etc/nginx/sites-enabled/headshot-api"

cd "$APP_DIR"

echo "============================================"
echo " headshot-api production: PM2 + nginx + SSL"
echo " domain: https://${DOMAIN}"
echo "============================================"

# 1) .env check
if [[ ! -f .env ]]; then
  cp deploy/env.production.example .env
  echo ">>> .env created from template — EDIT secrets then re-run!"
  exit 1
fi

bash deploy/check-env.sh

# Required production URLs
if ! grep -q '^PUBLIC_BASE_URL=https://aiheadshotapi.com' .env 2>/dev/null; then
  echo "WARN: set PUBLIC_BASE_URL=https://aiheadshotapi.com in .env"
fi

# 2) Build + PM2 (internal 127.0.0.1:3016)
echo ""
echo ">>> PM2 start..."
npm run build:api
pm2 stop headshot-api 2>/dev/null || true
pm2 delete headshot-api 2>/dev/null || true
APP_DIR="$APP_DIR" pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 2
API_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '"' | xargs)"
API_PORT="${API_PORT:-3016}"
curl -fsS "http://127.0.0.1:${API_PORT}/v1/health" && echo "PM2 OK on :${API_PORT}" || {
  echo "PM2 health failed — pm2 logs headshot-api"
  exit 1
}

# 3) Disable old port-3016 nginx proxy (conflict)
rm -f "$OLD_SITE" 2>/dev/null || true

# 4) nginx SSL config
echo ""
echo ">>> nginx SSL config..."
DOMAIN="$DOMAIN" APP_ROOT="$APP_DIR" bash deploy/nginx/render-ssl-config.sh

if [[ ! -d /etc/nginx/sites-available ]]; then
  echo "ERROR: nginx not installed"
  exit 1
fi

cp deploy/nginx/headshot-api-ssl.conf "$AVAILABLE"
ln -sf "$AVAILABLE" "$ENABLED"

nginx -t
nginx -s reload 2>/dev/null || systemctl reload nginx

# 5) SSL certificate (if missing)
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [[ ! -f "$CERT" ]]; then
  echo ""
  echo ">>> SSL certificate install..."
  bash deploy/ssl-install.sh
  nginx -t && nginx -s reload
else
  echo "SSL certificate already exists: $CERT"
fi

echo ""
echo "============================================"
echo " DONE"
echo " API:  https://${DOMAIN}/v1/health"
echo " Docs: https://${DOMAIN}/docs"
echo " PM2:  pm2 logs headshot-api"
echo "============================================"

curl -fsS "https://${DOMAIN}/v1/health" && echo "" || echo "HTTPS test failed — DNS/cert check karo"
