# Controle financeiro NEXTCON

Rota `/financial/operacoes`, acessível pela central `/financial`. Esta entrega adiciona um controle gerencial persistente à consulta Omie existente. Não substitui o ERP fiscal, a contabilidade oficial ou os bancos.

## Fluxos implementados

- Títulos a pagar e receber, origem única, evidências, correção de rascunhos e cancelamento sem apagar histórico.
- Parcelamento de 2 a 36 parcelas mensais com distribuição exata dos centavos e ajuste do dia ao fim do mês. A competência permanece a informada no documento; parcelar caixa não altera reconhecimento por competência.
- Aprovação por outro administrador financeiro. O criador não pode aprovar/rejeitar o próprio título. Não foi criado um novo perfil nem ampliada a permissão existente.
- Baixas parciais de movimentações já realizadas, juros, multa, desconto e retenções. Principal liquidado determina residual; caixa considera ajustes. A baixa não executa pagamento bancário nem altera o Omie.
- Competência e caixa independentes: uma competência fechada em setembro pode receber baixa de caixa em outubro aberto. Alterar a competência de título fechado permanece bloqueado.
- Referência Omie conferida por `ConsultarContaReceber`/`ConsultarContaPagar` e nome do cadastro: valor original, vencimento, código e parte devem conferir; nenhuma API de pagamento/baixa/envio é chamada.
- Contratos, reajustes para mensalidades ainda não geradas, faturamento recorrente único por contrato/competência e produção por prestador/município. Produção incluída na mensalidade não gera avulso.
- Extrato CSV com prévia: `id;data;valor;historico`, data ISO, decimal brasileiro, crédito positivo e débito negativo, identificador bancário estável. Limite de 1.000 linhas/512 KB por lote; repetição idêntica é ignorada; conflito preserva a base.
- Conciliação manual assistida: uma ou várias baixas da mesma conta/data somadas exatamente ao movimento. Transferências internas ligam movimentos opostos sem inventar receita/despesa.
- Saldos mensais e orçamento por centro; contribuição por contrato com custos aprovados, custo operacional separado e fluxo por vencimento sobre residual.
- Fechamento gerencial com pendências explícitas e bloqueio de mutações por competência/data de caixa. Reabertura com justificativa. Exportação de títulos CSV protegida contra fórmulas e acervo JSON com histórico.

## Persistência e limites

O acervo corporativo fica em `financial-operations/v1/nextcon.json`, no prefixo protegido pela negação padrão das regras Storage. Somente o servidor autorizado acessa; não há token de download, URL pública ou gravação pelo SDK cliente. A geração do objeto é fixada na leitura e usada como precondição na gravação. Colisão retorna 409, sem sobrescrever. Cada operação tem UUID, hash do conteúdo, identidade obtida da sessão e versão. Uma resposta perdida pode ser repetida com a mesma chave sem duplicação. Não se interpreta falha de leitura como livro vazio.

O limite total é 16 MiB e há limites explícitos por entidade. Não há truncamento silencioso. Particionamento, backup independente e restauração em ambiente isolado ainda são requisitos de escala/continuidade; exportação não é prova de recuperação de desastre.

## Conferências e escopo

A base gerencial começa vazia. Não carrega automaticamente títulos Omie nem transforma valor nominal em residual. Não mistura indicadores das duas fontes. O relatório de resultado contém somente títulos gerenciais aprovados: juros, retenções, tributos e rateios precisam de classificação contábil apropriada; não é uma DRE oficial completa. Custos de produção são declarados na medição e não somados novamente às despesas aprovadas. A contribuição por contrato não é margem líquida enquanto despesas compartilhadas não estiverem atribuídas.

Emissão de NF, Pix/boletos, execução de pagamentos, sincronização bidirecional, cobrança enviada ao cliente, integração bancária automática e homologação contábil de setembro continuam dependendo das integrações/credenciais e da conferência de dados reais. Os controles implementados não anunciam essas ações como realizadas.

## Validação

Testes sintéticos de cálculos, parcelas, aprovação independente, duplicidade, concorrência de armazenamento, competência/caixa, fechamento/reabertura, conciliação, transferências, autorização de API/serviço, limites de payload, erro sem vazamento e descarte de resposta após saída da sessão. Nenhum teste cria cobrança, paga ou altera registros reais no Omie.
