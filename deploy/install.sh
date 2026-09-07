#!/usr/bin/env bash
# App install — no sudo, no systemctl. Sirf clone + build + .env.
# Usage: bash deploy/install.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/headshot-api}"
REPO_URL="${REPO_URL:-https://github.com/sherazkdev/api.headshot.com.git}"

echo "=== headshot-api install (no sudo) ==="
echo "APP_DIR=$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 20+ chahiye. Pehle node install karo."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git chahiye."
  exit 1
fi

mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git pull origin main || true
mkdir -p uploads generated logs

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ">>> .env ban gaya — ab edit karo: nano $APP_DIR/.env"
fi

npm ci
npm run build:api

APP_ROOT="$APP_DIR" bash deploy/nginx/render-config.sh
bash deploy/nginx/check-port-3016.sh || true

echo ""
echo "=== Ab ye karo ==="
echo "1. nano $APP_DIR/.env"
echo "   NODE_ENV=production"
echo "   PUBLIC_BASE_URL=http://YOUR_IP:3016"
echo "   MONGODB_URI, JWT_SECRET, FIREBASE, GEMINI_API_KEY"
echo ""
echo "2. nginx mein include line add karo (render-config output dekho)"
echo "   nginx -t && nginx -s reload"
echo ""
echo "3. bash deploy/start-api.sh"
echo "4. curl http://127.0.0.1:3016/v1/health"
