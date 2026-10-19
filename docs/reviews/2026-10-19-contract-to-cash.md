# Revisão da esteira contrato → recebimento

Base: `60f63e048f9a8428cf062f36016d87537d8576f2` (PR #158). Rodada autorizada pelo usuário em 18/10/2026, às 23h33 de Brasília. Escopo: central de contratos e produção, autorização de requisições e ligação com o ERP. Alterações locais anteriores da revisão de 80% foram preservadas em sua cópia original.

## Defeitos reproduzidos antes da correção

- Encerramento de ciclo com baixa no ERP sem conciliação no extrato. O novo teste falhava porque a operação era aceita; após a correção, conta/data/valor precisam corresponder a um movimento bancário válido.
- Referência de NF contendo apenas espaços aceita pelo modelo. Duplicidades com diferença de caixa/espaços também passam a ser identificadas.
- Início de mobilização sem formalização e início de produção/faturamento sem predecessor concluído. A reabertura de implantação também ignorava produção em andamento.
- Formulário financeiro conservava uma edição de outro ciclo: no teste, o valor editado `999` permanecia ao selecionar um ciclo cujo valor correto era `100`. A identidade do formulário agora acompanha o ciclo.

## Melhorias

- Fila de prioridades com filtros e indicadores derivados dos registros, sem prazo ou responsável presumido.
- Conferência financeira explícita por ciclo, separando recebido principal, retenções/descontos, caixa com juros e saldo. Estorno, título incompatível/cancelado e conciliação desfeita deixam pendência visível.
- Cancelamento de requisições ao descartar componentes, verificação da sessão após obter credencial e descarte de consultas ultrapassadas. Uma credencial tardia não inicia gravação na sessão abandonada.
- Conferência de autorização antes de ler corpos ou acervos, limites de entrada, erros privados e limpeza dos dados após revogação de acesso.
- Instrução de trabalho de recebimento atualizada para v1.2. Os agentes permanecem consultivos, sem ações externas.

## Validação

Testes usam registros sintéticos e substitutos de Firestore/Storage/ERP; nenhuma mensagem, nota fiscal, cobrança, pagamento ou registro real foi criado para testar.

- Suíte completa: **2.680 testes aprovados em 265 arquivos** (45 testes adicionais).
- Cobertura de linhas: **70,75%** (15.171/21.443); instruções 69,45%, ramos 64,43%, funções 63,59%. Nenhuma fonte foi excluída para elevar a medição.
- TypeScript e Prettier aprovados. ESLint dos arquivos alterados sem erros ou avisos; avisos legados continuam no restante do projeto.
- Build local e checks remotos do commit final são conferidos antes da integração. Publicação do aplicativo é verificada separadamente.

## Ajustes após revisão automática

- Respostas 401/403 de finanças, assistentes, extração e upload também apagam o acervo em tela, mesmo quando a negativa não contém JSON. Requisições pendentes são canceladas; uma atualização explícita pode revalidar o acesso.
- Prioridades acompanham a virada da data de Brasília sem recarregar a página e são reavaliadas quando a aba recupera foco/visibilidade.
- Seis regressões adicionais cobrem esses casos; 21 testes da interface da central aprovados após os ajustes. A medição completa acima corresponde à primeira validação desta rodada.

## Limites

- Consulta do ERP é um retrato; não é conciliação bancária automática nem consulta fiscal. Os acervos da central e do ERP continuam separados, sem transação atômica entre eles.
- Ciclos manuais sem título vinculado exigem evidência humana. Nenhuma migração de contratos, baixa automática ou correção de valores existentes é executada.
- A validação autenticada da interface publicada depende de login no navegador desta sessão; a página protegida redirecionou corretamente para login.
- Regras/índices e credenciais Firebase não foram alterados. Sua publicação separada mantém a pendência já documentada nas rodadas anteriores.
- Cobertura automatizada não representa percentual de conclusão do ERP ou revisão manual integral.
