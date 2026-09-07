#!/usr/bin/env bash
# SSL version — sites-available + sites-enabled
# Usage: DOMAIN=api.yourdomain.com bash deploy/nginx/install-ssl-sites-enabled.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_NAME="headshot-api-ssl"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

if [[ -z "${DOMAIN:-}" ]]; then
  echo "ERROR: DOMAIN set karo"
  echo "  DOMAIN=api.yourdomain.com bash deploy/nginx/install-ssl-sites-enabled.sh"
  exit 1
fi

bash "$SCRIPT_DIR/render-ssl-config.sh"

if [[ ! -d /etc/nginx/sites-available ]]; then
  echo "ERROR: /etc/nginx/sites-available nahi mila."
  exit 1
fi

sudo cp "$SCRIPT_DIR/headshot-api-ssl.conf" "$AVAILABLE"
sudo ln -sf "$AVAILABLE" "$ENABLED"

echo "Created: $AVAILABLE"
echo "Enabled: $ENABLED"

sudo nginx -t
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload

echo ""
echo "Ab SSL certificate:"
echo "  sudo certbot certonly --webroot -w ${APP_ROOT:-$HOME/headshot-api}/logs/certbot -d $DOMAIN"
echo "  sudo nginx -t && sudo systemctl reload nginx"
