#!/usr/bin/env bash
# SSL nginx config for https://aiheadshotapi.com
# Usage: bash deploy/nginx/render-ssl-config.sh
#        DOMAIN=aiheadshotapi.com bash deploy/nginx/render-ssl-config.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DOMAIN="${DOMAIN:-aiheadshotapi.com}"

TEMPLATE="$SCRIPT_DIR/headshot-api-ssl.conf.template"
OUTPUT="$SCRIPT_DIR/headshot-api-ssl.conf"

mkdir -p "$APP_ROOT/logs/certbot"

API_PORT="3016"
if [[ -f "$APP_ROOT/.env" ]]; then
  API_PORT="$(grep -E '^PORT=' "$APP_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  API_PORT="${API_PORT:-3016}"
fi

sed -e "s|__APP_ROOT__|${APP_ROOT}|g" \
    -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__API_PORT__|${API_PORT}|g" \
    "$TEMPLATE" > "$OUTPUT"

echo "Rendered: $OUTPUT"
echo "DOMAIN=$DOMAIN"
echo "nginx upstream → 127.0.0.1:$API_PORT"
echo ""
echo "include $OUTPUT;"
