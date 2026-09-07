#!/usr/bin/env bash
# Validate .env format before seed / pm2 start
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/headshot-api}"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE missing"
  echo "Copy: cp deploy/env.production.example .env"
  exit 1
fi

echo "=== Checking $ENV_FILE ==="

bad=0

while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue

  if [[ "$trimmed" != *=* ]]; then
    echo "FAIL: line without '=': $trimmed"
    bad=1
    continue
  fi

  key="${trimmed%%=*}"
  val="${trimmed#*=}"

  # Multiple KEY= on one line (common mistake)
  if [[ "$val" == *" "* && "$val" == *[A-Z_]*=* ]]; then
    echo "FAIL: multiple variables on ONE line — har variable alag line par likho:"
    echo "  $trimmed"
    bad=1
  fi
done < "$ENV_FILE"

URI="$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
if [[ -z "$URI" ]]; then
  echo "FAIL: MONGODB_URI missing or empty"
  bad=1
elif [[ "$URI" != mongodb://* && "$URI" != mongodb+srv://* ]]; then
  echo "FAIL: MONGODB_URI must start with mongodb:// or mongodb+srv://"
  echo "  Got: $URI"
  bad=1
else
  echo "OK: MONGODB_URI"
fi

NODE_ENV="$(grep -E '^NODE_ENV=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
if [[ "$NODE_ENV" == *" "* ]]; then
  echo "FAIL: NODE_ENV has spaces — .env format broken (sab ek line par likha hoga)"
  echo "  Got: $NODE_ENV"
  bad=1
elif [[ "$NODE_ENV" != "production" && "$NODE_ENV" != "development" && "$NODE_ENV" != "test" ]]; then
  echo "WARN: NODE_ENV=$NODE_ENV"
else
  echo "OK: NODE_ENV=$NODE_ENV"
fi

if [[ "$bad" -ne 0 ]]; then
  echo ""
  echo "Fix: nano $ENV_FILE"
  echo "Template: deploy/env.production.example"
  exit 1
fi

echo ""
echo "All checks passed."
