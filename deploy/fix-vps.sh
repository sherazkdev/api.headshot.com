#!/usr/bin/env bash
# Safe fix — ONLY headshot-api PM2 + optional nginx snippet.
# Does NOT delete/disable other nginx sites or other PM2 apps.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
DOMAIN="aiheadshotapi.com"
cd "$APP_DIR"

echo "=== headshot-api fix (other nginx/apps untouched) ==="

# .env URLs fix (in-place, only these keys)
fix_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

if [[ ! -f .env ]]; then
  cp deploy/env.production.example .env
fi

fix_env "NODE_ENV" "production"
fix_env "PORT" "3016"
fix_env "BIND_HOST" "127.0.0.1"
fix_env "PUBLIC_BASE_URL" "https://aiheadshotapi.com"
fix_env "ADMIN_ORIGIN" "https://aiheadshotapi.com"

bash deploy/check-env.sh

git pull origin main || true
npm ci
npm run build:api
npm run index 2>/dev/null || true

pm2 stop headshot-api 2>/dev/null || true
pm2 delete headshot-api 2>/dev/null || true
APP_DIR="$APP_DIR" pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 2
echo ""
echo "PM2 health (local):"
curl -fsS "http://127.0.0.1:3016/v1/health" && echo ""

echo ""
echo "=== nginx (optional) ==="
if grep -rl "server_name.*${DOMAIN}" /etc/nginx/sites-enabled/ 2>/dev/null | grep -qv headshot-api-ssl; then
  echo "Domain ${DOMAIN} pehle se kisi aur nginx site mein hai."
  echo "Us site ke SSL server { } block mein YE line add karo (dusri sites mat hatao):"
  echo "  include ${APP_DIR}/deploy/nginx/headshot-api-locations.conf;"
  echo "Phir: nginx -t && nginx -s reload"
else
  echo "Standalone SSL site install (sirf headshot-api-ssl)..."
  DOMAIN="$DOMAIN" bash deploy/nginx/render-ssl-config.sh
  cp deploy/nginx/headshot-api-ssl.conf "/etc/nginx/sites-available/headshot-api-ssl"
  ln -sf "/etc/nginx/sites-available/headshot-api-ssl" "/etc/nginx/sites-enabled/headshot-api-ssl"
  rm -f /etc/nginx/sites-enabled/headshot-api 2>/dev/null || true
  nginx -t && nginx -s reload
  if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    bash deploy/ssl-install.sh || echo "SSL manual: certbot certonly --webroot -w ${APP_DIR}/logs/certbot -d ${DOMAIN}"
    nginx -t && nginx -s reload || true
  fi
fi

echo ""
echo "Test: curl https://${DOMAIN}/v1/health"
curl -kfsS "https://${DOMAIN}/v1/health" 2>/dev/null && echo "" || echo "(HTTPS fail — PM2 local OK hai to nginx/snippet check karo)"
