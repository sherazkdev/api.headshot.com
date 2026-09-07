#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/headshot-api}"
PID_FILE="$APP_DIR/logs/headshot-api.pid"

if command -v pm2 >/dev/null 2>&1; then
  pm2 stop headshot-api 2>/dev/null || true
fi

if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

echo "headshot-api stopped"
