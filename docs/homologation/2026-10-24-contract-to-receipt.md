# Homologação do contrato ao recebimento

Rodada de 24 de outubro de 2026. Base funcional: `3dbd7eb` (PR #192).
O objetivo desta rodada é comprovar a integração lógica entre a Central e o ERP
sem concluir exames, emitir NF, gerar cobrança externa ou enviar mensagens reais.

## Escopo e limites da evidência

Os três cenários novos usam `saveProductionCommand`, preservação e leitura de
fonte, esquemas e comandos financeiros reais. Armazenamento, cadastro e leitura
do livro financeiro são substituídos por adaptadores em memória. Todos os registros
são sintéticos. Não há acesso a Firebase, SOC, Omie, bancos ou serviços de envio
nesses testes. A fonte PDF testa preservação e integridade de bytes, não assinatura
ou validade documental. A referência de NF é fictícia e não corresponde a emissão.

Isso comprova regras de serviço e domínio; não constitui homologação do navegador,
do armazenamento real, dos provedores externos ou da operação de produção.

## Roteiro integrado automatizado

Arquivo: `src/services/production-central.test.ts`, grupo
`homologação sintética integrada do contrato ao recebimento`.

| Passagem                        | Verificação realizada                                                                                        | Resultado na execução direcionada        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Proposta e contrato financeiro  | Pedido submetido e aprovado por outro operador; criação do contrato sem título automático                    | Aprovado                                 |
| Upload e cadastro da Central    | Fonte preservada, cliente conferido e obrigação contratual gerada                                            | Aprovado com adaptadores em memória      |
| Formalização e implantação      | Nove cards percorridos por comandos; mensalidade bloqueada antes da implantação                              | Aprovado                                 |
| Execução e revisão              | Produção bloqueada enquanto a tarefa contratual está incompleta                                              | Aprovado                                 |
| Serviço incluído na mensalidade | Segunda revisão e rejeição de cobrança avulsa duplicada                                                      | Aprovado                                 |
| Medição e título                | Mensalidade única, aprovação do título e vínculo ao contrato da Central                                      | Aprovado                                 |
| Registro fiscal                 | Medição e referência fictícia de NF registradas, sem emissão externa                                         | Aprovado no domínio; emissor não testado |
| Pagamento parcial               | Baixa de R$ 40 e conciliação; encerramento rejeitado, sem alteração persistida                               | Aprovado                                 |
| Quitação com ajuste             | Baixa residual de R$ 60, com R$ 10 de retenção sintética e R$ 2 de juros; fechamento bloqueado até conciliar | Aprovado                                 |
| Conciliação final               | Principal líquido de R$ 90, ajuste de R$ 10, caixa de R$ 92 e saldo zero para título de R$ 100               | Aprovado                                 |
| Encerramento do ciclo           | Nove cards e uma tarefa concluídos; contrato recorrente permanece ativo                                      | Aprovado                                 |
| Estorno posterior               | Exige desfazer conciliação; depois do estorno o vínculo fica divergente e impede encerrar contrato           | Aprovado                                 |
| Repetição e concorrência        | Repetição do comando confirmado não grava novamente; nova operação com versão antiga recebe 409              | Aprovado                                 |
| Histórico                       | Fonte e eventos anteriores preservados; tentativas rejeitadas não alteram o livro                            | Aprovado                                 |

Executar:

```sh
npx vitest run src/services/production-central.test.ts
npm run test:run
npm run type-check
npm run format:check
npm run lint
```

A execução direcionada aprovou 25 testes, incluindo os três cenários novos.
A suíte geral local aprovou 2.966 testes em 290 arquivos. TypeScript, formatação e
lint passaram sem erros (avisos preexistentes). O build de produção não foi repetido
localmente nesta rodada de testes e documentação; os checks do PR são evidência
separada e devem ser associados ao SHA testado.

## Evidências de produção

A tentativa de abrir `/production` no navegador redirecionou para `/login`.
Não houve acesso autenticado aos cards nesta rodada até esse ponto.
As consultas HTTP sem autenticação a `/api/production`, `/api/production/finance`
e `/api/clients/grupo-avp/workflow` retornaram 401. Isso comprova rejeição desse
acesso, não isolamento entre dois clientes ou correção dos dados reais.

A opção Google foi selecionada no acesso seguro e abriu a seleção de conta. Não
há confirmação de sessão autenticada até este registro; os cenários de navegador
abaixo continuam pendentes.

## Portas ainda abertas para homologação operacional

| ID  | O que executar                                                                          | Responsável                     | Evidência necessária para fechar                                                       |
| --- | --------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| H01 | Entrar com perfil interno autorizado e abrir Central, guia e cards                      | Administrador interno           | Tela carregada, versão publicada e perfil confirmados                                  |
| H02 | Percorrer contrato sintético no ambiente de homologação                                 | Comercial e Operações           | Upload real, extração conferida, responsáveis, prazos e histórico                      |
| H03 | Testar duas sessões editando o mesmo registro                                           | Operações                       | Um salvamento aceito e conflito explícito na outra sessão, sem perda de histórico      |
| H04 | Validar periódicos AVP em ambiente isolado, incluindo correção de pedido e troca de PDF | Equipe AVP                      | Vínculos corretos e invalidação da revisão/entrega antiga, sem envio de ASOs           |
| H05 | Homologar emissão fiscal e cobrança no ambiente de testes do emissor                    | Financeiro e responsável fiscal | Autorização/rejeição/cancelamento e vínculos comprovados; nenhuma NF real nesta rodada |
| H06 | Homologar retorno de baixa e conciliação com conectores de testes                       | Financeiro                      | Parcial, retenção, duplicidade, estorno e saldo final conferidos                       |
| H07 | Verificar papéis interno, cliente, clínica e médico com contas de teste                 | Administração                   | Leitura/escrita permitidas e negadas conforme papel, sem ampliar permissões            |
| H08 | Ensaiar recuperação de backup e indisponibilidade das integrações                       | Administração técnica           | Restauração verificada, tempo medido e procedimento de recuperação                     |
| H09 | Treinar operadores e revisar cadastros                                                  | Gestor de cada área             | Execução acompanhada, pendências atribuídas e aceite operacional                       |

H01 a H09 continuam pendentes de evidência operacional. Não usar dados de clientes
reais como massa descartável. Não registrar assinatura, exame realizado ou entrega
por inferência. Não criar cobranças externas nem enviar mensagens para testar telas.

## Critério de conclusão

Considerar um fluxo homologado somente após registrar ambiente, versão, cenário,
perfil, resultado observado, evidência e revisor. Bloqueios e cenários não executados
permanecem abertos. O sucesso dos testes automatizados não autoriza declarar o
sistema inteiro como 100 por cento concluído.
