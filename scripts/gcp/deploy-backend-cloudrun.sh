#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROJECT_ID:-}" || -z "${REGION:-}" || -z "${ARTIFACT_REPO:-}" || -z "${BACKEND_SERVICE:-}" || -z "${DB_INSTANCE_CONNECTION_NAME:-}" || -z "${REDIS_HOST:-}" || -z "${REDIS_PORT:-}" || -z "${DATABASE_URL:-}" || -z "${GCS_BUCKET_NAME:-}" || -z "${CLOUD_RUN_SA:-}" || -z "${FRONTEND_URL:-}" ]]; then
  cat <<'EOF'
Required environment variables:
  PROJECT_ID
  REGION
  ARTIFACT_REPO
  BACKEND_SERVICE
  DB_INSTANCE_CONNECTION_NAME   # project:region:instance
  REDIS_HOST
  REDIS_PORT
  DATABASE_URL                  # usually points to 127.0.0.1:5432 via Cloud SQL connector
  GCS_BUCKET_NAME
  CLOUD_RUN_SA                  # service account email
  FRONTEND_URL                  # allowed CORS origin for frontend

Required secrets in Secret Manager:
  jwt-secret
  jwt-refresh-secret
EOF
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/backend:${GITHUB_SHA:-manual-$(date +%Y%m%d%H%M%S)}"

echo "==> Build backend image"
docker build -f backend/Dockerfile -t "${IMAGE}" .

echo "==> Push backend image"
docker push "${IMAGE}"

echo "==> Deploy backend service"
gcloud run deploy "${BACKEND_SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${CLOUD_RUN_SA}" \
  --add-cloudsql-instances "${DB_INSTANCE_CONNECTION_NAME}" \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=${DATABASE_URL},REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT},STORAGE_DRIVER=gcs,GCS_BUCKET_NAME=${GCS_BUCKET_NAME},FRONTEND_URL=${FRONTEND_URL}" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest"

echo "==> Backend URL"
gcloud run services describe "${BACKEND_SERVICE}" --region "${REGION}" --format='value(status.url)'
