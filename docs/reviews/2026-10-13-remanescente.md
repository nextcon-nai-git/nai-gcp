# Complemento da revisão remanescente

Este complemento registra uma correção reproduzível na importação de contratos e
reconfere os limites do fluxo comercial/financeiro. A revisão integral anterior
(`2026-10-13-integral.md`) contém o inventário de páginas/APIs, correções e
pendências amplas. Esta entrega não declara que cada tela, estado ou integração
externa foi manualmente homologada.

## Matriz do fluxo conferido

| Fluxo/arquivo                                                                                                                               | Origem e autorização                                                                                                                                                                                    | Persistência e estados                                                                                                                                                                                                                                                                                                     | Retry, concorrência e evidência de teste                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Importação `/contracts` — `src/app/contracts/page.tsx`, `src/lib/contracts/integration.ts`                                                  | PDF selecionado por usuário; extração Genkit exige token de ação e papel permitido (`src/ai/flows/contract-analysis-flow.ts`, `src/lib/auth/ai-action.ts`). Escritas Firebase seguem `firestore.rules`. | Empresa, contrato extraído e cards de tarefa agora são gravados na mesma transação. Falha mantém o item em erro e oferece nova tentativa; contrato identificado pelo SHA-256 do PDF e tarefas por índice estável. A extração não comprova assinatura, aceite ou autenticidade documental.                                  | `src/lib/contracts/integration.test.ts`: IDs estáveis, duplicata ignorada, CNPJ inválido e falha de transação propagada. Testes usam uma transação simulada; não homologam Firebase de produção.                                                  |
| Faturamento mensal — `src/app/api/financial/monthly-billing/route.ts`, `src/services/monthly-billing.ts`                                    | Payload validado no serviço; acesso financeiro corporativo exigido antes de ler/escrever. Revisão compara a versão da carteira e o grupo selecionado.                                                   | Empresa, contrato e auditoria são gravados em transação; lote repetido não cria registros novamente. Importação de planilha não é emissão de nota.                                                                                                                                                                         | `src/services/monthly-billing.test.ts`: novo cadastro, repetição, conflito de versão/grupo e negação a tenant. Fixtures sintéticas; nenhuma nota ou empresa real foi criada.                                                                      |
| Proposta/pedido → contrato → produção — `src/lib/financial/erp.ts`, `src/lib/financial/contract-flow.ts`, `src/lib/financial/operations.ts` | Pedido de venda exige cadastros ativos e aprovação por pessoa diferente do criador; comandos exigem acesso financeiro no serviço servidor.                                                              | Pedido aprovado é convertido uma vez em contrato; implantação e conferência independente precedem produção/faturamento conforme condição registrada. Histórico fica no livro versionado e auditado. O contrato integrado ainda cobre mensalidade fixa e serviços avulsos, não aditivos nem condições comerciais completas. | `src/lib/financial/contract-flow.test.ts`: aprovação, repetição, readiness, revisão segregada, prevenção de cobranças paralelas e compatibilidade histórica. O serviço salva com geração Firestore CAS em `src/services/financial-operations.ts`. |
| Títulos, recebimentos e conciliação — `src/lib/financial/operations.ts`, `src/services/financial-operations.ts`                             | Apenas administração financeira corporativa; transições de aprovação segregadas.                                                                                                                        | Título em rascunho não é nota emitida. Baixas mantêm principal e caixa separados; estorno exige justificativa e conciliação desfeita. O livro usa geração CAS, versão esperada e trilha de auditoria.                                                                                                                      | `src/lib/financial/operations.test.ts`: repetição, versão concorrente, baixa parcial, estorno e conciliação. Dados de teste são sintéticos; Omie não sincroniza baixas automaticamente.                                                           |
| Consulta de NFS-e — `src/app/api/financial/nfse/route.ts`, `src/services/fiscal-invoices.ts`                                                | Autenticação e papel financeiro exigidos; resposta do Omie conferida por empresa, ambiente, datas, paginação e IDs.                                                                                     | Endpoint é somente leitura. Emissão direta nacional permanece explicitamente indisponível; título local não é prova de NFS-e emitida.                                                                                                                                                                                      | `src/services/fiscal-invoices.test.ts` exercita contrato Omie simulado, dados vazios e respostas inválidas. Credenciais e homologação do provedor não foram verificadas nesta execução.                                                           |

## Correção nesta entrega

Antes da correção, a importação usava IDs aleatórios para contratos e tarefas.
Além disso, `addDocumentNonBlocking` captura falhas de gravação e resolve sem
rejeitar; a tela podia exibir sucesso mesmo sem a persistência completa. Repetir
uma integração podia criar contratos e cards duplicados.

A integração agora usa o hash do arquivo como identidade estável, cria empresa,
contrato e cards em uma transação Firestore e retorna sem escrever quando o
mesmo arquivo já está integrado. Erros de transação são propagados e a interface
mantém a possibilidade de tentar novamente. O limite de 498 tarefas preserva o
limite de 500 gravações por transação. A repetição não reescreve cards já
existentes nem reinicia seu estado.

## Limites e itens não homologados

- A importação por IA organiza obrigações extraídas, mas não confirma assinatura,
  poderes de signatário, vigência, validade jurídica ou conclusão operacional.
- O fluxo financeiro atual não representa separadamente CNPJ da contratada e do
  tomador, código de serviço fiscal, setup, êxito, signatários/testemunha,
  pendências documentais ou autenticidade de certidões. Não há enquadramento
  fiscal inferido nem cliente hard-coded; ampliar essas condições requer contrato
  de dados e interface próprios.
- O vencimento mensal mantém a regra existente de dia 1–28; grade de pagamento
  e prazo contado da emissão não estão representados pelo fluxo integrado.
- Emissão, retornos/baixas do Omie, assinatura, certificados, mensageria e
  provedores não foram homologados nesta execução. Não foram criadas notas,
  pagamentos, protocolos, usuários ou mensagens reais.
- Backup/restore, DNS, restrições de credenciais e aceite humano permanecem
  dependências operacionais conforme a revisão integral. PRs #104 (Prestadores)
  e #106 (vínculo ASO/atendimento) permanecem fora da edição deste complemento.
- `firebase.json` configura App Hosting, regras e índices; o diretório legado
  `functions/` não é listado como implantação de Cloud Functions nessa
  configuração. A existência de código legado não é evidência de deploy.

## Validação local desta entrega

Runtime Node `v24.21.0`. `npm ci` concluiu. Os testes focados de integração
contratual, fluxo comercial/financeiro e faturamento mensal passaram (35 testes
em 3 arquivos). A suíte completa com cobertura passou: 1.381 testes em 154
arquivos; statements 41,77%, branches 37,11%, functions 33,61%, lines 42,33%.
`format:check` e `type-check` passaram. ESLint global concluiu com zero erros e
1.366 avisos; os avisos não foram ocultados nem rebaixados nesta alteração.

`test:rules` não iniciou os emuladores: o download do Firestore Emulator
retornou HTTP 403 pelo proxy de monitoramento DNS. `npm audit --omit=dev
--audit-level=high` retornou 71 avisos na árvore (12 altos, 59 moderados),
incluindo OpenTelemetry, Tailwind/braces e UUID transitivo. As correções
automáticas disponíveis exigem atualizações incompatíveis com a configuração
atual; nenhuma atualização `--force` foi aplicada. `npm run build` passou e
gerou as rotas do app, com warnings de módulos opcionais OpenTelemetry
(`winston-transport`, Jaeger) e dependência crítica dinâmica. CI, CodeQL e
workflow de segurança devem ser conferidos no SHA final do PR; compilação local
não substitui esses checks.

Na revisão final, parallel validation não encontrou comentários de código e o
CodeQL reportou zero alertas JavaScript. Os workflows CI, Security e Firebase
validation do PR #109 para o SHA `2887ce8` terminaram como `action_required`,
com zero jobs; não há resultado de CI hospedado até que a aprovação externa
necessária seja concedida.
