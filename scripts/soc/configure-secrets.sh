#!/usr/bin/env bash
# Run from the repository root in an administrator's trusted terminal.
# Firebase collects each value securely; this script never handles secret values.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Uso: bash scripts/soc/configure-secrets.sh PROJECT_ID BACKEND_ID' >&2
  exit 2
fi
soc_project="$1"
soc_backend="$2"
if [[ ! "$soc_project" =~ ^[a-z][a-z0-9-]{4,61}[a-z0-9]$ || ! "$soc_backend" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo 'Projeto ou backend inválido.' >&2
  exit 2
fi
command -v firebase >/dev/null || { echo 'Firebase CLI não instalada.' >&2; exit 1; }
[[ -f apphosting.yaml ]] || { echo 'Execute na raiz do repositório NAI.' >&2; exit 1; }

for soc_secret in SOC_COMPANIES_KEY SOC_EMPLOYEES_KEY SOC_ASOS_KEY; do
  firebase apphosting:secrets:set "$soc_secret" --project "$soc_project" --location us-central1
done
firebase apphosting:secrets:grantaccess SOC_COMPANIES_KEY,SOC_EMPLOYEES_KEY,SOC_ASOS_KEY \
  --backend "$soc_backend" --project "$soc_project" --location us-central1

echo 'Segredos provisionados. Revise as referências RUNTIME no apphosting.yaml e publique.'
echo 'A conexão só estará comprovada após uma consulta real na Central SOC.'
