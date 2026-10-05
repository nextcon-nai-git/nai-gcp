#!/usr/bin/env bash
set -euo pipefail

# Executar no Cloud Shell autenticado, a partir desta revisão do repositório.
# Identidade existente do App Hosting, conferida no Cloud Run antes de executar.
: "${AVP_RUNTIME_SERVICE_ACCOUNT:?Defina a identidade de execução já existente e conferida do backend nai.}"
NAI_AVP_PROJECT="studio-8439299034-125c7"
NAI_AVP_REGION="us-central1"
NAI_AVP_JOB="nai-avp-sheet-sync"
NAI_AVP_URI="https://nai--studio-8439299034-125c7.us-central1.hosted.app/api/internal/avp-sheet-sync"
NAI_AVP_EXPECTED="firebase-app-hosting-compute@${NAI_AVP_PROJECT}.iam.gserviceaccount.com"
if [[ "$AVP_RUNTIME_SERVICE_ACCOUNT" != "$NAI_AVP_EXPECTED" ]]; then
  echo "A identidade conferida diverge de apphosting.yaml. Ajuste a configuração antes de ativar o agendador." >&2
  exit 1
fi
gcloud projects describe "$NAI_AVP_PROJECT" --format="value(projectId)"
gcloud iam service-accounts describe "$AVP_RUNTIME_SERVICE_ACCOUNT" --project="$NAI_AVP_PROJECT" --format="value(email)"

# As regras devem estar publicadas antes da primeira cópia de dados privados.
npx --yes firebase-tools@14.22.0 deploy --only firestore:rules,firestore:indexes,storage:rules --project "$NAI_AVP_PROJECT" --non-interactive
gcloud services enable sheets.googleapis.com places.googleapis.com cloudscheduler.googleapis.com --project="$NAI_AVP_PROJECT"

NAI_AVP_FLAGS=(
  --project="$NAI_AVP_PROJECT" --location="$NAI_AVP_REGION"
  --schedule="*/10 * * * *" --time-zone="America/Sao_Paulo"
  --uri="$NAI_AVP_URI" --http-method=POST
  --oidc-service-account-email="$AVP_RUNTIME_SERVICE_ACCOUNT"
  --oidc-token-audience="$NAI_AVP_URI"
  --attempt-deadline=120s --max-retry-attempts=2 --min-backoff=30s --max-backoff=120s
)
if gcloud scheduler jobs describe "$NAI_AVP_JOB" --project="$NAI_AVP_PROJECT" --location="$NAI_AVP_REGION" > /dev/null 2>&1; then
  gcloud scheduler jobs update http "$NAI_AVP_JOB" "${NAI_AVP_FLAGS[@]}"
else
  gcloud scheduler jobs create http "$NAI_AVP_JOB" "${NAI_AVP_FLAGS[@]}"
fi
gcloud scheduler jobs run "$NAI_AVP_JOB" --project="$NAI_AVP_PROJECT" --location="$NAI_AVP_REGION"
gcloud scheduler jobs describe "$NAI_AVP_JOB" --project="$NAI_AVP_PROJECT" --location="$NAI_AVP_REGION" --format="yaml(name,schedule,timeZone,state,httpTarget.uri,httpTarget.oidcToken.serviceAccountEmail)"
echo "Agendador solicitado. Confirme o HTTP 200 nos logs e o horário da última leitura no AVP."
