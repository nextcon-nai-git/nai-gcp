# Ativação segura da infraestrutura eSocial

## Estado e escopo

Este roteiro prepara uma identidade de implantação sem chave permanente, um cofre inicialmente vazio
e um agendador de **consultas**. Não instala A1, não habilita transmissão ao governo e não habilita
e-mails a clientes. O sucesso do build ou do provisionamento não homologa o eSocial.

Durante esta ativação, manter `ESOCIAL_TRANSMISSION_ENABLED=false` e
`ASO_CLIENT_EMAIL_SEND_ENABLED=false` na configuração efetiva do App Hosting. A instalação futura
do certificado não deve modificar esses controles automaticamente.

A configuração inicial de APIs, contas, federação e IAM pertence a um operador já autorizado no
Google Cloud. O pipeline cotidiano verifica os pré-requisitos e mantém o job; ele não recebe
permissão para conceder papéis, criar chaves, criar certificados ou ler conteúdo do cofre.

O job eSocial só executa em `workflow_dispatch`, na `main`, com `provision_esocial=true`.
Índices possuem workflow e conta separados. A publicação do site continua no App Hosting.
O job legado `deploy-firestore`, para regras Firestore/Storage, continua separado e dependente do
segredo antigo: sua migração exige outro desenho de permissões e não faz parte desta ativação.
Não usar a conta de índices ou eSocial para contornar essa separação.

## Identidades e recursos fixados

| Item | Valor |
| --- | --- |
| Projeto | `studio-8439299034-125c7` |
| Repositório | `nextcon-nai-git/nai-gcp` |
| Repository ID | `1210840335` |
| Owner ID | `276102754` |
| Ambiente GitHub | `production` |
| Conta de implantação eSocial | `nai-esocial-deploy@studio-8439299034-125c7.iam.gserviceaccount.com` |
| Conta de implantação de índices | `nai-indexes-deploy@studio-8439299034-125c7.iam.gserviceaccount.com` |
| Conta de execução NAI | `firebase-app-hosting-compute@studio-8439299034-125c7.iam.gserviceaccount.com` |
| Conta invocadora | `nai-esocial-query@studio-8439299034-125c7.iam.gserviceaccount.com` |
| Cofre | `nai-esocial-a1` |
| Job / região | `nai-esocial-query` / `us-central1` |
| Frequência / fuso | `*/5 * * * *` / `America/Sao_Paulo` |

A URI e a audience OIDC são, ambas:

```text
https://nai--studio-8439299034-125c7.us-central1.hosted.app/api/internal/esocial-sync
```

O invocador não recebe acesso ao A1, Firestore ou e-mail. A aplicação valida o ID token Google,
a audience, o emissor e a identidade esperada. Não conceder `run.invoker` no projeto por prevenção:
se existir uma barreira IAM adicional no serviço atingido, conferir o serviço concreto e restringir
a concessão a ele.

## 1. Conferir o acesso antes da configuração inicial

Os comandos abaixo são um roteiro revisável; não são executados pela documentação ou pelo workflow.
Usar a identidade operacional NEXTCON efetivamente autorizada. Confirmar conta e projeto; não criar
chaves de serviço, não imprimir tokens e não reutilizar contas pessoais ou identidades não aprovadas.

```bash
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud projects describe studio-8439299034-125c7 --format='json(projectId,projectNumber,name)'

NAI_PROJECT_ID='studio-8439299034-125c7'
NAI_PROJECT_NUMBER="$(gcloud projects describe "$NAI_PROJECT_ID" --format='value(projectNumber)')"
[[ "$NAI_PROJECT_NUMBER" =~ ^[0-9]+$ ]] || exit 1
NAI_POOL_ID='nai-github'
NAI_PROVIDER_ID='github'
NAI_ESOCIAL_ACCOUNT="nai-esocial-deploy@$NAI_PROJECT_ID.iam.gserviceaccount.com"
NAI_INDEXES_ACCOUNT="nai-indexes-deploy@$NAI_PROJECT_ID.iam.gserviceaccount.com"
NAI_QUERY_ACCOUNT="nai-esocial-query@$NAI_PROJECT_ID.iam.gserviceaccount.com"
NAI_PROVIDER_NAME="projects/$NAI_PROJECT_NUMBER/locations/global/workloadIdentityPools/$NAI_POOL_ID/providers/$NAI_PROVIDER_ID"
```

`nai-github/github` é o nome proposto, não uma afirmação de que o recurso existe. Consultar contas,
pools, providers e papéis antes de criar. Reutilizar somente objetos que tenham sido conferidos contra
este roteiro. Para recursos existentes, comparar a configuração e alterar apenas o necessário.
Um erro 403 ou de rede não significa inexistência: parar essa etapa e corrigir o acesso; não executar
uma criação automática com base em qualquer falha do comando de consulta.

## 2. Preparar APIs, contas e cofre vazio

Habilitar previamente `iam.googleapis.com`, `iamcredentials.googleapis.com`,
`sts.googleapis.com`, `secretmanager.googleapis.com`, `cloudscheduler.googleapis.com`,
`cloudresourcemanager.googleapis.com` e `firestore.googleapis.com`, se ainda desabilitadas.
Essa operação é idempotente, mas exige uma identidade operacional autorizada a habilitar APIs:

```bash
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com \
  cloudresourcemanager.googleapis.com firestore.googleapis.com --project="$NAI_PROJECT_ID"
```

Conferir a existência das duas contas de implantação com `gcloud iam service-accounts describe`.
Somente se a inexistência estiver confirmada, criá-las:

```bash
gcloud iam service-accounts create nai-esocial-deploy --project="$NAI_PROJECT_ID" \
  --display-name='NAI eSocial infrastructure deploy'
gcloud iam service-accounts create nai-indexes-deploy --project="$NAI_PROJECT_ID" \
  --display-name='NAI Firestore indexes deploy'
```

O script Node usa Application Default Credentials (ADC), que são distintas do login do CLI.
Executá-lo somente em um ambiente com ADC do operador ou impersonação já configurada e autorizada;
não baixar JSON de chave para fazê-lo funcionar.

```bash
node scripts/setup-esocial-infrastructure.mjs
node scripts/setup-esocial-infrastructure.mjs --bootstrap --apply --require-empty
```

O primeiro comando mostra o plano sem rede. O segundo é a configuração inicial explícita:
habilita as APIs necessárias ao módulo, cria a conta invocadora e o cofre se ausentes, confere que
não há versão, ajusta os bindings do cofre para a conta runtime e configura o job de consulta.
Antes de executá-lo, conferir o agente Scheduler descrito abaixo e o bloqueio efetivo de transmissão.
Não carrega certificado e
não concede IAM no projeto. Conteúdo preexistente faz `--require-empty` falhar; preservá-lo e
investigar, sem apagar versões.

A conta runtime recebe, **apenas em `nai-esocial-a1`**:

- `roles/secretmanager.secretAccessor`;
- `roles/secretmanager.secretVersionAdder`.

Conferir que o agente Google abaixo existe e tem `roles/cloudscheduler.serviceAgent` no projeto:

```text
service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com
```

A habilitação da API normalmente prepara o agente. Se o binding estiver ausente, um operador
autorizado pode repô-lo exclusivamente no agente Google:

```bash
gcloud projects add-iam-policy-binding "$NAI_PROJECT_ID" \
  --member="serviceAccount:service-$NAI_PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role=roles/cloudscheduler.serviceAgent --condition=None
```

Não conceder esse papel à conta invocadora ou às contas de implantação.

## 3. Criar a confiança GitHub OIDC

Conferir primeiro:

```bash
gcloud iam workload-identity-pools describe "$NAI_POOL_ID" \
  --location=global --project="$NAI_PROJECT_ID"
gcloud iam workload-identity-pools providers describe "$NAI_PROVIDER_ID" \
  --workload-identity-pool="$NAI_POOL_ID" --location=global --project="$NAI_PROJECT_ID"
```

Criar o pool apenas se sua inexistência tiver sido confirmada:

```bash
gcloud iam workload-identity-pools create "$NAI_POOL_ID" --location=global \
  --project="$NAI_PROJECT_ID" --display-name='NAI GitHub deployments'
```

Usar o mapeamento e a condição seguintes. Os IDs numéricos impedem que a reutilização de um nome de
conta/repositório transfira a confiança. A condição aceita somente a branch e o ambiente de produção,
eventos esperados e os dois arquivos de workflow. O issuer não contém credencial.

```bash
NAI_ATTRIBUTE_MAPPING='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.environment=assertion.environment,attribute.workflow_ref=assertion.workflow_ref,attribute.event_name=assertion.event_name'
NAI_ATTRIBUTE_CONDITION="assertion.repository_owner_id == '276102754' && assertion.repository_id == '1210840335' && assertion.ref == 'refs/heads/main' && assertion.environment == 'production' && assertion.event_name in ['push', 'workflow_dispatch'] && assertion.workflow_ref in ['nextcon-nai-git/nai-gcp/.github/workflows/deploy.yml@refs/heads/main', 'nextcon-nai-git/nai-gcp/.github/workflows/deploy-indexes.yml@refs/heads/main']"

gcloud iam workload-identity-pools providers create-oidc "$NAI_PROVIDER_ID" \
  --project="$NAI_PROJECT_ID" --location=global --workload-identity-pool="$NAI_POOL_ID" \
  --issuer-uri='https://token.actions.githubusercontent.com' \
  --attribute-mapping="$NAI_ATTRIBUTE_MAPPING" --attribute-condition="$NAI_ATTRIBUTE_CONDITION"
```

Se o provider existir, não repetir `create-oidc`: conferir issuer, audiences, mapping, condition e
estado; usar `update-oidc` somente para diferenças aprovadas. O action usa o nome canônico do provider
como audience. Não adicionar uma audience genérica e não confiar em todo o pool.

Cada conta é impersonada somente pelo seu workflow:

```bash
NAI_PRINCIPAL_BASE="principalSet://iam.googleapis.com/projects/$NAI_PROJECT_NUMBER/locations/global/workloadIdentityPools/$NAI_POOL_ID/attribute.workflow_ref"

gcloud iam service-accounts add-iam-policy-binding "$NAI_ESOCIAL_ACCOUNT" \
  --project="$NAI_PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="$NAI_PRINCIPAL_BASE/nextcon-nai-git/nai-gcp/.github/workflows/deploy.yml@refs/heads/main"

gcloud iam service-accounts add-iam-policy-binding "$NAI_INDEXES_ACCOUNT" \
  --project="$NAI_PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="$NAI_PRINCIPAL_BASE/nextcon-nai-git/nai-gcp/.github/workflows/deploy-indexes.yml@refs/heads/main"
```

Esses bindings são idempotentes. Não é necessário conceder `roles/iam.serviceAccountTokenCreator`
no projeto, nem criar chaves. Conferir também a proteção da `main` e as restrições de branches do
ambiente `production`; não enfraquecer regras existentes para liberar uma execução.

## 4. Conceder apenas as operações do pipeline

Criar três papéis personalizados no projeto, após conferir se já existem. Os exemplos de
`roles create` destinam-se à primeira configuração. Se um papel existir, comparar a lista exata
com `gcloud iam roles describe`; atualizar somente uma divergência revisada.

Papel `naiEsocialInfrastructure`, atribuído à conta eSocial no projeto:

```bash
gcloud iam roles create naiEsocialInfrastructure --project="$NAI_PROJECT_ID" \
  --title='NAI eSocial infrastructure maintenance' --stage=GA \
  --permissions='resourcemanager.projects.get,resourcemanager.projects.getIamPolicy,serviceusage.services.get,serviceusage.services.use,iam.serviceAccounts.get,cloudscheduler.jobs.get,cloudscheduler.jobs.create,cloudscheduler.jobs.update'

gcloud projects add-iam-policy-binding "$NAI_PROJECT_ID" \
  --member="serviceAccount:$NAI_ESOCIAL_ACCOUNT" \
  --role="projects/$NAI_PROJECT_ID/roles/naiEsocialInfrastructure" --condition=None
```

Papel `naiEsocialVaultVerifier`, atribuído somente no cofre:

```bash
gcloud iam roles create naiEsocialVaultVerifier --project="$NAI_PROJECT_ID" \
  --title='NAI eSocial vault metadata verification' --stage=GA \
  --permissions='secretmanager.secrets.get,secretmanager.secrets.getIamPolicy,secretmanager.versions.list'

gcloud secrets add-iam-policy-binding nai-esocial-a1 --project="$NAI_PROJECT_ID" \
  --member="serviceAccount:$NAI_ESOCIAL_ACCOUNT" \
  --role="projects/$NAI_PROJECT_ID/roles/naiEsocialVaultVerifier" --condition=None

gcloud iam service-accounts add-iam-policy-binding "$NAI_QUERY_ACCOUNT" \
  --project="$NAI_PROJECT_ID" --member="serviceAccount:$NAI_ESOCIAL_ACCOUNT" \
  --role=roles/iam.serviceAccountUser
```

A última concessão fornece `iam.serviceAccounts.actAs` somente na conta invocadora. Não conceder
esse papel no projeto. O provisionador não recebe `secrets.setIamPolicy`, `versions.access`,
`versions.add`, `serviceAccounts.create`, `serviceAccounts.setIamPolicy` ou `services.enable`.

**Limitação do Cloud Scheduler:** ele não suporta políticas IAM por job nem condições IAM por
atributos de recurso para isolar um job. As três permissões Scheduler acima abrangem os jobs do
projeto. A limitação é reduzida por conta separada, ausência de `run/delete/pause/enable` e
`actAs` exclusivo na conta sem acesso ao A1. Não alegar isolamento IAM por nome do job.

Papel `naiIndexDeployment`, atribuído somente à conta de índices:

```bash
gcloud iam roles create naiIndexDeployment --project="$NAI_PROJECT_ID" \
  --title='NAI index deployment without data access or deletion' --stage=GA \
  --permissions='firebase.projects.get,resourcemanager.projects.get,serviceusage.services.get,serviceusage.services.use,datastore.databases.getMetadata,datastore.schemas.create,datastore.schemas.get,datastore.schemas.list,datastore.schemas.update,datastore.operations.get,datastore.operations.list'

gcloud projects add-iam-policy-binding "$NAI_PROJECT_ID" \
  --member="serviceAccount:$NAI_INDEXES_ACCOUNT" \
  --role="projects/$NAI_PROJECT_ID/roles/naiIndexDeployment" --condition=None
```

O workflow de índices testa as regras no emulador antes da autenticação. A publicação usa uma
configuração temporária sem `rules` ou `storage`, evitando a compilação remota de regras que o
Firebase CLI executaria mesmo com `--only firestore:indexes` quando há `rules` no config.
Não concede escrita em documentos, alteração de regras ou exclusão de índices. O comando não usa
`--force`. Uma mudança futura que exija exclusão deve ser revisada separadamente.

Após os bindings, conferir políticas de projeto, contas e cofre, incluindo concessões herdadas e
condicionais. A conferência do script cobre bindings necessários/diretos; ela não substitui análise
de IAM efetivo em organização/pastas. Não remover papéis de outras identidades como efeito colateral.

## 5. Configurar variáveis no GitHub

No ambiente `production` do repositório, criar **variáveis**, não segredos de chave:

| Variável | Valor |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Nome canônico conferido em `NAI_PROVIDER_NAME` |
| `GCP_ESOCIAL_DEPLOY_SERVICE_ACCOUNT` | `nai-esocial-deploy@studio-8439299034-125c7.iam.gserviceaccount.com` |
| `GCP_INDEXES_DEPLOY_SERVICE_ACCOUNT` | `nai-indexes-deploy@studio-8439299034-125c7.iam.gserviceaccount.com` |

Com GitHub CLI autorizado, após concluir e conferir o Google Cloud:

```bash
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo nextcon-nai-git/nai-gcp \
  --env production --body "$NAI_PROVIDER_NAME"
gh variable set GCP_ESOCIAL_DEPLOY_SERVICE_ACCOUNT --repo nextcon-nai-git/nai-gcp \
  --env production --body "$NAI_ESOCIAL_ACCOUNT"
gh variable set GCP_INDEXES_DEPLOY_SERVICE_ACCOUNT --repo nextcon-nai-git/nai-gcp \
  --env production --body "$NAI_INDEXES_ACCOUNT"
```

Não inventar o número do projeto, não configurar um provider inexistente e não copiar valores de
segredos. Sem as variáveis, os jobs falham antecipadamente com uma mensagem de configuração.

A ação de autenticação está fixada no commit oficial de `google-github-actions/auth@v3`
`7c6bc770dae815cd3e89ee6cdf493a5fab2cc093`. Ela só recebe `id-token: write` nos dois jobs de
implantação, após checkout, instalação e testes. O ADC temporário é excluído pelo pós-job da ação
e os arquivos `gha-creds-*.json` estão ignorados pelo Git.

## 6. Executar e verificar sem A1 e sem envios

Depois do merge desta correção e da configuração anterior, iniciar **novas** execuções na `main`.
Reexecutar uma execução antiga pode usar o workflow antigo e repetir o erro do JSON.

```bash
gh workflow run deploy-indexes.yml --repo nextcon-nai-git/nai-gcp --ref main
gh workflow run deploy.yml --repo nextcon-nai-git/nai-gcp --ref main \
  -f provision_esocial=true -f deploy_firestore=false
```

O pipeline eSocial chama:

```bash
node scripts/setup-esocial-infrastructure.mjs --apply --require-empty
node scripts/setup-esocial-infrastructure.mjs --verify --require-empty
```

`--apply` verifica APIs, contas, IAM, cofre vazio e agente Scheduler antes de manter o job.
`--verify` é somente leitura e exige configuração completa do job.
Ambos preservam uma pausa deliberada de um job existente; não o retomam automaticamente.
O workflow de ativação inicial recusa cofres com versões. Depois do futuro upload autorizado do A1,
a manutenção deverá usar um modo revisado que preserve conteúdo, sem anunciar novamente "cofre vazio".

Conferir, sem usar `versions access`:

```bash
gcloud secrets versions list nai-esocial-a1 --project="$NAI_PROJECT_ID" \
  --format='json(name,state,createTime)'
gcloud secrets get-iam-policy nai-esocial-a1 --project="$NAI_PROJECT_ID" --format=json
gcloud scheduler jobs describe nai-esocial-query --project="$NAI_PROJECT_ID" \
  --location=us-central1 --format=json
```

Registrar:

- cofre existente e **zero versões**, medidos pela API;
- conta runtime e dois papéis exclusivamente no cofre;
- ausência de acesso ao cofre para o invocador e para a conta de índices;
- serviço, método POST, corpo vazio, audience e conta OIDC exatos;
- frequência, fuso, prazo, retentativas e estado do job;
- estado real dos índices e preservação dos demais índices;
- configuração efetiva de `ASO_CLIENT_EMAIL_SEND_ENABLED=false` e
  `ESOCIAL_TRANSMISSION_ENABLED=false`, inclusive possíveis substituições no App Hosting.

Para testar execução OIDC, primeiro conferir que o cofre continua vazio e que o bloqueio global de
transmissão está efetivamente ativo. Usar a rota de consulta protegida com comportamento inerte
durante a validação, nunca substituir o alvo por envio, aprovação ou upload. Um operador autorizado
pode executar o job uma vez; a conta de implantação não precisa de `jobs.run`:

```bash
gcloud scheduler jobs run nai-esocial-query --project="$NAI_PROJECT_ID" --location=us-central1
gcloud logging read \
  'resource.type="cloud_scheduler_job" AND resource.labels.job_id="nai-esocial-query"' \
  --project="$NAI_PROJECT_ID" --freshness=30m --limit=20 --format=json
```

Correlacionar `AttemptStarted`/`AttemptFinished` com os registros da aplicação, incluindo horário,
HTTP e resultado inerte. Não imprimir headers de autorização, tokens, certificados, XMLs clínicos
ou dados pessoais nos relatórios. Um 2xx sem evidência do handler não basta para concluir execução
da rotina correta. Verificar também rejeição de uma chamada sem credencial ou com audience errada.

## Evidências e critérios de conclusão

| Camada | Evidência exigida | O que não comprova |
| --- | --- | --- |
| Publicação | Commit e rollout do App Hosting com sucesso | IAM, cofre, scheduler, recibo eSocial |
| Provisionamento | Nova execução WIF aprovada, metadados do cofre/job, zero versões e políticas conferidas | Chamada OIDC efetiva ou aceitação pelo eSocial |
| Agendador | Execução OIDC correlacionada, rejeições de acesso indevido e comportamento inerte | Assinatura ou transmissão governamental |
| Homologação futura | A1/procuração autorizados, testes restritos e recibos reais correlacionados | Autorização automática para produção |

O certificado A1 permanece para instalação posterior do usuário. Homologação e habilitação de
produção são etapas distintas. E-mails a clientes permanecem desligados. Se acesso ao Google Cloud
ou variáveis continuarem indisponíveis, registrar a implantação de código e o bloqueio de
provisionamento separadamente, sem marcar a infraestrutura ou o sistema como homologados.

## Fontes primárias conferidas

- [Google: WIF para pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [GitHub: claims e permissões OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Google GitHub Actions auth](https://github.com/google-github-actions/auth)
- [Tag v3 e commit](https://github.com/google-github-actions/auth/commit/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093)
- [Secret Manager: IAM](https://docs.cloud.google.com/secret-manager/docs/access-control)
- [Cloud Scheduler: IAM e limitação por projeto](https://docs.cloud.google.com/scheduler/docs/access-control)
- [Cloud Scheduler: OIDC](https://docs.cloud.google.com/scheduler/docs/http-target-auth)
- [Cloud Scheduler: logs e diagnóstico](https://docs.cloud.google.com/scheduler/docs/troubleshooting)
- [Firestore: permissões atuais](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore)
- [Firebase CLI v15.33.0: ADC](https://github.com/firebase/firebase-tools/blob/v15.33.0/src/requireAuth.ts)
- [Firebase CLI v15.33.0: preparação de regras/índices](https://github.com/firebase/firebase-tools/blob/v15.33.0/src/deploy/firestore/prepare.ts)

