#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROJECT_ID:-}" || -z "${REGION:-}" || -z "${ARTIFACT_REPO:-}" || -z "${FRONTEND_SERVICE:-}" || -z "${VITE_API_URL:-}" ]]; then
  cat <<'EOF'
Required environment variables:
  PROJECT_ID
  REGION
  ARTIFACT_REPO
  FRONTEND_SERVICE
  VITE_API_URL
EOF
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/frontend:${GITHUB_SHA:-manual-$(date +%Y%m%d%H%M%S)}"

echo "==> Build frontend image"
docker build -f frontend/Dockerfile --build-arg "VITE_API_URL=${VITE_API_URL}" -t "${IMAGE}" .

echo "==> Push frontend image"
docker push "${IMAGE}"

echo "==> Deploy frontend service"
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10

echo "==> Frontend URL"
gcloud run services describe "${FRONTEND_SERVICE}" --region "${REGION}" --format='value(status.url)'
