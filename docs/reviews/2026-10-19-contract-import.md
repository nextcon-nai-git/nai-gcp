# Revisão da entrada de contratos e passagem para o SGI

Rodada autorizada de revisão de ponta a ponta do ERP. Complementa a revisão da Central de Contratos e Produção.

## Correções e resultado

- O conteúdo extraído aparece antes da confirmação: cliente/CNPJ, resumo, obrigações, tarefas, frequência e checklists. Erros devem ser corrigidos na Central antes de salvar uma esteira; esta tela preserva a integração legada do SGI.
- Seleção explícita de cliente existente e ativo, conferência do CNPJ e confirmação humana. Mudar o cliente invalida a confirmação. Cadastros com `deletedAt` também são recusados na transação.
- A tela aguarda o perfil autorizado antes de consultar o acervo. Mudança de usuário, papel ou vínculo desmonta a sessão, limpa o dossiê e cancela continuação de operações. Resultado tardio não produz confirmação na nova sessão.
- Lotes limitados a cinco PDFs e processados em sequência. Erros e cancelamentos do leitor de arquivo encerram o estado de processamento. Bloqueio local evita duplo acionamento da integração.
- Acervo limitado aos 200 registros mais recentes, com indicação de que a busca cobre esse recorte. Falhas de consulta aparecem como falha, não como ausência de contratos. Diretório limitado a 1.000 clientes; integração fica indisponível se excedido, até haver paginação.
- Tarefas importadas conservam checklist e periodicidade revisados. `dueDate` vazio torna as novas tarefas elegíveis para as consultas ordenadas do SGI sem inventar prazo. Prioridade ausente aparece como pendente no Kanban.
- Regra explícita de leitura do grupo `contracts` exclusivamente para equipe interna e índice de grupo em `createdAt` descendente, necessários para a consulta do acervo. Não há concessão global de leitura a clientes nem de escrita.

## Defeitos reproduzidos

O teste de renderização do Kanban falhava com `toUpperCase` em uma prioridade ausente. O teste de integração comprovou que checklist e periodicidade não eram transferidos para a tarefa. Ambos passaram após as correções. No emulador, a consulta de grupo do acervo também falhou com `No matching allow statements` usando as regras anteriores; a nova permissão é testada para equipe interna, cliente e sessão anônima.

## Revisão automática e ajustes finais

- O editor omite prioridade pendente até uma definição humana, evitando `undefined` no Firestore. Esta correção é coberta pela revisão de passagem para operação.
- A persistência usa nome, razão social legada ou ID do cliente, sem perder a identificação exibida no seletor.
- Busca no acervo e na central normaliza CNPJ alfanumérico formatado, mantendo letras e dígitos.
- Uma negativa de autorização do Firestore retira imediatamente o dossiê e a fila da tela e cancela continuações locais.
- A consulta do acervo passou no emulador após a correção. A suíte completa de regras passou no CI do primeiro commit do PR #160; uma execução local ampla sofreu falha do runtime Java e não é contada como aprovação.

## Validação e limites

- 30 testes dirigidos de importação, integridade/cancelamento e compatibilidade do Kanban aprovados. A suíte completa deste lote sobre a base anterior ao PR #159 aprovou 2.656 testes, com 70,85% de cobertura de linhas (15.137/21.364). A combinação final com o PR #159 passa novamente pelos checks antes do merge.
- TypeScript aprovado. Validação completa, emuladores e build são conferidos antes da integração.
- As regras e os índices precisam de publicação própria, distinta da publicação do aplicativo; a configuração de credenciais de produção continua sendo um requisito dessa etapa.
- Nenhum dado real, cadastro de empresa ou tarefa existente é migrado. Tarefas legadas sem `dueDate` continuam precisando de revisão de dados para entrar em consultas ordenadas por prazo.
- Cancelar uma sessão impede a continuação local; não desfaz uma gravação já aceita pelo servidor. A origem do PDF mantém identidade estável para repetir uma confirmação sem duplicação.
- Nenhuma consulta autenticada à produção foi realizada nesta sessão, que está sem login no navegador. Testes usam dados sintéticos e não enviam mensagens nem geram cobrança, nota fiscal ou pagamento.
