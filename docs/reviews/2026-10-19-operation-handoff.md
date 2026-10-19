# Revisão da execução das tarefas e confirmação de OS

Complemento da rodada contrato → produção → faturamento → recebimento.

- Perfis internos SUPER_ADMIN, ADMIN e OPERATIONS reconhecem o escopo global de operação mesmo com vínculo à empresa `nextcon`. Administradores vinculados a clientes permanecem restritos; cargos clínicos não recebem leitura global de tarefas por esse ajuste.
- Falhas de consulta são exibidas como indisponibilidade, sem afirmar que não existem tarefas.
- Criação de OS aguarda a confirmação do Firestore, bloqueia duplo acionamento e só anuncia sucesso após a gravação. Em falha, preserva o formulário e orienta conferir o quadro antes de repetir. Troca de sessão impede confirmação tardia na nova conta.
- Data de criação usa timestamp do servidor e registra o usuário. Prazo permanece pendente e foi removido o escore fixo de risco 45, que não tinha evidência.
- Tarefas sem prioridade podem ser salvas sem campos `undefined`. Grau de risco ausente não é substituído por 1; limpar esse campo remove o valor. Cliente permanece no vínculo do documento de origem: o editor não simula uma transferência entre caminhos do Firestore.

Validação dirigida: 19 testes de interface aprovados, incluindo autorização de consultas, escrita pendente/rejeitada, repetição de clique, troca de conta e edição de tarefa legada. TypeScript e lint dos arquivos alterados aprovados. A suíte combinada e os checks remotos são conferidos antes da integração.

Não houve migração de tarefas existentes, gravação real de OS ou envio externo. A criação manual de OS continua sendo uma operação humana; resultado ambíguo exige conferir o quadro antes de repetir. Transferência de tarefas entre clientes precisa de um fluxo próprio e não é executada pelo editor.
