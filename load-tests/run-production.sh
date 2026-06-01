#!/usr/bin/env bash
# Tiered load tests against Cloud Run production backend.
# Usage: BASE_URL=https://your-backend.run.app bash load-tests/run-production.sh
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

echo "==> Production load test target: ${BASE_URL}"
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

run_script "Tier 1 - Smoke" smoke.js
run_script "Tier 2 - Read-heavy (50 VU)" read-heavy.js
run_script "Tier 3 - Stress 200 VU" stress.js env K6_STRESS_PEAK=200
run_script "Tier 4 - Stress 400 VU" stress.js env K6_STRESS_PEAK=400
run_script "Tier 5 - Spike 200 VU" spike.js env K6_SPIKE_VUS=200
run_script "Tier 6 - Soak 40 VU x 15m" soak.js env K6_SOAK_VUS=40 K6_SOAK_DURATION=15m

echo ""
echo "Production load tests finished."
