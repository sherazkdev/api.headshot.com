#!/usr/bin/env bash
# PM2 one-time setup + start headshot-api
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/headshot-api}"
cd "$APP_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 install:"
  echo "  npm install -g pm2"
  exit 1
fi

mkdir -p logs uploads generated

bash deploy/check-env.sh

if [[ ! -f dist/server.js ]]; then
  npm run build:api
fi

pm2 delete headshot-api 2>/dev/null || true
APP_DIR="$APP_DIR" pm2 start deploy/ecosystem.config.cjs
pm2 save

echo ""
echo "PM2 commands:"
echo "  pm2 status"
echo "  pm2 logs headshot-api"
echo "  pm2 restart headshot-api"
echo "  pm2 stop headshot-api"
echo ""
echo "Server reboot par auto-start (ek bar — is command mein sudo ho sakta hai):"
echo "  pm2 startup"
echo "  (jo command print ho, woh chalao, phir: pm2 save)"
