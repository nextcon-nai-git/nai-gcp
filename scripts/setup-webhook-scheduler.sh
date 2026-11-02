#!/usr/bin/env bash
set -euo pipefail

# Provision only after the worker and Firestore indexes have been deployed.
: "${WEBHOOK_PROJECT_ID:?Set the target project}"
: "${WEBHOOK_SCHEDULER_LOCATION:?Set the Cloud Scheduler region}"
: "${WEBHOOK_WORKER_AUDIENCE:?Set the deployed HTTPS worker URL}"
: "${WEBHOOK_INVOKER_EMAIL:?Set the OIDC service account email}"
if [[ "$WEBHOOK_WORKER_AUDIENCE" != https://* ]]; then
  echo "Worker URL must use HTTPS." >&2
  exit 1
fi
job="nai-webhook-deliveries"
args=(
  --project="$WEBHOOK_PROJECT_ID"
  --location="$WEBHOOK_SCHEDULER_LOCATION"
  --schedule="* * * * *" --time-zone="Etc/UTC"
  --uri="$WEBHOOK_WORKER_AUDIENCE" --http-method=POST
  --oidc-service-account-email="$WEBHOOK_INVOKER_EMAIL"
  --oidc-token-audience="$WEBHOOK_WORKER_AUDIENCE"
  --attempt-deadline=180s
)
if gcloud scheduler jobs describe "$job" --project="$WEBHOOK_PROJECT_ID" --location="$WEBHOOK_SCHEDULER_LOCATION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$job" "${args[@]}"
else
  gcloud scheduler jobs create http "$job" "${args[@]}"
fi
