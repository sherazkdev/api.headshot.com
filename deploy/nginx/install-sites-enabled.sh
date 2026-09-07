#!/usr/bin/env bash
# Standard nginx install: sites-available + sites-enabled
# ONLY when .env PORT=3000 (nginx proxy mode).
# PORT=3016 (default) → PM2 direct, do NOT run this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="$APP_ROOT/.env"
SITE_NAME="headshot-api"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

API_PORT="3016"
if [[ -f "$ENV_FILE" ]]; then
  API_PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  API_PORT="${API_PORT:-3016}"
fi

if [[ "$API_PORT" == "3016" ]]; then
  echo "SKIP: .env PORT=3016 — PM2 direct mode."
  echo "nginx sites-enabled install mat karo (port conflict)."
  echo "Disable existing site:"
  echo "  rm -f /etc/nginx/sites-enabled/headshot-api && nginx -s reload"
  echo "Start API:"
  echo "  bash deploy/restart-api.sh"
  exit 0
fi

bash "$SCRIPT_DIR/render-config.sh"
bash "$SCRIPT_DIR/check-port-3016.sh" || true

echo ""
echo "=== Installing nginx proxy :3016 → :$API_PORT ==="

if [[ ! -d /etc/nginx/sites-available ]]; then
  echo "ERROR: /etc/nginx/sites-available nahi mila."
  exit 1
fi

cp "$SCRIPT_DIR/headshot-api.conf" "$AVAILABLE"
ln -sf "$AVAILABLE" "$ENABLED"

nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload

echo "Done. Test: curl http://127.0.0.1:3016/v1/health"
