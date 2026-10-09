# Recebimento de mensagens individuais AVP

Endpoint: POST /api/integrations/rd-conversas/webhook.

Esta implementação recebe texto e registra no Firestore em
integrations/rd-conversas-avp/messages. Não envia respostas, não altera agendamentos
e não consulta histórico Advanced. Não usa o JWT do RD para receber webhooks.

## Configuração necessária antes de ativar

- RD_CONVERSAS_WEBHOOK_SECRET: segredo aleatório de pelo menos 32 caracteres,
  armazenado no Secret Manager e disponibilizado apenas em RUNTIME.
- RD_CONVERSAS_AVP_PHONES: telefones autorizados separados por vírgula, com 55 e DDD.
  Usar os números exatos do relatório fornecido; não adicionar o nono dígito por inferência.
- No RD: nome do cabeçalho X-NAI-Webhook-Secret e valor igual ao segredo.
- Publicar a revisão e testar o caminho HTTPS antes de ativar o webhook.
- O token RD compartilhado no chat deve ser substituído antes de qualquer uso futuro.

Não incluir token, segredo, nomes ou lista de telefones em commits.
As regras existentes restringem a leitura de integrations à equipe operacional
autenticada e bloqueiam escritas de clientes nessa coleção.

## Contratos de payload provisórios

A estrutura real do webhook RD ainda não foi fornecida. Estes contratos são
suportados pelo adaptador, mas NÃO constituem confirmação do formato do fornecedor:

    {"direction":"inbound","phone":"55DDDNUMERO","message_id":"id-unico","message":"texto"}

Ou:

    {"data":{"sent_by":"customer","customer":{"cel_phone":"55DDDNUMERO"},"message":{"id":"id-unico","text":"texto"}}}

Exigir identificador estável e direção de entrada. Payloads desconhecidos retornam
422 sem gravar dados brutos. Anexos e eventos em lote não são suportados nesta etapa.
Antes de habilitar em produção, obter um evento real com dados ocultados, ajustar
o adaptador ao contrato observado e repetir os testes. Selecionar no RD as etapas
de atendimento necessárias somente depois dessa validação.

## Respostas

200: registrada, duplicada ou ignorada (saída/contato fora da lista).
401: segredo ausente/incorreto. 503: configuração ou banco indisponível.
400: JSON inválido. 413: corpo acima de 64 KiB. 415: tipo diferente de JSON.
422: payload não reconhecido. O corpo é limitado durante leitura.
O mesmo ID do fornecedor produz o mesmo documento, com deduplicação em transação.

## Validação

node --experimental-strip-types --test tests/integrations/rd-conversas-webhook.test.mjs

Teste final de produção: mensagem individual de contato autorizado aparece uma vez;
repetir o mesmo evento não duplica; contato externo não é armazenado.
Não registrar texto, telefone, cabeçalhos nem credenciais nos logs.
