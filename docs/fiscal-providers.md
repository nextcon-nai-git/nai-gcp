# Central fiscal e evolução dos provedores

A rota `/financial/notas-fiscais` consulta NFS-e pelo Omie, com paginação e filtros
obrigatórios de período e ambiente. Não emite, cancela ou reenvia documentos.
A emissão pelo NAI, tanto via Omie quanto diretamente, permanece pendente.

`FiscalPage` e `FiscalInvoice` são contratos próprios; somente o adaptador em
`src/services/fiscal-invoices.ts` conhece os campos do provedor. A credencial já
conectada define a empresa. Cada nota retornada deve corresponder ao CNPJ,
ambiente e período solicitados; divergências interrompem a consulta inteira.
O limite de consulta é de 12 meses de calendário, com aniversário de 29 de
fevereiro ajustado ao último dia de fevereiro no ano seguinte. Páginas vazias
fora do total informado são rejeitadas; uma consulta sem resultados admite
apenas a primeira página. Valores usam a conversão decimal de ponto fixo do
Omie (até quatro casas) antes do arredondamento final para centavos, evitando
erros binários como 1,005 ser exibido como 1,00.
Não há persistência de notas, importação de histórico ou criação de recebíveis
nesta versão. A interface não interpreta status F do ERP como autorização fiscal.

Acesso restrito à administração financeira corporativa, respostas no-store,
requisições limitadas e resposta Omie limitada a 16 MiB. Não existe proxy de
métodos, download remoto arbitrário ou endpoint de upload de certificado.

## Próximas entregas necessárias para emissão

1. Emissão Omie: prévia completa da OS, validação fiscal, confirmação vinculada
   ao conteúdo e reserva persistente antes de transmitir. Timeout deve bloquear
   reenvio até reconciliação. Não criar novamente o recebível gerado pelo Omie.
2. Emissão direta: implementar o contrato vigente do emissor aplicável ao
   estabelecimento, assinatura, custódia privada do A1, rotação e expiração.
   Homologar emissão, consulta e cancelamento antes de permitir produção.
3. Migração: importar e verificar XML/PDF/histórico com origem e identificadores
   preservados, conciliar recebíveis e pendências e definir corte por emissor.
   Não é suficiente trocar uma opção visual de provedor.

`provider: national` falha fechado com HTTP 409 e não usa as credenciais Omie.
Nenhum dado cadastral específico do cliente é incluído no repositório público.
Regime fiscal e município não são inferidos a partir do tomador.

## Fontes do contrato

- https://app.omie.com.br/api/v1/servicos/nfse/
- https://ajuda.omie.com.br/pt-BR/articles/1369937-adicionando-ou-atualizando-o-certificado-digital

## Validação

Testes cobrem segregação de acesso, contrato Omie, datas impossíveis,
ambiente/CNPJ divergentes, paginação, duplicidade, provedor não implementado,
limite de corpo e proteção de mensagens de erro. Nenhuma nota real é emitida.
