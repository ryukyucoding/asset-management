#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"

run_k6() {
  local script="$1"
  echo ""
  echo "=========================================="
  echo "==> k6 run ${script}"
  echo "=========================================="
  if command -v k6 >/dev/null 2>&1; then
    BASE_URL="${BASE_URL}" k6 run "${ROOT}/load-tests/${script}"
  else
    docker run --rm -i \
      --network host \
      -e BASE_URL="${BASE_URL}" \
      -v "${ROOT}/load-tests:/scripts" \
      grafana/k6 run "/scripts/${script}"
  fi
}

echo "==> Waiting for backend ${BASE_URL}/health"
for i in $(seq 1 30); do
  if curl -sf "${BASE_URL}/health" >/dev/null; then
    echo "Backend is ready"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Backend not ready at ${BASE_URL}"
    exit 1
  fi
  sleep 2
done

run_k6 smoke.js
run_k6 read-heavy.js
run_k6 admin-read.js
run_k6 stress.js
run_k6 spike.js
run_k6 soak.js

echo ""
echo "All load tests finished."
