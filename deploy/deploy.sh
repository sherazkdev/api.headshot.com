#!/usr/bin/env bash
# Redeploy after git push. Run on VPS from anywhere:
#   sudo bash /var/www/headshot-api/deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/headshot-api
cd "$APP_DIR"

echo "=== headshot-api deploy ==="
git pull origin main
npm ci
npm run build:api
chown -R www-data:www-data uploads generated
systemctl restart headshot-api
nginx -t && systemctl reload nginx

sleep 2
curl -fsS "http://127.0.0.1:3016/v1/health" | head -c 200
echo ""
echo "Deploy OK — headshot-api running on :3016"
