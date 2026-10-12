# Contrato ao recebimento

A aba **Contrato ao recebimento** do ERP financeiro conecta os registros locais
já existentes de pedidos de venda, contratos, serviços, títulos e baixas.

## Fluxo disponível

1. Cadastre o orçamento como pedido de venda em **Compras e vendas**. A aprovação
   continua exigindo outro administrador financeiro.
2. Na aba nova, selecione o pedido aprovado e confirme explicitamente que o total
   é a mensalidade fixa. Registre referência do aceite, responsável, prazo de
   implantação, vencimento e se a mensalidade depende da implantação concluída.
   O sistema cria um contrato vinculado; não cria um título nessa etapa.
3. Confira dados/unidades, escopo, equipe/rede e cronograma, com justificativa.
   A produção só é liberada após todos os itens conferidos.
4. Registre serviços na **Produção SST**. Um segundo administrador confere a
   evidência antes de liberar cobrança avulsa. Serviços incluídos na mensalidade
   não geram uma segunda cobrança.
5. Revise a competência e gere a mensalidade ou serviço em rascunho. A aprovação
   financeira já existente continua obrigatória antes das baixas e exportações.
6. Em **Pagar e receber**, aprove e registre recebimentos. O painel do contrato
   calcula saldo principal e caixa separadamente, considerando baixas parciais,
   retenções, juros, descontos e estornos. Conciliação permanece na aba bancária.

## Controles

O mesmo pedido só origina um contrato e não pode também ser convertido em título
pelo fluxo antigo. Mensalidades usam a chave contrato/competência e serviços usam
seu identificador. A persistência compartilha o livro financeiro existente,
versionamento, auditoria, repetição idempotente e gravação CAS no servidor.
Acesso continua restrito à administração financeira corporativa.

O preço do contrato integrado não pode ser editado diretamente. Um fluxo de
aditivos ainda deve ser implementado. Desativar o contrato bloqueia novas etapas.
Checklist e referências são conferências registradas por pessoas; não representam
validação automática de documentos, assinatura eletrônica ou execução clínica.

## Limites explícitos

- Esta entrega atende contratos de mensalidade fixa com serviços avulsos. Não
  implementa preço por vida, faixas, pró-rata, reajustes ou medição automática.
- Contratos anteriores preservam suas regras e aparecem identificados como fora
  do fluxo integrado. Não há migração automática dos contratos ou dados do Omie.
- O bloqueio de duplicidade é local ao controle NAI. Cobranças prévias no Omie
  precisam ser conferidas e vinculadas antes de gerar/exportar novos títulos.
- A conferência operacional é manual e usa a Produção SST financeira; não há
  captura automática de conclusão nos agendamentos, ASOs ou visitas.
- Geração de rascunho não emite NFS-e nem envia e-mail ou cobrança. A emissão
  permanece no Omie. Retornos bancários e baixas Omie não sincronizam sozinhos.
- A diferença entre receita prevista e custos de serviços é estimativa, sem
  impostos e despesas indiretas. Não equivale a margem líquida realizada.
- Valores recebidos no painel pertencem aos títulos da competência selecionada,
  inclusive quando a baixa ocorre em outro mês; não são fluxo de caixa mensal.

Testes cobrem aprovação, checklist, segregação da revisão, duplicidade,
repetição de pedidos, competência anterior ao aceite, serviços incluídos,
recebimento parcial, retenção, estorno e compatibilidade com livros anteriores.
Não são criados registros sintéticos no ambiente de produção.
