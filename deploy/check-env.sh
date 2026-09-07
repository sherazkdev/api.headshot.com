#!/usr/bin/env bash
# Check .env MONGODB_URI before PM2 start
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE missing"
  exit 1
fi

URI="$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"

if [[ -z "$URI" ]]; then
  echo "ERROR: MONGODB_URI empty in $ENV_FILE"
  exit 1
fi

if [[ "$URI" != mongodb://* && "$URI" != mongodb+srv://* ]]; then
  echo "ERROR: MONGODB_URI must start with mongodb:// or mongodb+srv://"
  echo "Current value: $URI"
  exit 1
fi

echo "OK: MONGODB_URI looks valid"
echo "Host: ${URI#*@}"
echo "${URI%%\?*}"
