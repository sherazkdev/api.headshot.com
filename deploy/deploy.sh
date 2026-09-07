#!/usr/bin/env bash
# Redeploy — no sudo.
# Usage: bash deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/headshot-api}"
cd "$APP_DIR"

echo "=== headshot-api deploy ==="
git pull origin main
npm ci
npm run build:api

APP_ROOT="$APP_DIR" bash deploy/nginx/render-config.sh

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart headshot-api || pm2 start deploy/ecosystem.config.cjs
else
  bash deploy/start-api.sh
fi

nginx -t && nginx -s reload

sleep 2
curl -fsS "http://127.0.0.1:3016/v1/health" | head -c 200 || echo "(health check failed — API/nginx check karo)"
echo ""
echo "Deploy done."
