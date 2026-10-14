# DRE Omie e ações financeiras

## Fluxo

1. A direção abre **Financeiro → DRE pelo Omie** (`/financial/omie/dre`).
2. Seleciona início, fim e base de datas: emissão ou registro dos documentos. O padrão vai de janeiro ao último mês encerrado, no fuso de Brasília.
3. O servidor consulta `ListarDRE` no aplicativo Omie já conectado, confere empresa e período e apresenta as contas com os valores originais.
4. A análise agrupa fornecedores e cidades cadastrais em até três meses do período. As sugestões incluem base financeira, fonte e checklist.
5. **Criar cards de ações** salva as propostas em `/financial/actions`. O painel também recebe um arquivo JSON versão 1 com pesquisa, fontes e outras ações revisadas.

O usuário precisa pertencer à administração financeira corporativa: `SUPER_ADMIN` ou `ADMIN` sem tenant. A empresa selecionada no espaço operacional não concede acesso ao financeiro da NEXTCON.

## Origem e limites da análise

O endpoint oficial é `https://app.omie.com.br/api/v1/financas/dre/`, operação `ListarDRE`, parâmetros `dPeriodoInicial`, `dPeriodoFinal` e `cTipoData` (`1` emissão, `2` registro). A especificação pública é a fonte do contrato; títulos a pagar/receber ou vencimentos não substituem a DRE.

- A consulta não modifica lançamentos no Omie.
- Categorias sem conta DRE vinculada podem ficar fora do relatório. Provisões e competência precisam de conciliação contábil.
- Os sinais são preservados. A soma algébrica é identificada como soma das linhas retornadas, sem tratá-la como lucro auditado.
- Os rankings consideram saldo negativo em contas explicitamente classificadas como custo/despesa; valores positivos da mesma classificação compensam estornos. Valores positivos isolados não viram custos por valor absoluto.
- Nome do fornecedor não determina especialidade. Categorias genéricas, pacotes mistos, folha, equipamentos e materiais ficam pendentes de classificação.
- A cidade é a do cadastro do fornecedor. O local do exame exige vínculo com NF e unidade executante; número de lançamentos não é quantidade de exames.
- Linhas iguais são preservadas. Podem representar operações ou rateios legítimos.
- Não há preços alternativos, descontos ou economias presumidos. As sugestões são determinísticas e revisáveis, com base na classificação financeira.
- Resposta vazia, falha na conexão e resposta inválida têm estados distintos. Nenhum dado demonstrativo substitui uma falha.
- O corpo da resposta é limitado a 16 MB antes de interpretar o JSON; consultas maiores pedem um período menor, sem truncar silenciosamente os dados.

## Dados e acesso

As credenciais existentes continuam somente no servidor, em `private-integrations/omie/nextcon.json`. A DRE expõe apenas os campos financeiros necessários. CPF e nomes de pessoas físicas/funcionários identificados pelo retorno são minimizados, com identidade pseudonimizada para agrupamento. Detalhes livres, dados clínicos e bancários extras não são propagados.

Os cards são objetos privados em `financial-actions/v1/{id}.json`, escritos com Firebase Admin. As regras de Storage já negam o acesso direto a esse prefixo. Não se usam tarefas operacionais ou coleções de clientes para armazenar finanças corporativas. Não há URL pública de documento ou token de download.

Toda resposta HTTP usa `Cache-Control: private, no-store`. Revogação de acesso, logout ou troca de usuário removem os dados da interface; respostas antigas não os restauram. O CSV preserva origem/período e neutraliza texto que possa ser interpretado como fórmula.

## APIs de ações

- `GET /api/financial/actions`: lista lotes com `nextCursor`.
- `POST /api/financial/actions`: importa `FinancialActionImportSchema`, até 2 MB e 100 ações. Retorna `{ batch, alreadySaved }`.
- `PATCH /api/financial/actions`: altera somente status e marcações do checklist, exigindo `batchId`, `actionId` e `expectedVersion`. Retorna `{ batch, action }`.

Cada importação tem chave estável. Repetir a mesma análise preserva o andamento; reutilizar a chave com conteúdo diferente recebe `409`. O hash original da importação fica preservado depois de atualizações. A escrita usa precondição de geração do objeto e a API confirma o resultado por nova leitura. Um card só pode ser concluído com os itens obrigatórios marcados.

## Validação e publicação

Os testes usam dados sintéticos e cobrem autorização, sinais, centavos, período, empresa, duplicatas legítimas, CPF, segurança do CSV, limites, idempotência, concorrência e troca de sessão. A DRE real depende de conexão autorizada com Omie e conferência do fechamento pela contabilidade.

O módulo não exige novas regras de Firebase. A publicação das regras exigidas pelo fluxo **NAI importa** é uma dependência própria daquele fluxo, documentada em `docs/nai-importa.md`.

Reversão: remover os links e reverter este módulo preserva os lotes privados já gravados. Não apagar credenciais ou registros financeiros para desfazer a interface.
