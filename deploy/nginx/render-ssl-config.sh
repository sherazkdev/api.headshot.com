#!/usr/bin/env bash
# SSL nginx config render.
# Usage:
#   DOMAIN=api.headshot.com bash deploy/nginx/render-ssl-config.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DOMAIN="${DOMAIN:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: DOMAIN set karo. Example:"
  echo "  DOMAIN=api.yourdomain.com bash deploy/nginx/render-ssl-config.sh"
  exit 1
fi

TEMPLATE="$SCRIPT_DIR/headshot-api-ssl.conf.template"
OUTPUT="$SCRIPT_DIR/headshot-api-ssl.conf"

mkdir -p "$APP_ROOT/logs/certbot"

API_PORT="3016"
if [[ -f "$APP_ROOT/.env" ]]; then
  API_PORT="$(grep -E '^PORT=' "$APP_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  API_PORT="${API_PORT:-3016}"
fi

sed -e "s|__APP_ROOT__|${APP_ROOT}|g" -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__API_PORT__|${API_PORT}|g" "$TEMPLATE" > "$OUTPUT"

echo "Rendered: $OUTPUT"
echo "DOMAIN=$DOMAIN"
echo "APP_ROOT=$APP_ROOT"
echo ""
echo "nginx mein include:"
echo "  include $OUTPUT;"
echo ""
echo "SSL certificate (ek bar, root/sudo zaroori certbot ke liye):"
echo "  sudo certbot certonly --webroot -w $APP_ROOT/logs/certbot -d $DOMAIN"
echo "  nginx -t && nginx -s reload"
