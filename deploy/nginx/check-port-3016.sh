#!/usr/bin/env bash
# Check whether port 3016 is free for headshot-api nginx.
set -euo pipefail

PORT=3016

echo "=== headshot-api port ${PORT} check ==="

if command -v ss >/dev/null 2>&1; then
  if ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q .; then
    echo "IN USE — something is already listening on :${PORT}:"
    ss -tlnp "sport = :${PORT}" || true
    exit 1
  fi
elif command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"${PORT}" -sTCP:LISTEN -P -n 2>/dev/null | grep -q .; then
    echo "IN USE — something is already listening on :${PORT}:"
    lsof -iTCP:"${PORT}" -sTCP:LISTEN -P -n || true
    exit 1
  fi
else
  echo "WARN: ss/lsof not found; skipping listen check"
fi

if command -v nginx >/dev/null 2>&1; then
  if nginx -T 2>/dev/null | grep -qE "listen[[:space:]]+${PORT}[[:space:];]"; then
    echo "IN USE — nginx already has a server block on port ${PORT}"
    nginx -T 2>/dev/null | grep -B2 -A2 "listen[[:space:]]*${PORT}" || true
    exit 1
  fi
  echo "nginx: no existing listen ${PORT} in loaded config"
else
  echo "nginx: not installed (skip config scan)"
fi

echo "FREE — port ${PORT} is available for headshot-api.conf"
exit 0
