# Complemento da revisão remanescente

Este complemento registra uma correção reproduzível na importação de contratos e
reconfere os limites do fluxo comercial/financeiro. A revisão integral anterior
(`2026-10-13-integral.md`) contém o inventário de páginas/APIs, correções e
pendências amplas. Esta entrega não declara que cada tela, estado ou integração
externa foi manualmente homologada.

## Matriz do fluxo conferido

| Fluxo/arquivo                                                                                                                               | Origem e autorização                                                                                                                                                                                                                                                            | Persistência e estados                                                                                                                                                                                                                                                                                                                                   | Retry, concorrência e evidência de teste                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Importação `/contracts` — `src/app/contracts/page.tsx`, `src/lib/contracts/integration.ts`                                                  | PDF selecionado e preservado em Storage privado create-only, vinculado por SHA-256, geração e tamanho. A integração exige ID explícito de cadastro existente, CNPJ válido coincidente e cadastro ativo. Não grava `/companies/{id}`; as regras existentes seguem sem ampliação. | Registro de origem, contrato e até 15 cards sem vencimento/prioridade presumidos são gravados em transação. A confirmação do revisor fica persistida. Retry valida cadastro e vínculo; resposta ambígua relê registro/contrato; a interface só anuncia sucesso após confirmar a persistência. Extração não comprova assinatura, aceite ou autenticidade. | `src/lib/cnpj.test.ts` e `src/lib/contracts/integration.test.ts`: CNPJ numérico/alfanumérico, checksums inválidos, ID legado, estados impeditivos, replay concorrente/mockado, campos não inventados e confirmação de commit ambíguo. `tests/rules/contracts-import.test.ts` cobre Storage/Firestore sob emulador; execução depende do download do emulador. |
| Faturamento mensal — `src/app/api/financial/monthly-billing/route.ts`, `src/services/monthly-billing.ts`                                    | Payload validado no serviço; acesso financeiro corporativo exigido antes de ler/escrever. Revisão compara a versão da carteira e o grupo selecionado.                                                                                                                           | Empresa, contrato e auditoria são gravados em transação; lote repetido não cria registros novamente. Importação de planilha não é emissão de nota.                                                                                                                                                                                                       | `src/services/monthly-billing.test.ts`: novo cadastro, repetição, conflito de versão/grupo e negação a tenant. Fixtures sintéticas; nenhuma nota ou empresa real foi criada.                                                                                                                                                                                 |
| Proposta/pedido → contrato → produção — `src/lib/financial/erp.ts`, `src/lib/financial/contract-flow.ts`, `src/lib/financial/operations.ts` | Pedido de venda exige cadastros ativos e aprovação por pessoa diferente do criador; comandos exigem acesso financeiro no serviço servidor.                                                                                                                                      | Pedido aprovado é convertido uma vez em contrato; implantação e conferência independente precedem produção/faturamento conforme condição registrada. Histórico fica no livro versionado e auditado. O contrato integrado ainda cobre mensalidade fixa e serviços avulsos, não aditivos nem condições comerciais completas.                               | `src/lib/financial/contract-flow.test.ts`: aprovação, repetição, readiness, revisão segregada, prevenção de cobranças paralelas e compatibilidade histórica. O serviço salva com geração Firestore CAS em `src/services/financial-operations.ts`.                                                                                                            |
| Títulos, recebimentos e conciliação — `src/lib/financial/operations.ts`, `src/services/financial-operations.ts`                             | Apenas administração financeira corporativa; transições de aprovação segregadas.                                                                                                                                                                                                | Título em rascunho não é nota emitida. Baixas mantêm principal e caixa separados; estorno exige justificativa e conciliação desfeita. O livro usa geração CAS, versão esperada e trilha de auditoria.                                                                                                                                                    | `src/lib/financial/operations.test.ts`: repetição, versão concorrente, baixa parcial, estorno e conciliação. Dados de teste são sintéticos; Omie não sincroniza baixas automaticamente.                                                                                                                                                                      |
| Consulta de NFS-e — `src/app/api/financial/nfse/route.ts`, `src/services/fiscal-invoices.ts`                                                | Autenticação e papel financeiro exigidos; resposta do Omie conferida por empresa, ambiente, datas, paginação e IDs.                                                                                                                                                             | Endpoint é somente leitura. Emissão direta nacional permanece explicitamente indisponível; título local não é prova de NFS-e emitida.                                                                                                                                                                                                                    | `src/services/fiscal-invoices.test.ts` exercita contrato Omie simulado, dados vazios e respostas inválidas. Credenciais e homologação do provedor não foram verificadas nesta execução.                                                                                                                                                                      |

## Correção nesta entrega

Antes da correção, a importação usava IDs aleatórios para contratos e tarefas.
Além disso, `addDocumentNonBlocking` captura falhas de gravação e resolve sem
rejeitar; a tela podia exibir sucesso mesmo sem a persistência completa. Repetir
uma integração podia criar contratos e cards duplicados.

A integração agora armazena e verifica o PDF original antes da análise e usa seu
hash como identidade estável. Exige seleção explícita de cadastro existente;
confere CNPJ numérico/alfanumérico com dígitos verificadores, identidade e estado
ativo antes de gravar somente o contrato, o registro de origem e os cards em
transação. Não altera nome, endereço, risco ou estado do cadastro. O cadastro
arquivado/inativo, ausente ou divergente exige conferência. Registro e contrato
guardam caminho, geração, tamanho e confirmação do revisor; a fonte não pode ser
substituída pelas regras de Storage. A repetição concorrente não recria cards nem
reinicia estado, e a confirmação após timeout relê o vínculo persistido.
Obrigações extraídas não recebem data ou prioridade presumida; o serviço rejeita
mais de 15 tarefas, conforme limite declarado pelo prompt.

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
- Esta alteração é parcial e **não encerra #108**; o PR deve referenciar `Refs #108`,
  não usar fechamento automático. Setup, êxito, grade, CNPJ do tomador,
  signatários/documentos, módulos restantes e revisão integral continuam
  explicitamente pendentes.
- `firebase.json` configura App Hosting, regras e índices; o diretório legado
  `functions/` não é listado como implantação de Cloud Functions nessa
  configuração. A existência de código legado não é evidência de deploy.

## Validação local desta entrega

Runtime Node `v24.21.0`; `npm ci` concluiu. Os testes focados de CNPJ/importação
passaram (14 testes em 2 arquivos). A suíte completa com cobertura passou: 1.389
testes em 155 arquivos; statements 41,92%, branches 37,39%, functions 33,75%,
lines 42,49%. `format:check`, `type-check` e `npm run build` passaram. ESLint
global concluiu com zero erros e 1.366 avisos; os avisos não foram ocultados nem
rebaixados nesta alteração. A geração de rotas do build não foi tratada como
homologação manual de telas.

`tests/rules/contracts-import.test.ts` foi adicionado para executar os fluxos com
as regras reais no emulador; `test:rules` não iniciou os emuladores porque o
download do Firestore Emulator retornou HTTP 403 pelo proxy de monitoramento
DNS. Portanto, compatibilidade efetiva das regras permanece bloqueada, não
atestada por mocks. `npm audit --omit=dev --audit-level=high` retornou 71
advisories na árvore de produção (12 altos, 59 moderados), incluindo
OpenTelemetry, Tailwind/braces e UUID transitivo; instalação completa reportou
78 no total. Correções automáticas exigem atualizações incompatíveis na
configuração atual; nenhuma atualização `--force` foi aplicada. O build passou
com warnings de compilação/dependências preexistentes.

Para o SHA final `600afdce1853c0a9f405197c768e3bba1a194848`, CI, Security e
Firebase validation terminaram como `action_required`, cada uma com zero jobs;
consulta dos logs não encontrou jobs com falha porque nenhum foi iniciado.
`parallel_validation` reportou zero alertas CodeQL e nenhum comentário de review,
mas a ferramenta de review sinalizou que seu executável não estava disponível,
portanto não equivale a uma aprovação humana. A execução real desses workflows
depende da aprovação externa. O PR #109 referencia `Refs #108` e mantém #108
aberta. A compilação local não substitui os checks hospedados nem a homologação
do emulador.
