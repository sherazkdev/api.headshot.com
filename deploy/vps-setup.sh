#!/usr/bin/env bash
# One-time VPS bootstrap for headshot-api + nginx on port 3016.
# Run on Ubuntu 22.04/24.04 as root or with sudo:
#   curl -fsSL ... | bash   OR   sudo bash deploy/vps-setup.sh
set -euo pipefail

APP_DIR=/var/www/headshot-api
REPO_URL="${REPO_URL:-https://github.com/sherazkdev/api.headshot.com.git}"
NGINX_SITE=headshot-api

echo "=== headshot-api VPS setup ==="

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

apt-get update
apt-get install -y git nginx ufw

if ! systemctl is-active --quiet mongod 2>/dev/null; then
  echo "Installing MongoDB..."
  apt-get install -y mongodb-org || apt-get install -y mongodb
  systemctl enable mongod || systemctl enable mongodb
  systemctl start mongod || systemctl start mongodb
fi

mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "Repo already exists at $APP_DIR — pull latest manually with deploy/deploy.sh"
fi

cd "$APP_DIR"
mkdir -p uploads generated
chown -R www-data:www-data uploads generated

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo ">>> Edit $APP_DIR/.env before starting (NODE_ENV, JWT_SECRET, MONGODB_URI, FIREBASE, GEMINI, PUBLIC_BASE_URL)"
fi

npm ci
npm run build:api

cp deploy/systemd/headshot-api.service /etc/systemd/system/headshot-api.service
systemctl daemon-reload
systemctl enable headshot-api

bash deploy/nginx/check-port-3016.sh
cp deploy/nginx/headshot-api.conf "/etc/nginx/sites-available/${NGINX_SITE}"
ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 3016/tcp
ufw --force enable

echo ""
echo "=== Next steps ==="
echo "1. nano $APP_DIR/.env   (set NODE_ENV=production, PUBLIC_BASE_URL=http://YOUR_IP:3016, secrets)"
echo "2. npm run seed --prefix $APP_DIR   (optional admin user)"
echo "3. systemctl start headshot-api"
echo "4. curl http://127.0.0.1:3016/v1/health"
echo "Done."
