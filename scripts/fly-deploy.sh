#!/usr/bin/env bash
# Deploy to Fly.io, passing the NEXT_PUBLIC_* values from .env.local as build args
# (they're compiled into the browser bundle, so they must be present at build time).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env.local and fill it in." >&2
  exit 1
fi

get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
URL="$(get NEXT_PUBLIC_APPS_SCRIPT_URL)"
HASH="$(get NEXT_PUBLIC_HOST_PASSWORD_HASH)"
[[ -n "$URL" && -n "$HASH" ]] || { echo "Set NEXT_PUBLIC_APPS_SCRIPT_URL and NEXT_PUBLIC_HOST_PASSWORD_HASH in $ENV_FILE." >&2; exit 1; }

exec fly deploy --remote-only \
  --build-arg "NEXT_PUBLIC_APPS_SCRIPT_URL=$URL" \
  --build-arg "NEXT_PUBLIC_HOST_PASSWORD_HASH=$HASH" \
  "$@"
