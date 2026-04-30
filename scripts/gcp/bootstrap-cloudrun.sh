#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROJECT_ID:-}" || -z "${REGION:-}" || -z "${DB_INSTANCE_NAME:-}" || -z "${REDIS_INSTANCE_NAME:-}" || -z "${GCS_BUCKET_NAME:-}" || -z "${CLOUD_RUN_SA:-}" ]]; then
  cat <<'EOF'
Required environment variables:
  PROJECT_ID
  REGION
  DB_INSTANCE_NAME
  REDIS_INSTANCE_NAME
  GCS_BUCKET_NAME
  CLOUD_RUN_SA   # email, e.g. cloud-run-app@PROJECT_ID.iam.gserviceaccount.com

Optional:
  ARTIFACT_REPO=asset-mgmt
  DB_TIER=db-custom-1-3840
  DB_VERSION=POSTGRES_16
  DB_CPU=1
  DB_MEMORY=3840MB
  REDIS_TIER=basic
  REDIS_SIZE_GB=1
EOF
  exit 1
fi

ARTIFACT_REPO="${ARTIFACT_REPO:-asset-mgmt}"
DB_VERSION="${DB_VERSION:-POSTGRES_16}"
DB_TIER="${DB_TIER:-db-custom-1-3840}"
REDIS_TIER="${REDIS_TIER:-basic}"
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"

echo "==> Enable required APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  compute.googleapis.com \
  --project "${PROJECT_ID}"

echo "==> Create Artifact Registry (if missing)"
if ! gcloud artifacts repositories describe "${ARTIFACT_REPO}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project "${PROJECT_ID}"
fi

echo "==> Create Cloud SQL Postgres instance (if missing)"
if ! gcloud sql instances describe "${DB_INSTANCE_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql instances create "${DB_INSTANCE_NAME}" \
    --database-version="${DB_VERSION}" \
    --tier="${DB_TIER}" \
    --region="${REGION}" \
    --project "${PROJECT_ID}"
fi

echo "==> Create Cloud SQL application database (if missing)"
if ! gcloud sql databases describe asset_management --instance "${DB_INSTANCE_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql databases create asset_management \
    --instance "${DB_INSTANCE_NAME}" \
    --project "${PROJECT_ID}"
fi

echo "==> Create Memorystore Redis instance (if missing)"
if ! gcloud redis instances describe "${REDIS_INSTANCE_NAME}" --region "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud redis instances create "${REDIS_INSTANCE_NAME}" \
    --region="${REGION}" \
    --tier="${REDIS_TIER}" \
    --size="${REDIS_SIZE_GB}" \
    --redis-version=redis_7_0 \
    --project "${PROJECT_ID}"
fi

echo "==> Create GCS bucket (if missing)"
if ! gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" \
    --location="${REGION}" \
    --project "${PROJECT_ID}"
fi

echo "==> Grant Cloud Run service account permissions"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/cloudsql.client" >/dev/null

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET_NAME}" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/storage.objectAdmin" >/dev/null

echo "==> Foundation ready"
echo "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}"
echo "Cloud SQL instance: ${DB_INSTANCE_NAME}"
echo "Memorystore: ${REDIS_INSTANCE_NAME}"
echo "GCS bucket: gs://${GCS_BUCKET_NAME}"
