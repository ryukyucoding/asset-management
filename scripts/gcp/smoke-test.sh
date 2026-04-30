#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKEND_URL:-}" ]]; then
  echo "BACKEND_URL is required"
  exit 1
fi

echo "==> Health check"
curl --fail --silent --show-error "${BACKEND_URL}/health" >/dev/null

if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  echo "==> Login smoke check"
  curl --fail --silent --show-error \
    -X POST "${BACKEND_URL}/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\"}" >/dev/null
else
  echo "==> Skip login smoke check (SMOKE_EMAIL/SMOKE_PASSWORD not set)"
fi

echo "Smoke test passed"
