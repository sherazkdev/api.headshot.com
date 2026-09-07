#!/usr/bin/env bash
# Render nginx config with your app folder (no sudo).
# Usage: bash deploy/nginx/render-config.sh
#        APP_ROOT=/home/you/apps/headshot-api bash deploy/nginx/render-config.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TEMPLATE="$SCRIPT_DIR/headshot-api.conf.template"
OUTPUT="$SCRIPT_DIR/headshot-api.conf"

mkdir -p "$APP_ROOT/logs" "$APP_ROOT/uploads" "$APP_ROOT/generated"

sed "s|__APP_ROOT__|${APP_ROOT}|g" "$TEMPLATE" > "$OUTPUT"

echo "Rendered: $OUTPUT"
echo "APP_ROOT=$APP_ROOT"
echo ""
echo "Apni nginx config mein add karo:"
echo "  include $OUTPUT;"
echo ""
echo "Phir:"
echo "  bash deploy/nginx/check-port-3016.sh"
echo "  nginx -t && nginx -s reload"
