# Livro Diário

A rota `/financial/livro-diario` pertence ao Financeiro e lê o acervo contábil interno. Usa a sessão existente do NAI e exige SUPER_ADMIN ou ADMIN sem tenant. O cliente selecionado na navegação operacional não altera o escopo deste acervo corporativo.

## Importação e origem

O extrator `scripts/finance/extract-sped-ledger.py` aceita o layout paisagem do Livro Diário SPED, 792 × 612 pontos, com oito colunas. Requer Python e pdfplumber. Executar com caminhos fora do repositório:

```bash
python scripts/finance/extract-sped-ledger.py /caminho/privado/livro.pdf /caminho/privado/livro.nai.json
```

A extração usa limites de células, recupera continuações entre páginas e exige que o número de registros de cada página corresponda aos marcadores D/C do PDF. O formato NAI guarda cada partida com data, conta, nome, centro de custo, histórico, lançamento, centavos inteiros e páginas inicial/final. Importe o JSON e o PDF original pelo formulário do módulo. PDFs e extrações contábeis reais não devem ser versionados no Git.

## Persistência e autorização

As APIs `/api/financial/ledger` e `/api/financial/ledger/[id]` verificam a sessão e a autorização no servidor. O acervo fica no bucket já configurado, no prefixo `financial-ledgers/v1/`, negado pelas regras atuais de Storage para acesso direto pelo cliente. Não são emitidas URLs públicas nem tokens de download. O PDF é disponibilizado por resposta autenticada com `Cache-Control: private, no-store`.

O hash do PDF é verificado antes da gravação. Gravações usam precondição de geração zero: reimportações idênticas são idempotentes; uma extração diferente para o mesmo documento não substitui a existente. O PDF é gravado antes do JSON; a listagem considera apenas livros com JSON finalizado. O Admin SDK precisa das permissões já utilizadas pelo sistema para listar, ler e gravar objetos no bucket.

## Interpretação

Débitos e créditos são movimentações contábeis, não receitas/despesas nem fluxo de caixa. O razão exibe o saldo da movimentação D − C, sem saldo de abertura. A conferência agrupa por data e número de lançamento e verifica todas as contrapartidas, incluindo lançamentos compostos. Os destaques são cálculos determinísticos, não pareceres ou inferências de IA. Os filtros afetam indicadores, tabelas e CSV; a conferência e os destaques globais são explicitamente identificados como referentes ao livro completo.

## Validação

Os testes em `src/lib/financial/ledger.test.ts`, `src/services/financial-ledger.test.ts` e `src/app/api/financial/ledger/route.test.ts` verificam cálculos, validação de origem, acesso, duplicidades, preservação de versões e exportação CSV. O financeiro consulta contratos pela API autenticada e com escopo autorizado, evitando a consulta collectionGroup negada ao navegador.

## Rankings de recebimentos e saídas

A visão geral apresenta os dez maiores recebimentos de clientes e as dez maiores saídas, com data, histórico, valor, classificação original e acesso ao lançamento completo/PDF. O filtro de fornecedores e prestadores restringe as saídas conforme as contas contábeis. Cada posição representa um lançamento, não um total por participante.

O cálculo recompõe cada lançamento completo e usa o movimento líquido das contas do grupo 1.1.01 (caixa/bancos). Entradas exigem contrapartidas a crédito em Clientes (grupo 1.1.02); provisões de receita, empréstimos recebidos e transferências internas não entram no ranking de clientes. Contrapartidas mistas, diferenças contábeis e recebimentos cujo histórico informa o CNPJ da própria empresa ficam numa lista de conferência, sem atribuição automática. Identificadores numéricos e cobranças sem nome são apresentados como identificação pendente. Os filtros selecionam lançamentos elegíveis, preservando o valor de todas as contrapartidas.
