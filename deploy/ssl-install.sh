#!/usr/bin/env bash
# Let's Encrypt SSL for https://aiheadshotapi.com
# DNS A record: aiheadshotapi.com → VPS IP (pehle set karo)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
DOMAIN="${DOMAIN:-aiheadshotapi.com}"
WEBROOT="$APP_DIR/logs/certbot"

mkdir -p "$WEBROOT"

if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot..."
  apt-get update && apt-get install -y certbot
fi

echo "=== SSL certificate: $DOMAIN ==="
echo "Webroot: $WEBROOT"
echo ""

# Pehle nginx HTTP (port 80) chalna chahiye render-ssl-config ke liye
if ! curl -fsS "http://127.0.0.1/.well-known/acme-challenge/" -o /dev/null 2>/dev/null; then
  echo "Note: nginx port 80 must serve acme-challenge from $WEBROOT"
fi

EMAIL="${CERTBOT_EMAIL:-}"
if [[ -z "$EMAIL" && -f "$APP_DIR/.env" ]]; then
  EMAIL="$(grep -E '^ADMIN_EMAIL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | xargs || true)"
fi
EMAIL="${EMAIL:-admin@${DOMAIN}}"

certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null || \
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN"

echo ""
echo "Certificate paths:"
echo "  /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "  /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
echo ""
echo "Reload nginx:"
echo "  nginx -t && nginx -s reload"
echo ""
echo "Test:"
echo "  curl https://${DOMAIN}/v1/health"
