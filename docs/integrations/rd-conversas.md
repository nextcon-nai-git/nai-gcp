# Recebimento de mensagens individuais AVP

Endpoint: POST /api/integrations/rd-conversas/webhook.

Esta implementação recebe texto e registra no Firestore em
integrations/rd-conversas-avp/messages. Solicitações completas criam também um card
em integrations/rd-conversas-avp/asoRequests, na etapa solicitado. Não envia respostas
nem consulta histórico Advanced. Não usa o JWT do RD para receber webhooks.

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

## Solicitação de ASO concluída no coletor do RD

Na última etapa do formulário/chatbot, configurar uma ação HTTP POST para o mesmo
endpoint, com o cabeçalho X-NAI-Webhook-Secret já existente. O contrato abaixo é
definido pelo NAI para essa ação; não é uma afirmação sobre o webhook nativo do RD.
Mapear as variáveis coletadas no RD e enviar apenas após o cliente/coordenador
confirmar o preenchimento. Reutilizar o mesmo request_id nas tentativas da mesma
solicitação. Uma nova solicitação deve receber outro ID.

Exemplo com dados sintéticos:

```json
{
  "event": "aso.request.completed",
  "request_id": "identificador-estavel-da-solicitacao",
  "phone": "5511999990000",
  "aso_request": {
    "companyName": "Empresa de Teste",
    "cnpj": "12.345.678/0001-95",
    "employeeName": "Pessoa de Teste",
    "cpf": "529.982.247-25",
    "roleTitle": "Assistente",
    "department": "Administrativo",
    "examType": "admissional",
    "requestedCity": "Campinas/SP"
  }
}
```

Todos os campos são obrigatórios; CPF e CNPJ numéricos têm dígitos verificadores
validados. Tipos: admissional, periodico, demissional, retorno_trabalho,
mudanca_funcao. O telefone deve ser o contato autorizado que preencheu a
solicitação, nunca um número inferido do CPF. Formulário incompleto ou ID ausente
retorna 422; 503 permite repetir com o mesmo ID. A mensagem e o card são criados
na mesma transação. Reentrega preserva o card e sua etapa atual.

Também é possível receber uma mensagem de entrada completa com as linhas
SOLICITAÇÃO DE ASO, Empresa:, CNPJ:, Colaborador:, CPF:, Cargo:, Setor:,
Tipo de ASO: e Cidade/UF:. Mensagens comuns/incompletas continuam apenas no
histórico e não geram cards. Mensagens de saída/bot comuns continuam ignoradas;
a ação HTTP de conclusão é um evento explícito separado.

A equipe SUPER_ADMIN, ADMIN e OPERATIONS vê e avança os cards compartilhados.
Clientes e demais perfis não recebem acesso à fila compartilhada. Os pedidos
pessoais existentes são preservados. A tela aguarda autenticação e atualiza a
cada 15 segundos, com indicação da origem RD Conversas e cidade.

Os cards entram em solicitado, sem escolher clínica, definir exames ou gerar
kit com dados presumidos. A equipe confere cadastro, PGR e PCMSO nas próximas etapas.

Validação automatizada:

```sh
node --experimental-strip-types --test tests/integrations/rd-conversas-webhook.test.mjs tests/integrations/rd-aso-request.test.mjs
```

Pendências de ativação: publicar a revisão, autenticar no painel
https://app.tallos.com.br/app/integrations/api e mapear a ação de conclusão do
coletor para esse contrato. Confirmar um evento real e verificar no Kanban;
repetir o mesmo evento deve manter um único card. O recebimento nativo de mensagens
mantém os contratos provisórios descritos acima até validação do evento real.
