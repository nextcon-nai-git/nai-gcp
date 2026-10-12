# ERP financeiro gerencial NAI

Evolução do controle publicado no PR #94, na mesma rota `/financial/operacoes` e no mesmo acervo privado. Entrada direta no menu **ERP financeiro** e pela central financeira. Não cria base paralela nem executa transações externas.

## Fluxo integrado

1. Cadastrar clientes/fornecedores, contas gerenciais de receita/despesa e centros de custo. Cadastros podem ser corrigidos ou inativados; códigos e identificação normalizada não podem ser duplicados. CPF/CNPJ informado é referência declarada, não validação cadastral oficial.
2. Criar pedido de compra ou venda com itens, quantidades inteiras, valores em centavos, desconto, competência, vencimento e evidência. O total é calculado no servidor. Natureza da conta e perfil da parte devem corresponder ao pedido. Número único por carteira, inclusive após cancelamento.
3. Enviar para aprovação. Outro administrador financeiro aprova ou devolve. Só o criador corrige pedidos em rascunho/devolvidos; a correção retorna para rascunho.
4. Converter pedido aprovado em um único título em rascunho. O pedido conserva as descrições dos cadastros aprovadas na origem e a ligação ao título. A conversão não emite NF, boleto ou Pix e não transmite pedido ao fornecedor.
5. Aprovar o título pelo fluxo financeiro existente, registrar o pagamento/recebimento já realizado e conciliar o extrato. O criador do título não pode aprová-lo. Valores/classificação do título de pedido são imutáveis: para corrigir, cancelar e criar pedido novo. Cancelar um título sem baixas ativas cancela também o pedido, preservando documentos e trilha. Baixas ativas exigem estorno antes do cancelamento.
6. Registrar contatos e promessas dos recebíveis aprovados. As tratativas são internas e não enviam mensagens, alteram vencimentos ou confirmam liquidação.

Contratos recorrentes, produção SST, baixas parciais, importação CSV de extratos, conciliação, orçamento e fechamento da entrega anterior continuam disponíveis. Pedidos pendentes bloqueiam o fechamento da competência. Acompanhamento de contatos não altera valores e pode ser registrado após fechamento.

## Relatórios

- Vencimentos: saldo residual **atual** dos títulos aprovados, em todas as competências, dividido em a vencer, hoje, 1–30, 31–60, 61–90 e mais de 90 dias. Não permite apresentar saldo atual como posição retroativa.
- Resultado por categoria: valores originais aprovados na competência selecionada, separados por receita/despesa; títulos cancelados não compõem o resultado. Não é DRE contábil oficial. Tributos, provisões, depreciação e demais ajustes precisam de lançamentos e validação contábil.
- Movimento de caixa: baixas não estornadas por data efetiva e com seus ajustes de juros/desconto/retenção. Não representa saldo bancário nem inclui transferências internas como resultado.
- Exportações CSV com proteção contra fórmulas; colunas numéricas dos relatórios usam centavos explicitamente identificados. Exportação integral JSON inclui cadastros, pedidos, tratativas e auditoria.

## Compatibilidade e segurança

`erp` é uma extensão aditiva do schema existente, com listas vazias padrão quando ausente. A leitura de um livro anterior conserva versão e histórico e não grava uma migração silenciosa. As gravações usam a mesma autorização corporativa, validação Zod, limite de payload, chave idempotente, controle de versão e precondição de geração Storage. Não foram abertas regras cliente, criados perfis ou ampliadas permissões. Todos os comandos registram ator, conteúdo, justificativa e versão.

Os cadastros ERP são financeiros corporativos; não sincronizam automaticamente pacientes, empregadores, Omie ou fornecedores externos. Alterar um cadastro não reclassifica o histórico. Quantidades fracionárias, estoque, tributos automáticos, documentos fiscais, multiempresa, alçadas por valor e aprovações por departamentos não fazem parte desta versão.

## Limites de implantação

Livro corporativo com limite de 16 MiB; essa persistência é adequada somente ao limite explicitamente validado. A evolução para grande volume exige particionamento/transações em banco, paginação, backup independente e teste de restauração. Esta entrega não alega capacidade ilimitada, recuperação de desastre ou equivalência integral a Omie/Conta Azul.

Conectores transacionais bancários, emissão fiscal, sincronização bidirecional Omie, certificados e homologação de dados reais continuam pendentes. Não cadastrar dados fictícios em produção. Os testes automatizados usam dados sintéticos locais; implantação não equivale à homologação operacional da empresa.
