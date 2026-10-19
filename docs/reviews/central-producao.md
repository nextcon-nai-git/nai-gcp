# Central de Contratos e Produção

Entrada: `/production`, também vinculada no menu, em Contratos e em Agentes IA.

## Uso

1. A administração interna cria um registro, seleciona o cliente ativo e informa o CNPJ revisado. Pode preservar um PDF original e solicitar extração assistida. A extração nunca salva contrato nem presume aceite; campos ausentes ficam pendentes.
2. A confirmação cria três cards comerciais e seis cards no ciclo inicial. Cada card contém instrução de trabalho, checklist, responsável, prazo, evidências, bloqueios e histórico. O orçamento e a proposta podem ser marcados não aplicáveis com justificativa para um contrato existente.
3. Antes da formalização, dados pendentes podem ser corrigidos por revisão inicial. Depois de formalizado, alterações comerciais usam aditivo com documento e aprovação. Ciclos anteriores mantêm a versão e os valores originais.
4. Novos serviços/competências criam seis cards e selecionam explicitamente a versão contratual aplicável. A central não cria cobranças nem competências futuras silenciosamente.
5. Medição, NF válida/cobrança e recebimentos conciliados são registrados com evidências distintas. Uma cláusula aprovada pode permitir medição antecipada; o ciclo somente encerra após entrega e quitação. A conclusão de um ciclo não encerra contrato recorrente. Negociações recusadas sem execução ou movimentação financeira podem ser encerradas com justificativa, sem simular conclusão de serviço.
6. O vínculo opcional ao ERP valida contrato ativo e CNPJ do fluxo financeiro. Títulos devem ser recebíveis aprovados do mesmo contrato e valor; recebimentos e ajustes são conferidos contra baixas não estornadas ao salvar e ao encerrar. Juros e multas ficam no ERP, fora do principal do ciclo. Nenhum lançamento é criado ou alterado pela central.
7. A aba Instruções de trabalho contém nove procedimentos v1.2 (entradas, quatro passos, responsáveis, saídas e exceções). A aba Agentes IA oferece NAI Comercial, NAI Operacional e NAI Faturamento, cada qual com contexto cadastrado no servidor e o procedimento da sua etapa.

## Limites explícitos

- A central completa usa a mesma autorização do livro financeiro: SUPER_ADMIN e ADMIN sem tenant. Não amplia acesso de clientes, prestadores ou equipes técnicas a valores e contratos corporativos.
- Valores contratados devem ser positivos ou permanecer pendentes; ciclos gratuitos não são suportados nesta esteira de faturamento. Novos ciclos exigem formalização do contrato.
- Nenhuma mensagem/e-mail é enviada. Os agentes não possuem ferramentas de mutação, emissão fiscal, assinatura, pagamento ou comunicação; respostas são orientações e rascunhos revisáveis.
- Emissão fiscal permanece no emissor habilitado. Registrar uma NF na central não emite nota fiscal, não valida situação no fisco e não cria cobrança no Omie. O responsável deve conferir evidência da autorização fiscal.
- Documentos PDF são enviados à API autenticada da própria central (`PUT /api/production/source`), com limite de streaming inferior a 10 MiB e espera de 60 segundos no navegador. São preservados no namespace imutável existente, por SHA-256 e geração, com criação exclusiva e releitura integral antes da confirmação. Repetir o mesmo PDF reaproveita a fonte verificada, sem substituir o original. Outros formatos devem ser convertidos em PDF. Assinaturas não são validadas pela IA.
- Não há migração automática do histórico do onboarding antigo. Cadastre contratos existentes na central, vincule o mesmo cliente/ERP e justifique etapas anteriores sem duplicar lançamentos financeiros.
- Aditivos afetam novos ciclos selecionados explicitamente. Ciclos ainda não iniciados e sem movimentação podem ser replanejados mediante aprovação; a autorização antiga de antecipação é removida. Trabalho ou faturamento anteriores não são reescritos. Correções financeiras exigem reabrir cards dependentes, preservando auditoria.

## Persistência e validação

Acervo privado em `financial-operations/v1/production-central.json`, namespace já negado aos SDKs clientes pelas regras Storage. API autenticada em `/api/production`, com autorização antes de ler corpo ou dados; respostas privadas sem cache; comandos limitados a 256 KiB. Gravação usa compare-and-swap por geração, chave idempotente, hash da operação, ator e leitura de confirmação. Falha de leitura nunca recria um acervo vazio. Limites explícitos: 1.000 registros, 200 ciclos por registro, 100 documentos/versões, 20.000 eventos e 16 MiB por acervo; requer particionamento ao atingir limites.

Testes cobrem ciclo completo, antecipação, pendências, duplicidade, imutabilidade dos aditivos, autorização, integridade do PDF, concorrência, replay, divergência do ERP, agentes sem ações externas e recuperação da interface após falha ambígua. A execução real dos agentes depende da configuração Genkit/Gemini do ambiente; testes automatizados não substituem uma consulta real homologada.

## Obrigações contratuais por serviço — 18/10/2026

A extração assistida agora propõe até 100 obrigações individuais, com tipo de serviço (PGR, PCMSO, ASO, LTCAT, AET, AEP, perícia ou outro), título de tarefa, página/cláusula e trecho da fonte. A prévia permite corrigir, adicionar ou remover itens antes da confirmação. Responsáveis não expressos e datas não inequívocas ficam pendentes; regras relativas e frequência são preservadas como texto para programação humana.

O ciclo inicial recebe uma tarefa por obrigação aprovada, além das nove etapas gerais. O valor contratado permanece no ciclo e não é multiplicado pela quantidade de serviços. Cada tarefa tem responsável, prazo programado, checklist, bloqueio e evidência de execução/revisão técnica. Serviços condicionais preservam o evento de acionamento; somente quando essa condição está registrada é permitido justificar que não se aplica ao ciclo, com responsável e evidência. A execução depende da formalização e mobilização; concluir produção, entrega ou recebimento exige concluir todas as tarefas selecionadas. Antecipação financeira não dispensa entrega nem quitação.

Ciclos adicionais e replanejamentos exigem seleção explícita das obrigações da versão aplicável. As datas programadas são definidas para o novo ciclo: não há repetição automática de obrigação pontual nem cálculo presumido de datas relativas. Aditivos mantêm os ciclos anteriores; a prévia de nova versão deve ser consolidada pelo responsável. Tarefas já atualizadas não são apagadas por revisão inicial ou replanejamento. Reabrir tarefas após conclusão da produção exige reabrir as etapas dependentes, com auditoria.

Na extração de aditivos, a lista vigente permanece intacta mesmo quando o documento não contém serviços ou só altera parte deles. Sugestões ficam separadas: o revisor edita a obrigação existente ou adiciona um novo serviço com identificador próprio. Nenhuma sugestão substitui automaticamente a lista vigente. Extração e persistência compartilham a validação de identificadores únicos; respostas da IA com IDs repetidos são rejeitadas antes da prévia.

Registros anteriores continuam legíveis, com listas vazias quando não há obrigações estruturadas. Não é inferido um plano a partir de texto histórico sem revisão. Os cards controlam o trabalho e suas referências: não criam documentos técnicos, ASOs, notas fiscais ou mensagens automaticamente. O envio permanece sujeito à autorização expressa do usuário.

## Fila de prioridades e conferência financeira — 19/10/2026 UTC

A esteira exibe cards e obrigações abertos de contratos ativos, com filtros de etapa, atraso, bloqueio e falta de responsável/prazo. A busca aceita responsável, tarefa, cliente e CNPJ formatado. Datas usam o dia de Brasília; prazo ausente não é classificado como vencido. Os indicadores podem se sobrepor e não devem ser somados. A lista é paginada em grupos de 20, com abertura do contrato/ciclo correspondente. Ela não inventa responsáveis nem agenda datas.

**Consultar contratos e títulos do ERP** mostra uma conferência por ciclo: sem vínculo, divergente, pendente ou quitado e conciliado. A conferência usa as baixas não estornadas e valida os vínculos com movimentos de extrato não anulados: mesma conta/data, total de caixa correspondente, sem uso duplicado de uma baixa. O caixa bancário inclui juros e multas; o recebido principal da central não os inclui. Retenções/descontos ficam separados do recebido e do saldo.

Um título vinculado é revalidado ao salvar valores, concluir o card de NF, encerrar o ciclo e encerrar o contrato. Encerramento exige conciliação das baixas vinculadas; registrar a baixa por si só não basta. Os ciclos sem título continuam sujeitos à conferência manual documentada e nunca são apresentados como conciliados automaticamente. A tela mostra um retrato da consulta, não sincronização permanente: alterações posteriores no ERP exigem nova conferência. Os dois acervos não possuem transação atômica conjunta.

Iniciar uma etapa exige os mesmos predecessores operacionais usados para a conclusão, preservada a antecipação contratual expressa. Etapas em execução também bloqueiam reabertura de predecessores. Referências de NF vazias/espaços são recusadas; duplicidades são comparadas sem diferença de caixa ou espaços repetidos. O identificador deve incluir emissor/série/número; não há validação fiscal externa.

Ao mudar de ciclo, o formulário financeiro é recriado com os valores daquele ciclo. Troca de conta, saída da tela e descarte do formulário cancelam requisições pendentes da central e impedem a continuação depois de autenticação/hash tardios. Uma consulta inicial atrasada não sobrescreve uma atualização mais recente. Acesso revogado informado pelo servidor limpa os dados carregados. Requisições já recebidas pelo servidor não são desfeitas pelo cancelamento no navegador; repetição permanece idempotente. A confirmação final de gravação exige encontrar a operação e seu ator/hash no histórico relido.
