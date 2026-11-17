# Auditoria documental do S-2220

Em **Operacional → eSocial e governança → Mensageria eSocial**, abra um evento S-2220, escolha o provedor e clique em **Auditar evento**. O perfil precisa ser interno, ter acesso clínico e estar autorizado para a empresa. O resultado informa quais verificações locais falharam, recomendações e o modelo que respondeu. Uma nova edição invalida o resultado mostrado.

O NAI confere os procedimentos e a vigência nas tabelas oficiais incluídas no repositório. A adequação dos exames ao PCMSO é revisada pela equipe clínica. O índice soma 25 pontos por pendência documental até 100. Um resultado inapto sinaliza revisão médica prioritária. O evento só segue para transmissão pelo fluxo existente da mensageria.

## Configuração

O Vertex usa as credenciais de aplicação da identidade de execução e o projeto do ambiente. O modelo Argon usa o endpoint multirregional `us`. O App Hosting precisa disponibilizar `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` no ambiente de execução para habilitar os provedores correspondentes. Use referências aos segredos no ambiente publicado. A callable usa os segredos Firebase com esses mesmos nomes. A equipe de implantação deve conceder à identidade do serviço acesso aos segredos utilizados e ao Vertex AI.

A função `auditS2220` aceita `{companyId, evento}` em uma chamada Firebase autenticada. O código de validação e o controle de acesso são compartilhados com a server action do Next.js. Para preparar e verificar a função isolada, execute na raiz:

```sh
npm ci
npm run build:s2220-function
npm ci --prefix functions/audit-s2220
```

O predeploy prepara o pacote para `firebase deploy --only functions:s2220-audit`. O ambiente usa o projeto configurado em `.firebaserc`. Um teste automatizado utiliza dados sintéticos e modelos simulados.

## Publicação com identidade federada

O job de `.github/workflows/sst-release.yml` usa o ambiente `production` da `main`.
O checkout usa a identidade temporária do GitHub Actions. Para publicar a função e as
métricas no Google Cloud, o job usa o provider indicado em `GCP_WORKLOAD_IDENTITY_PROVIDER`
e a conta de implantação indicada em `GCP_SST_DEPLOY_SERVICE_ACCOUNT`.

### Conferência do provider existente

Carregue as variáveis de projeto e pool da [seção 1 do procedimento de infraestrutura](ESOCIAL_INFRASTRUCTURE.md#1-conferir-o-acesso-antes-da-configuração-inicial).
Confira no projeto autorizado o estado do pool e do provider, issuer, audiences, atributos e
condição efetiva, conforme a seção 3 do mesmo procedimento. Selecione uma conta de implantação
SST existente e aprovada. Use seu e-mail em `NAI_SST_ACCOUNT` e confira a conta e sua política:

```bash
gcloud iam service-accounts describe "${NAI_SST_ACCOUNT:?informe a conta SST aprovada}" --project="$NAI_PROJECT_ID"
gcloud iam service-accounts get-iam-policy "$NAI_SST_ACCOUNT" --project="$NAI_PROJECT_ID"
```

O roteiro de eSocial e índices restringe o provider a dois workflows. Se estiver aplicado dessa
forma, a troca OIDC de SST será recusada mesmo com as duas variáveis do GitHub preenchidas.
Se o provider for compartilhado, preserve as condições de proprietário e repositório por ID,
branch, ambiente e evento. Acrescente somente o arquivo de SST à lista de workflows aceitos.
A expressão abaixo corresponde ao provider dedicado descrito nesse roteiro. Compare-a com a
política em uso antes de aprovar qualquer alteração, preservando restrições adicionais locais.

```bash
NAI_SST_WORKFLOW_REF='nextcon-nai-git/nai-gcp/.github/workflows/sst-release.yml@refs/heads/main'
NAI_RELEASE_CONDITION="assertion.repository_owner_id == '276102754' && assertion.repository_id == '1210840335' && assertion.ref == 'refs/heads/main' && assertion.environment == 'production' && assertion.event_name in ['push', 'workflow_dispatch'] && assertion.workflow_ref in ['nextcon-nai-git/nai-gcp/.github/workflows/deploy.yml@refs/heads/main', 'nextcon-nai-git/nai-gcp/.github/workflows/deploy-indexes.yml@refs/heads/main', '$NAI_SST_WORKFLOW_REF']"
```

### Aplicação e validação pelo operador

Os comandos abaixo alteram a configuração efetiva. Use-os após validar o projeto, o provider,
os mapeamentos e a conta. A atualização da condição só é necessária para o provider compatível
que ainda exclui o workflow SST. Use em `NAI_ATTRIBUTE_CONDITION` a condição de dois workflows
da seção 3 e execute o bloco em um shell Bash dedicado:

```bash
set -eu
test "$NAI_PROJECT_ID" = 'studio-8439299034-125c7'
CURRENT_CONDITION="$(gcloud iam workload-identity-pools providers describe "$NAI_PROVIDER_ID" \
  --project="$NAI_PROJECT_ID" --location=global --workload-identity-pool="$NAI_POOL_ID" \
  --format='value(attributeCondition)')"
if [[ "$CURRENT_CONDITION" == "${NAI_ATTRIBUTE_CONDITION:?carregue a condição da seção 3}" ]]; then
  gcloud iam workload-identity-pools providers update-oidc "$NAI_PROVIDER_ID" \
    --project="$NAI_PROJECT_ID" --location=global --workload-identity-pool="$NAI_POOL_ID" \
    --attribute-condition="$NAI_RELEASE_CONDITION"
elif [[ "$CURRENT_CONDITION" != "$NAI_RELEASE_CONDITION" ]]; then
  echo 'Condição diferente da prevista. Revise a política existente antes de prosseguir.' >&2
  exit 1
fi

NAI_WORKFLOW_PRINCIPALS="principalSet://iam.googleapis.com/projects/$NAI_PROJECT_NUMBER/locations/global/workloadIdentityPools/$NAI_POOL_ID/attribute.workflow_ref"
gcloud iam service-accounts add-iam-policy-binding "$NAI_SST_ACCOUNT" \
  --project="$NAI_PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="$NAI_WORKFLOW_PRINCIPALS/$NAI_SST_WORKFLOW_REF"
```

Confira os papéis efetivos da conta SST para a publicação da função de segunda geração,
atuação como a conta de execução designada e leitura/criação/atualização das métricas
do Cloud Logging. O vínculo federado permite assumir a conta. As permissões para publicar
a função e atualizar as métricas são avaliadas separadamente. Preserve a independência
das contas de índices, eSocial e execução da função.

Confirme o nome canônico do provider pelo próprio Google Cloud. Confira o valor compartilhado
já usado pelos outros workflows antes de preencher as variáveis do ambiente:

```bash
NAI_PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$NAI_PROVIDER_ID" \
  --project="$NAI_PROJECT_ID" --location=global --workload-identity-pool="$NAI_POOL_ID" \
  --format='value(name)')" && test -n "$NAI_PROVIDER_NAME" || exit 1
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo nextcon-nai-git/nai-gcp \
  --env production --body "$NAI_PROVIDER_NAME"
gh variable set GCP_SST_DEPLOY_SERVICE_ACCOUNT --repo nextcon-nai-git/nai-gcp \
  --env production --body "$NAI_SST_ACCOUNT"
gh workflow run sst-release.yml --repo nextcon-nai-git/nai-gcp --ref main
```

Na execução, confira separadamente o login federado, a releitura das três métricas e
a publicação de `auditS2220`. Confirme no projeto a função e a revisão publicada antes
do teste autenticado com evento sintético em empresa de teste. Esses passos
não exigem disparar a mensageria do eSocial.

## Cloud Logging

Execute `npm run infra:ai-metrics -- --dry-run` para inspecionar os filtros. Execute `npm run infra:ai-metrics` com credenciais Google autorizadas para criar ou atualizar e reler as três métricas. Em Logs Explorer, filtre por `jsonPayload.serviceContext.service="nai-gcp-ai-engine"`.

| Métrica                          | Unidade e interpretação                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `nai_ai_fallback_count`          | Uma conclusão bem-sucedida por um provedor alternativo                                  |
| `nai_ai_critical_failures_count` | Uma geração que esgotou a cadeia                                                        |
| `nai_ai_execution_latency`       | Distribuição em milissegundos do início até o sucesso, incluindo esperas e retentativas |

Os logs registram tentativas do executor, motivos padronizados, modelo e contagens de tokens quando informadas pelo provedor que concluiu a geração. Uma rejeição de conteúdo ou de solicitação encerra a cadeia e produz um evento próprio. Toda a análise documental permanece disponível quando a IA fica indisponível.
