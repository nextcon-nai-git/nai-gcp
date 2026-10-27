# Entrega durável de webhooks

Eventos e replays são persistidos em `webhook_deliveries`. A resposta de criação
confirma o enfileiramento, não o recebimento pelo destino. Um Cloud Scheduler
invoca `POST /api/internal/webhook-deliveries` a cada minuto. Não há envio HTTP
desacoplado do ciclo de vida da requisição.

## Processamento

O worker busca até 10 registros PENDING (inclusive legados com nextRetryAt nulo)
e 10 RETRYING vencidos por chamada, com concorrência de cinco envios. Cada
tentativa obtém uma concessão transacional de dois minutos e incrementa o contador
antes do envio. Uma interrupção permite recuperação quando a concessão expira.
Somente o dono da concessão pode finalizar a tentativa.

Falhas usam backoff de 60, 120, 240 e 480 segundos, com até cinco tentativas.
Destinos revogados, alterados ou rejeitados pela proteção de egress terminam em
DEAD_LETTER. Falhas de infraestrutura ao processar a fila retornam HTTP 503 ao
agendador e preservam os registros para recuperação.

A entrega é **pelo menos uma vez**. Uma interrupção após o destino receber o
evento e antes de gravar o sucesso pode causar duplicidade. O destinatário deve
deduplicar pelo cabeçalho X-NAI-Delivery-Id (ou X-NAI-Event-Id). O replay mantém
esses identificadores, permite apenas FAILED/DEAD_LETTER e reinicia o orçamento
de tentativas; PENDING, RETRYING e DELIVERED retornam conflito.

## Ativação

Esta mudança de código não provisiona recursos em produção.

1. Publicar os índices de `firestore.indexes.json` e aguardar ficarem prontos.
2. Publicar o app com a rota e as variáveis WEBHOOK_INVOKER_EMAIL e
   WEBHOOK_WORKER_AUDIENCE. O audience deve ser exatamente a URL HTTPS do worker.
3. Habilitar Cloud Scheduler no projeto. A identidade que provisiona o job precisa
   de permissão para criar/atualizar jobs e atuar como a conta OIDC selecionada.
   O service agent do Cloud Scheduler precisa poder emitir tokens para essa conta.
4. Definir as quatro variáveis abaixo e executar o script de provisionamento:

```bash
export WEBHOOK_PROJECT_ID="studio-8439299034-125c7"
export WEBHOOK_SCHEDULER_LOCATION="us-central1"
export WEBHOOK_INVOKER_EMAIL="firebase-app-hosting-compute@studio-8439299034-125c7.iam.gserviceaccount.com"
export WEBHOOK_WORKER_AUDIENCE="https://nai--studio-8439299034-125c7.us-central1.hosted.app/api/internal/webhook-deliveries"
bash scripts/setup-webhook-scheduler.sh
```

O script cria ou atualiza o job `nai-webhook-deliveries`, com POST, token OIDC,
intervalo de um minuto e prazo de 180 segundos. A rota valida audience, e-mail e
email_verified e recusa chamadas quando a configuração está ausente.

Executar o job manualmente pelo Cloud Scheduler, conferir uma entrega de teste
até DELIVERED e testar falha temporária até recuperação. Monitorar a idade dos
registros PENDING/RETRYING e o volume em DEAD_LETTER; ampliar a capacidade do
worker se a fila crescer. O código não processará automaticamente a fila antes
da ativação do job.

## Validação

```bash
npx vitest run src/services/webhooks/webhook-dispatcher.test.ts src/app/api/internal/webhook-deliveries/route.test.ts
npm run typecheck
npm run lint
```

Os testes cobrem persistência sem envio em background, exclusão concorrente,
retentativa apenas no prazo, recuperação de concessão expirada, orçamento de
tentativas, proteção contra finalização atrasada, revogação do destino, isolamento
por empresa, replay e autenticação do agendador. São testes com Firestore e HTTP
simulados; a ativação exige também a verificação de ponta a ponta acima.
