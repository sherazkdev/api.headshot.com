#!/usr/bin/env bash
# Fix EADDRINUSE — clean restart on PORT from .env (default 3016)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
ENV_FILE="$APP_DIR/.env"

read_port() {
  local p="$1"
  if [[ -f "$ENV_FILE" ]]; then
    p="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  fi
  echo "${p:-3016}"
}

PORT="$(read_port)"

echo "=== headshot-api restart (PORT=$PORT) ==="

for p in 3000 3016 "$PORT"; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${p}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    [[ -n "$PIDS" ]] && kill -9 $PIDS 2>/dev/null || true
  fi
done

pm2 stop headshot-api 2>/dev/null || true
pm2 delete headshot-api 2>/dev/null || true
sleep 1

if command -v ss >/dev/null 2>&1 && ss -tlnH "sport = :$PORT" 2>/dev/null | grep -q .; then
  echo "ERROR: port $PORT still in use"
  ss -tlnp "sport = :$PORT" || true
  exit 1
fi

cd "$APP_DIR"
bash deploy/check-env.sh
npm run build:api

APP_DIR="$APP_DIR" pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 2
pm2 status headshot-api
echo ""
curl -fsS "http://127.0.0.1:${PORT}/v1/health" && echo "" || {
  echo "Health failed — pm2 logs headshot-api --lines 30"
  exit 1
}

echo "OK — API on :$PORT"
