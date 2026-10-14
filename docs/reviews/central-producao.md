# Central de Contratos e Produção

Entrada: `/production`, também vinculada no menu, em Contratos e em Agentes IA.

## Uso

1. A administração interna cria um registro, seleciona o cliente ativo e informa o CNPJ revisado. Pode preservar um PDF original e solicitar extração assistida. A extração nunca salva contrato nem presume aceite; campos ausentes ficam pendentes.
2. A confirmação cria três cards comerciais e seis cards no ciclo inicial. Cada card contém instrução de trabalho, checklist, responsável, prazo, evidências, bloqueios e histórico. O orçamento e a proposta podem ser marcados não aplicáveis com justificativa para um contrato existente.
3. Antes da formalização, dados pendentes podem ser corrigidos por revisão inicial. Depois de formalizado, alterações comerciais usam aditivo com documento e aprovação. Ciclos anteriores mantêm a versão e os valores originais.
4. Novos serviços/competências criam seis cards e selecionam explicitamente a versão contratual aplicável. A central não cria cobranças nem competências futuras silenciosamente.
5. Medição, NF válida/cobrança e recebimentos conciliados são registrados com evidências distintas. Uma cláusula aprovada pode permitir medição antecipada; o ciclo somente encerra após entrega e quitação. A conclusão de um ciclo não encerra contrato recorrente.
6. O vínculo opcional ao ERP valida contrato ativo e CNPJ do fluxo financeiro. Títulos devem ser recebíveis aprovados do mesmo contrato e valor; recebimentos e ajustes são conferidos contra baixas não estornadas ao salvar e ao encerrar. Juros e multas ficam no ERP, fora do principal do ciclo. Nenhum lançamento é criado ou alterado pela central.
7. A aba Instruções de trabalho contém nove procedimentos v1.0 (entradas, quatro passos, responsáveis, saídas e exceções). A aba Agentes IA oferece NAI Comercial, NAI Operacional e NAI Faturamento, cada qual com contexto cadastrado no servidor e o procedimento da sua etapa.

## Limites explícitos

- A central completa usa a mesma autorização do livro financeiro: SUPER_ADMIN e ADMIN sem tenant. Não amplia acesso de clientes, prestadores ou equipes técnicas a valores e contratos corporativos.
- Nenhuma mensagem/e-mail é enviada. Os agentes não possuem ferramentas de mutação, emissão fiscal, assinatura, pagamento ou comunicação; respostas são orientações e rascunhos revisáveis.
- Emissão fiscal permanece no emissor habilitado. Registrar uma NF na central não emite nota fiscal, não valida situação no fisco e não cria cobrança no Omie. O responsável deve conferir evidência da autorização fiscal.
- Documentos PDF são preservados no namespace imutável existente, por SHA-256 e geração. Outros formatos devem ser convertidos em PDF. Assinaturas não são validadas pela IA.
- Não há migração automática do histórico do onboarding antigo. Cadastre contratos existentes na central, vincule o mesmo cliente/ERP e justifique etapas anteriores sem duplicar lançamentos financeiros.
- Aditivos afetam novos ciclos selecionados explicitamente; não reescrevem trabalho ou faturamento anteriores. Correções financeiras exigem reabrir cards dependentes, preservando auditoria.

## Persistência e validação

Acervo privado em `financial-operations/v1/production-central.json`, namespace já negado aos SDKs clientes pelas regras Storage. API autenticada em `/api/production`, com autorização antes de ler corpo ou dados; respostas privadas sem cache; comandos limitados a 64 KiB. Gravação usa compare-and-swap por geração, chave idempotente, hash da operação, ator e leitura de confirmação. Falha de leitura nunca recria um acervo vazio. Limites explícitos: 1.000 registros, 200 ciclos por registro, 100 documentos/versões, 20.000 eventos e 16 MiB por acervo; requer particionamento ao atingir limites.

Testes cobrem ciclo completo, antecipação, pendências, duplicidade, imutabilidade dos aditivos, autorização, integridade do PDF, concorrência, replay, divergência do ERP, agentes sem ações externas e recuperação da interface após falha ambígua. A execução real dos agentes depende da configuração Genkit/Gemini do ambiente; testes automatizados não substituem uma consulta real homologada.
