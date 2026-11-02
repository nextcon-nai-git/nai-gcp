#!/usr/bin/env bash
# Run in a trusted terminal already authorized to administer the backend.
# Firebase CLI receives the values interactively; never use arguments or chat for keys.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo 'Uso: bash scripts/configure-openai.sh PROJECT_ID BACKEND_ID' >&2
  exit 2
fi
nai_project="$1"
nai_backend="$2"
if [[ ! "$nai_project" =~ ^[a-z][a-z0-9-]{4,61}[a-z0-9]$ || ! "$nai_backend" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo 'Projeto ou backend inválido.' >&2
  exit 2
fi
command -v firebase >/dev/null || { echo 'Firebase CLI não instalada.' >&2; exit 1; }
[[ -f apphosting.yaml ]] || { echo 'Execute na raiz do repositório NAI.' >&2; exit 1; }
firebase apphosting:secrets:set OPENAI_API_KEY --project "$nai_project" --location us-central1
firebase apphosting:secrets:set OPENAI_MODEL --project "$nai_project" --location us-central1
firebase apphosting:secrets:grantaccess OPENAI_API_KEY,OPENAI_MODEL --backend "$nai_backend" --project "$nai_project" --location us-central1
echo 'Revise as referências RUNTIME de OPENAI_API_KEY e OPENAI_MODEL no apphosting.yaml antes do rollout.'
echo 'Depois da publicação, use Testar conexão OpenAI e valide um lote autorizado.'
