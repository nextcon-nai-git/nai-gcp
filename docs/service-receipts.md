# Serviços e recebimentos

A aba **Serviços e recebimentos**, na Central de Contratos e Produção (`/production`),
liga cada ocorrência de uma obrigação contratual aos valores faturados, às baixas
financeiras e aos registros de produção que explicam seu custo declarado.

É a primeira entrega da evolução do contrato ao recebimento por serviço. Reutiliza
os contratos, ciclos, tarefas, títulos, baixas e conciliações existentes no NAI.
Todos os exemplos de testes são sintéticos; a implementação não cadastra dados de
demonstração nem redistribui valores históricos em produção.

## Identificação e uso

Cada linha identifica **registro contratual + ciclo + obrigação**. A mesma obrigação
em competências diferentes é uma ocorrência diferente. O vínculo com contrato
financeiro e CNPJ precisa estar conferido na Central.

1. Abra a nova aba e localize o cliente, contrato, período ou serviço.
2. Abra **Detalhes, evidências e vínculos** para conferir a cláusula, versão,
   responsável e evidência da tarefa. A evidência de entrega do ciclo é identificada
   separadamente; não comprova uma entrega individual inexistente.
3. Em **Distribuir título existente**, escolha um título aprovado do contrato e
   informe o valor que corresponde à tarefa, a evidência e o motivo. Confirme a
   conferência antes de salvar.
4. Em cada distribuição de título, use **Distribuir uma baixa existente** para
   atribuir principal, juros, multa, desconto e retenção a esse serviço.
5. Vincule um registro de produção do ERP quando ele representar o custo do serviço.
   A quantidade original permanece visível. Um registro de duas unidades continua
   agregado; não é convertido em dois ASOs individuais sem evidência.

As ações atribuem valores já existentes. A emissão fiscal, criação de título,
registro da baixa, movimentação bancária e pagamento de prestador continuam nos
respectivos fluxos do ERP. Não há envio de mensagens nem chamada de mutação ao Omie
por esses comandos.

## Distribuição explícita e conservação dos valores

Um título pode ser distribuído entre várias tarefas do mesmo ciclo. Uma tarefa
pode receber parcelas de vários títulos. Cada distribuição de recebimento
referencia a baixa real e a distribuição do título correspondente.

- A soma dos valores distribuídos nunca ultrapassa o valor do título.
- A soma de cada componente distribuído nunca ultrapassa o componente da baixa.
- O principal liquidado por serviço não ultrapassa o faturamento atribuído.
- Desconto e retenção não podem exceder o principal; o saldo restante da baixa
  também precisa ter principal suficiente para seus ajustes restantes.
- A mesma combinação título/ocorrência e baixa/distribuição não pode ser duplicada.
- O título permanece em um único registro e ciclo, preservando a regra existente
  de referência fiscal única por ciclo. Uma NF agrupada entre ciclos diferentes
  exige uma evolução específica do faturamento; não se altera sua referência para
  contornar essa regra.
- Um registro de produção só pode compor o custo de uma ocorrência.
- Valores são inteiros em centavos, com os limites do livro financeiro existente.

Não há rateio proporcional automático. Uma mensalidade pode ter atribuição
gerencial explícita, sem criar outra cobrança. Atribuir o custo de um serviço
incluído na mensalidade não atribui sua receita automaticamente.

## O que os números significam

| Campo                         | Significado                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Faturamento distribuído       | Parte dos títulos aprovada para a ocorrência.                                                       |
| Principal liquidado           | Principal das baixas atribuído, incluindo a parcela liquidada por ajustes.                          |
| Recebido principal registrado | Principal menos desconto e retenção nas baixas atribuídas.                                          |
| Ajustes                       | Desconto e retenção, apresentados sem tratá-los como dinheiro.                                      |
| Caixa registrado              | Principal líquido acrescido dos juros e multas atribuídos.                                          |
| Caixa conciliado              | Caixa atribuído cuja baixa tem associação bancária válida.                                          |
| Saldo sem baixa distribuída   | Faturamento atribuído menos principal liquidado atribuído.                                          |
| Custo declarado               | Quantidade vezes custo unitário dos registros de produção vinculados. Não é pagamento ao prestador. |

O saldo por serviço pode incluir dinheiro já recebido no título e ainda não
distribuído. A tela destaca essa situação e solicita conferência antes de cobrar.
Somente a distribuição integralmente liquidada, sem divergência e com conciliação
válida aparece como **Quitado e conciliado**.

Indicadores da aba somam apenas as distribuições identificáveis e válidas. Eles
não devem ser adicionados aos totais financeiros dos ciclos ou do ERP: são um
detalhamento da mesma origem financeira.

## Histórico, correções e contratos antigos

Valores antigos do ciclo não são divididos por suas tarefas. A tela apresenta
**Sem distribuição** até uma associação explícita ser conferida. Ciclos sem
obrigações estruturadas são contabilizados como sem detalhamento.

Um título já vinculado integralmente a um ciclo pode ser detalhado em tarefas
daquele mesmo ciclo. A reserva legada impede sua distribuição para outro ciclo.
Os fluxos de medição, referência de NF e encerramento da Central são preservados;
as distribuições acrescentam o detalhamento por serviço.

Anule primeiro as distribuições de baixas ainda ativas quando precisar anular a
distribuição de um título. A anulação conserva o histórico. Uma baixa estornada
deixa imediatamente de contribuir para os valores da tela e reabre o saldo,
preservando sua referência histórica. A conciliação é verificada novamente a cada
consulta.

Se uma alteração simultânea remover a tarefa ou tornar um vínculo de custo
indisponível na linha, a seção **Associações que precisam de correção** conserva as
referências para revisão. Ela permite anular as distribuições das baixas, depois
a do título, ou retirar o vínculo de produção. Esses valores não entram nos totais
dos serviços atuais, e a seção não permite criar distribuições para uma origem
ausente.

Replanejamentos e mudanças de origem não podem invalidar silenciosamente tarefas
com valores ou custos atribuídos. Encerrar um ciclo com distribuição exige
resolver saldo e conciliação e conferir sua correspondência com os valores do ciclo.
Períodos financeiros fechados seguem os bloqueios existentes.

## Autorização, concorrência e recuperação

O acesso permanece corporativo financeiro: `SUPER_ADMIN` e `ADMIN` sem tenant.
As consultas e mutações validam o acesso antes do corpo e dos acervos, usam resposta
privada sem cache e não ampliam acesso de clientes ou prestadores.

As três coleções de associações ficam no mesmo livro financeiro dos títulos e
baixas, sob o mesmo compare-and-swap, versão e auditoria. A gravação exige a versão
financeira e a versão da Central usadas na conferência. Repetir uma solicitação
confirmada com o mesmo identificador, conteúdo e autor não duplica registros.

Central e financeiro continuam sendo acervos distintos. Não há transação atômica
entre os dois. Cada distribuição de título e vínculo de custo conserva também a
identificação da origem contratual conferida, incluindo a revisão e a obrigação.
As associações são revalidadas em cada leitura e em mudanças da origem. Se um
replanejamento simultâneo alterar essa origem, os valores ficam em revisão e não
são atribuídos à nova versão da tarefa. Atualizações normais de execução, como
responsável, prazo, checklist e evidência, preservam o vínculo contratual.

A consulta exibe o horário de atualização. Ela não comprova sincronização
automática com SOC ou Omie.

Após erro ambíguo, a interface preserva a solicitação para repetir a confirmação.
Troca de usuário, revogação de acesso e saída da tela cancelam a continuidade local
e descartam respostas tardias. Falha de consulta aparece como erro, não como fila
vazia ou dados atuais.

## Validação

Os testes cobrem título agrupado, múltiplos componentes de baixa parcial, retenções,
limites de um centavo, estorno, conciliação, ausência de distribuição histórica,
origem/CNPJ/competência divergentes, fechamento, concorrência, repetição segura,
respostas tardias e os formulários da nova aba. A homologação com dados reais deve
usar associações conferidas por responsáveis, sem criar movimentação fictícia.
