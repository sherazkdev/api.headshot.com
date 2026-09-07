#!/usr/bin/env bash
# Fix EADDRINUSE on port 3000 — duplicate PM2 / node process
set -euo pipefail

PORT=3000
APP_DIR="${APP_DIR:-/var/www/headshot-api}"

echo "=== Port $PORT check ==="

if command -v ss >/dev/null 2>&1; then
  ss -tlnp "sport = :$PORT" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -iTCP:"$PORT" -sTCP:LISTEN -P -n 2>/dev/null || true
fi

echo ""
echo "=== PM2 processes ==="
pm2 list 2>/dev/null || true

echo ""
echo "Stopping headshot-api in PM2..."
pm2 stop headshot-api 2>/dev/null || true
pm2 delete headshot-api 2>/dev/null || true

# Kill any leftover node still holding :3000
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$PIDS" ]]; then
    echo "Killing PID(s) on :$PORT: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
fi

sleep 1

if ss -tlnH "sport = :$PORT" 2>/dev/null | grep -q .; then
  echo "ERROR: port $PORT still in use. Manual check:"
  echo "  ss -tlnp sport = :$PORT"
  exit 1
fi

echo "Port $PORT is free."
echo ""
echo "Starting single PM2 instance..."
cd "$APP_DIR"
bash deploy/check-env.sh
npm run build:api 2>/dev/null || true
APP_DIR="$APP_DIR" pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 2
pm2 status headshot-api
curl -fsS "http://127.0.0.1:${PORT}/v1/health" && echo "" || echo "Health check failed — pm2 logs headshot-api"
