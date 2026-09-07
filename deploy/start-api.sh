#!/usr/bin/env bash
# Start API in background (no sudo). pm2 preferred if installed.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/headshot-api}"
cd "$APP_DIR"

if [[ ! -f dist/server.js ]]; then
  echo "dist missing — run: npm run build:api"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo ".env missing — copy from .env.example"
  exit 1
fi

mkdir -p logs uploads generated

if command -v pm2 >/dev/null 2>&1; then
  pm2 start deploy/ecosystem.config.cjs --update-env || pm2 restart headshot-api
  pm2 save 2>/dev/null || true
  echo "API started with pm2 (headshot-api) on :3000"
  pm2 status headshot-api
  exit 0
fi

PID_FILE="$APP_DIR/logs/headshot-api.pid"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Already running PID $(cat "$PID_FILE")"
  exit 0
fi

nohup node dist/server.js >> "$APP_DIR/logs/api.log" 2>&1 &
echo $! > "$PID_FILE"
echo "API started PID $(cat "$PID_FILE") — logs: $APP_DIR/logs/api.log"
