#!/usr/bin/env bash
# Standard nginx install: sites-available + sites-enabled
# Usage: bash deploy/nginx/install-sites-enabled.sh
#
# Ye script sudo use karti hai — sirf /etc/nginx/ mein file copy ke liye.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SITE_NAME="headshot-api"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

bash "$SCRIPT_DIR/render-config.sh"
bash "$SCRIPT_DIR/check-port-3016.sh" || true

echo ""
echo "=== Installing to sites-available / sites-enabled ==="

if [[ ! -d /etc/nginx/sites-available ]]; then
  echo "ERROR: /etc/nginx/sites-available nahi mila. nginx install karo."
  exit 1
fi

sudo cp "$SCRIPT_DIR/headshot-api.conf" "$AVAILABLE"
sudo ln -sf "$AVAILABLE" "$ENABLED"

echo "Created: $AVAILABLE"
echo "Enabled: $ENABLED"

sudo nginx -t
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload

echo ""
echo "Done. Test: curl http://127.0.0.1:3016/v1/health"
