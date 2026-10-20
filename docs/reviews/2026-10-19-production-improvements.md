# Programação contratual e passagem da operação para faturamento

## Objetivo da entrega

A base `69173a21172f980a73330b961227f4bdac83cd07` apresentava três limitações
concretas: o CI abortava na combinação incompatível de ESLint e plugins; os prazos
relativos e a recorrência exigiam programação individual; a Central não reunia
os ciclos entregues ou medidos em uma fila de conferência para faturamento.

Esta entrega implementa as prioridades M01, M03 e M08 do levantamento de
melhorias. A homologação operacional da versão publicada (M02) é uma etapa
distinta das verificações de código descritas abaixo.

## Recuperação da validação

- Restaurado o delta de dependências anterior ao PR #144: ESLint 9.39.4,
  `eslint-config-next` 16.2.3, `eslint-plugin-react` 7.37.5 e
  `eslint-plugin-react-hooks` 7.0.1.
- Preservadas as outras atualizações já incorporadas à main e as regras de
  `eslint.config.mjs`.
- Suspensas somente as atualizações de versão principal do ESLint pelo
  Dependabot até validar uma combinação compatível dos plugins. Atualizações
  menores e correções continuam permitidas.
- Corrigida a documentação do piso de cobertura: 70% de linhas, conforme a
  configuração vigente, sem alteração do piso.

## Programação de prazos e recorrências

Na Central de Contratos e Produção, o registro selecionado passa a oferecer
**Programar prazos e recorrências**. O usuário informa o marco, a data, as
obrigações selecionadas, os dias corridos e o fundamento da programação. Uma
prévia apresenta datas anteriores e novas, fonte da obrigação e valores antes
da confirmação.

Há dois comandos no endpoint autenticado existente:

- `scheduleTasks`: programa os prazos das tarefas ainda não iniciadas do ciclo
  selecionado, preservando responsáveis, bloqueios, checklist, evidências e a
  obrigação original.
- `scheduleCycles`: cria um lote aprovado de 2 a 12 ciclos mensais, trimestrais
  ou anuais. Exige contrato ativo formalizado, revisão recorrente, seleção de
  obrigações e valor por ciclo informado ou explicitamente pendente.

O servidor recalcula as datas a partir do plano estruturado. Não interpreta a
cláusula por IA nem recebe as datas finais como fonte de verdade. A programação
preserva o dia original na recorrência: por exemplo, 31 de janeiro, último dia
de fevereiro e 31 de março. O calendário não inclui feriados ou dias úteis.

Cada marco deve pertencer à vigência da revisão escolhida; um lote que atravesse
uma revisão posterior precisa ser separado. Um prazo de entrega posterior ao
término pode ser aprovado quando a regra contratual assim determinar; a prévia
o destaca. Datas suportadas: 2000 a 2100; deslocamentos: até 3.650 dias corridos
antes ou depois do marco.

O lote inteiro é validado antes de alterar o acervo. A detecção de conflito
considera serviço e competência explícita, incluindo `AAAA-MM`, `MM/AAAA` e sua
sobreposição com um ciclo diário do mesmo mês. Duas ordens diárias diferentes
permanecem distintas. Textos livres não são interpretados como competências.
O limite existente de 200 ciclos por contrato permanece vigente.

Os comandos reutilizam autorização, versão esperada, gravação por geração,
`requestId`, hash e releitura de confirmação. A auditoria registra o plano
aprovado e as datas efetivamente aplicadas. Repetição da mesma solicitação não
duplica ciclos; mudança de ator ou conteúdo sob o mesmo identificador é
rejeitada. O valor global do contrato não é transformado em mensalidade.

## Operação e faturamento

A nova área **Operação e faturamento** consulta a Central e o ERP, mostrando um
item por ciclo, com cliente, período, serviço, evidências, responsável, valores
e a providência necessária. O botão **Conferir ciclo** abre o registro e o ciclo
corretos na esteira existente.

As situações são: aguardando medição, medição com saldo a conferir, antecipação
documentada e revisão necessária. O saldo de cada ciclo é a medição registrada
menos o faturamento registrado. O indicador agrega somente entregas com medição
concluída e sem outras pendências identificadas. Mensalidades, antecipações,
revisões e medições ainda não concluídas ficam fora desse total.

A fila considera contrato e CNPJ, aprovação, implantação e condições de
faturamento no ERP, além de títulos existentes e vínculos inconsistentes.
Mensalidades e possíveis títulos do mesmo contrato e competência exigem
conferência de cobertura ou associação; valores coincidentes não criam vínculos
automáticos. Um ciclo com valor integral preenchido e etapa fiscal reaberta
continua visível para revisão, com saldo zero. Faturamento concluído e consistente
segue no fluxo de recebimento, sem aparecer como nova cobrança pendente.

O período diário do ciclo inicial deriva da data de efeito do contrato e não é
interpretado como competência de cobrança. A interface orienta conferir o
contrato e o título no ERP. Quando há título explicitamente vinculado, sua
competência aparece identificada como informação desse título.

`GET /api/production/billing-queue` exige autenticação, o mesmo acesso financeiro
da Central e a versão esperada do acervo. Respostas e falhas usam cabeçalhos
privados sem cache. O retorno inclui somente os campos da fila e as versões
consultadas; não entrega o livro financeiro completo. A interface descarta
respostas tardias, oculta a consulta anterior quando a Central muda e limpa os
dados quando a sessão perde acesso.

A consulta representa duas versões lidas separadamente. Ela não constitui uma
transação conjunta, nova conciliação ou autorização de emissão. As regras de
gravação e aprovação dos fluxos existentes continuam sendo executadas quando o
operador realiza uma ação financeira. A fila não soma serviços do ERP aos ciclos,
não cria títulos e não reconhece receita.

## Validação desta execução

Os testes focados de programação, cálculo financeiro, API, componentes,
integração da Central e persistência passaram. Cobrem datas, revisões,
duplicação, concorrência, valor por ciclo, medição parcial, título existente,
etapa fiscal reaberta, seleção do ciclo correto e revogação ou troca de sessão.

Validação local concluída com Node 24.19.0:

| Verificação                                            | Resultado                              |
| ------------------------------------------------------ | -------------------------------------- |
| `npm ci --prefer-offline --no-audit`                   | Instalação reproduzível concluída      |
| `npm run format:check`                                 | Aprovado                               |
| `npm run lint`                                         | Zero erros; 1.246 avisos existentes    |
| `npm run type-check`                                   | Aprovado                               |
| `npm run test:coverage -- --maxWorkers=2`              | 2.836 testes aprovados em 273 arquivos |
| Cobertura de linhas                                    | 72,04% — 15.876 de 22.035 linhas       |
| Cobertura de instruções / ramos / funções              | 70,75% / 65,81% / 65,16%               |
| `NODE_OPTIONS=--max-old-space-size=6144 npm run build` | Aprovado                               |
| `npm audit --omit=dev --audit-level=critical`          | Zero alertas críticos; gate aprovado   |
| `git diff --check`                                     | Aprovado                               |

A auditoria de dependências de produção ainda registra 65 alertas moderados e
5 altos, incluindo dependências transitivas. O resultado do gate de críticos
não equivale à ausência de alertas de segurança. Esta entrega não aplica
atualizações principais indiscriminadas para eliminar esses alertas.

Os testes de regras não foram executados localmente: o ambiente disponibiliza
Java 17, enquanto o workflow Firebase configura Java 21. A verificação de regras
e os checks de CodeQL são conferidos no GitHub antes da integração, conforme
`docs/CI.md`.

No GitHub, o commit `230ac8e8b4d7e2d8ddbc944bb03cbb01699e0fff` passou pelos
workflows [CI](https://github.com/nextcon-nai-git/nai-gcp/actions/runs/39340518744),
[Firebase validation](https://github.com/nextcon-nai-git/nai-gcp/actions/runs/39340518874)
e [Security](https://github.com/nextcon-nai-git/nai-gcp/actions/runs/39340518764).
A versão enviada inclui os últimos casos de regressão: **2.840 testes em 273
arquivos**, além de **167 testes de regras em 12 arquivos**. O check separado de
[CodeQL / GitHub Advanced Security](https://github.com/nextcon-nai-git/nai-gcp/runs/118361028614)
também foi aprovado. A implantação de regras é ignorada no evento de PR;
o sucesso da validação não é comprovação de publicação.

Durante esses checks, a main recebeu o PR #163 (`09346887`), que atualiza os
rótulos e o acesso ao acervo contábil. Essa alteração foi preservada, com ajuste
de formatação do texto para o Prettier. A combinação atualizada deve passar
novamente pelos checks antes do merge do [PR #162](https://github.com/nextcon-nai-git/nai-gcp/pull/162).

A execução combinada também revelou instabilidade no teste de troca de conta
durante a importação de contratos: a espera fixa de 10 ms podia terminar antes
de o `FileReader` iniciar o pedido de credencial. O teste passa a sincronizar
esse evento explicitamente, com uma promessa controlada, antes de trocar a
sessão. As verificações de cancelamento, de não acionar a IA e de não exibir
dados da conta anterior são mantidas; o código de produção não é alterado.

Os testes locais usam dados sintéticos e serviços isolados por mocks. Não houve
criação de cobranças, emissão de documentos fiscais ou envio de mensagens a
clientes para validar esta entrega.

## Publicação e homologação

O lançamento do aplicativo segue o backend App Hosting conectado à main.
Esta entrega não modifica regras ou índices do Firestore e do Storage.
Sucesso nos testes ou merge no GitHub não comprova sucesso do lançamento.

A conferência autenticada deve verificar a presença das duas áreas, abertura do
ciclo selecionado, prévia com dados conferidos, atualização da consulta e
tratamento de falhas. Testes com gravação de ciclos devem usar cadastros
sintéticos em ambiente de homologação. A publicação e essa homologação devem
ser registradas separadamente, com o commit efetivamente lançado.
