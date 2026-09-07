#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${APP_ROOT}/.env"
OUTPUT="$SCRIPT_DIR/headshot-api.conf"
TEMPLATE="$SCRIPT_DIR/headshot-api.conf.template"

mkdir -p "$APP_ROOT/logs" "$APP_ROOT/uploads" "$APP_ROOT/generated"

API_PORT="3016"
if [[ -f "$ENV_FILE" ]]; then
  API_PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  API_PORT="${API_PORT:-3016}"
fi

if [[ "$API_PORT" == "3016" ]]; then
  cat > "$OUTPUT" <<EOF
# headshot-api — PM2 direct mode (PORT=3016)
# API: http://YOUR_IP:3016/v1/health
# Is file ko nginx mein include NA karo — port conflict hoga.
#
# Agar nginx sites-enabled/headshot-api enabled hai, disable karo:
#   rm -f /etc/nginx/sites-enabled/headshot-api && nginx -s reload
#
# PM2:
#   pm2 restart headshot-api
EOF
  echo "Mode: PM2 direct on :3016 (nginx proxy skip)"
  echo "Rendered: $OUTPUT (comments only)"
  echo "API_PORT=$API_PORT"
  exit 0
fi

sed -e "s|__APP_ROOT__|${APP_ROOT}|g" -e "s|__API_PORT__|${API_PORT}|g" "$TEMPLATE" > "$OUTPUT"

echo "Mode: nginx :3016 → node :${API_PORT}"
echo "Rendered: $OUTPUT"
echo "include $OUTPUT;"
