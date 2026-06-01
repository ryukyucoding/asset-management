#!/usr/bin/env bash
# Heavy production load tests - higher VU, longer hold, parallel requests.
# Usage: bash load-tests/run-production-heavy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-https://cloud-native-backend-11959477316.asia-east1.run.app}"
# shellcheck source=load-tests/lib/k6-env.sh
source "${ROOT}/load-tests/lib/k6-env.sh"

run_script() {
  local label="$1"
  local script="$2"
  shift 2
  echo ""
  echo "=========================================="
  echo "==> ${label} (${script})"
  echo "=========================================="
  if command -v k6 >/dev/null 2>&1; then
    BASE_URL="${BASE_URL}" \
    USER_EMAIL="${USER_EMAIL}" \
    USER_PASSWORD="${USER_PASSWORD}" \
    ADMIN_EMAIL="${ADMIN_EMAIL}" \
    ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
      "$@" k6 run "${ROOT}/load-tests/${script}"
  else
    docker run --rm -i \
      --network host \
      -e BASE_URL="${BASE_URL}" \
      -e USER_EMAIL="${USER_EMAIL}" \
      -e USER_PASSWORD="${USER_PASSWORD}" \
      -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
      -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
      -v "${ROOT}/load-tests:/scripts" \
      grafana/k6 run "/scripts/${script}"
  fi
}

echo "==> Heavy production load test: ${BASE_URL}"
echo "==> Waiting for /health"
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

# ~15 min: ramp to 600 VU, hold 8 min at peak
run_script "Heavy 600 VU (8m plateau)" stress-heavy.js \
  env K6_HEAVY_PEAK=600 K6_HEAVY_HOLD=8m K6_HEAVY_SLEEP=0.05

# ~17 min: ramp to 800 VU, hold 10 min at peak
run_script "Heavy 800 VU (10m plateau)" stress-heavy.js \
  env K6_HEAVY_PEAK=800 K6_HEAVY_HOLD=10m K6_HEAVY_SLEEP=0.05

echo ""
echo "Heavy production load tests finished."
