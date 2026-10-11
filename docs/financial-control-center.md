# Central financeira Nextcon

`/financial` apresenta a agenda de títulos em aberto do Omie, com carteiras separadas de contas a pagar e a receber. A consulta é iniciada pelo usuário e utiliza a integração e a autorização financeira existentes. Não há gravação de títulos, baixa, transferência ou pagamento nesta central.

## Leitura dos indicadores

- Valores expressos em reais e somados em centavos, a partir do valor original do documento. Não representam saldo após baixas parciais nem caixa disponível.
- Vencimentos calculados pelo dia de referência em Brasília, indicado na tela. Vencidos, hoje, próximos 7 dias, de 8 a 30 dias e após 30 dias são faixas mutuamente exclusivas.
- Cada carteira consulta até 20 páginas de 50 títulos. Limite atingido, duplicidade ou mudança da paginação deixam a cobertura explicitamente parcial. Não há deduplicação entre pagar e receber.
- Erro de consulta não vira saldo zero. Uma carteira indisponível não impede consultar a outra. Atualizações removem o resultado anterior enquanto a nova consulta está em curso.
- Datas inválidas e valores negativos/não finitos são separados para conferência e excluídos dos indicadores. Nenhuma data é preenchida por suposição.
- Busca, filtro por vencimento e exportação CSV operam sobre a carteira consultada. O arquivo inclui valores originais e proteção contra fórmulas em campos textuais. Exportação de base parcial recebe sufixo no nome.

## Navegação

O acervo anterior permanece em `/financial/faturamento`, com ligação de volta à central. DRE, balanço, livro diário, ações e faturamento mensal continuam nas rotas existentes. A nova tela usa fundo azul escuro e texto claro.

## Limites da entrega

Conciliação bancária automática, saldo residual por título, previsão líquida de caixa e margem por contrato exigem fontes adicionais e validação contábil. A central não calcula essas métricas a partir do valor nominal dos títulos. O filtro de títulos em aberto mantém o contrato da integração Omie já existente.

## Verificação

Testes sintéticos cobrem centavos, datas, virada de dia em Brasília, fronteiras das faixas, paginação completa/parcial, duplicidades, interrupção, CSV, falha isolada de carteira e descarte de respostas após troca de sessão. Não usam registros financeiros reais ou credenciais de produção.
