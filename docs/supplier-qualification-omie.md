# Homologação de fornecedores e conectores Omie

## Operação

- `/suppliers/qualification`: portal autenticado. Perfil PROVIDER vê apenas os processos da própria conta. SUPER_ADMIN e ADMIN corporativo sem tenant revisam os processos. Não há acesso público a documentos nem convite automático. O fornecedor precisa de conta PROVIDER provisionada pelo fluxo existente de usuários.
- O fornecedor cadastra seu processo; a equipe define os requisitos; o fornecedor anexa documentos e envia para análise. Revisão documental, devolução com justificativa, aprovação, recusa e suspensão ficam registradas. Para renovação, devolva para ajustes, receba os documentos atualizados e revise novamente.
- A criação exige a conta PROVIDER do próprio fornecedor. A equipe revisora não cria processos em seu próprio nome, evitando impedir o acesso do fornecedor ao documento já cadastrado.
- A decisão de aprovação exige responsável diferente do proprietário e de quem enviou o processo. Documentos não podem ser revisados pelo próprio remetente. A validade não ultrapassa a menor validade dos documentos obrigatórios. Vencimentos usam o calendário de São Paulo.
- Upload privado de PDF, PNG e JPEG até 8 MiB, verificação de assinatura e SHA-256, download autenticado como anexo. A validação de assinatura não é antivírus; não há varredura antimalware implantada. Revisores devem conferir evidências antes de aceitar.
- `/financial/omie/conectores`: consultas paginadas de clientes/fornecedores, categorias e contas correntes; inclusão de fornecedor com homologação vigente; inclusão de títulos locais aprovados, sem baixa local nem referência externa, com vencimento atual ou futuro e competência aberta.
- Os códigos de cliente/fornecedor, categoria e conta devem ser conferidos no catálogo. O servidor consulta novamente esses cadastros e compara o nome do cliente/fornecedor com o título. A identificação exata pelo código escolhido aparece na prévia. Não há classificação automática por IA.
- Títulos de contratos integrados usam o documento do cliente conferido no aceite e o vínculo estável ao cadastro, permitindo renomeações sem trocar a identidade do cliente. Uma alteração de documento exige conferência do vínculo. Títulos anteriores à entrada de um contrato existente preservam a validação histórica pelo nome.
- Cada envio de título exige a data real de emissão, já ocorrida e dentro de sua competência. A prévia envia `data_emissao` explicitamente e a reconciliação verifica essa data. Se emissão e competência não puderem ser representadas por essa regra, o envio é bloqueado para conferência da origem; não se deve alterar uma competência correta apenas para permitir a exportação. Datas de vencimento e previsão continuam separadas.
- Parcelas usam os mesmos identificadores gerados pelo financeiro em todo o percurso, inclusive reconciliação. Chaves já existentes são preservadas; identificadores legados longos recebem uma chave determinística dentro do limite de 60 caracteres do Omie.
- Antes de incluir um fornecedor, preencha logradouro, número, bairro, município, UF e CEP e as características exigidas no aplicativo Omie conectado. A confirmação das exigências e os limites oficiais dos campos são validados antes de reservar o envio. A equipe confere as exigências na configuração do Omie; essa confirmação humana não é uma descoberta automática de campos obrigatórios. Não use nomes de características novos sem conferir, pois o Omie pode criar uma característica desconhecida.
- A confirmação cria registro real no aplicativo Omie conectado. O conector não emite nota, boleto, pagamento, baixa ou conciliação. A consulta de DRE e de contas a pagar/receber permanece disponível nas telas existentes.

## Integridade e recuperação

Credenciais permanecem no armazenamento privado existente, nunca na resposta do conector. Rotas validam sessão e escopo antes de ler acervos ou interpretar comandos. Prefixos privados continuam negados pelas Storage Rules, inclusive para administradores no navegador.

O envio reserva a origem na mesma geração do acervo antes de chamar o Omie. Código de integração estável, hash da prévia, empresa/aplicativo, autor, horário e payload ficam preservados. Uma resposta perdida, timeout, falha de leitura ou erro do Omie deixa a reserva pendente. Não existe repetição automática de inclusão nem remoção de reserva pelo cliente. `Consultar resultado` apenas consulta a chave de integração e compara os campos materiais; só então vincula o código Omie. Mudança de aplicativo bloqueia reconciliação até restabelecer a conexão original.

Se uma reserva não corresponder a registro no Omie, a equipe técnica precisa conferir o histórico do aplicativo e o acervo antes de qualquer recuperação manual. Não apagar reservas ou trocar códigos para contornar resposta incerta. Uma recusa de inclusão, inclusive CPF/CNPJ já existente, também preserva a reserva. Vinculação a cadastro preexistente por CPF/CNPJ não está automatizada.

Títulos reservados ou confirmados ficam bloqueados para edição, cancelamento, troca de referência e baixa local. Alterações e baixas posteriores são geridas e conferidas no Omie; não há sincronização bidirecional automática, webhook ou agendamento implantado. O histórico confirma a inclusão, não o saldo atual. Suspender a homologação depois do envio não inativa automaticamente o fornecedor no Omie.

Os acervos JSON privados têm limite de 16 MiB e gravação com comparação de geração. Arquivos privados enviados antes de uma falha de concorrência podem permanecer órfãos; não são expostos nem apagados automaticamente. Particionamento, retenção, limpeza de órfãos e antivírus são evoluções operacionais necessárias conforme volume. Não se promete trilha imutável contra administradores da infraestrutura.

## Contratos e validação

Contratos oficiais consultados: `geral/clientes` (ListarClientes, ConsultarCliente, IncluirCliente), `geral/categorias` (ListarCategorias, ConsultarCategoria), `geral/contacorrente` (ListarContasCorrentes, ConsultarContaCorrente), `financas/contapagar` (IncluirContaPagar, ConsultarContaPagar), `financas/contareceber` (IncluirContaReceber, ConsultarContaReceber). Endpoints fixos sob `https://app.omie.com.br/api/v1/`; o cliente não escolhe URLs ou métodos arbitrários.

Referência de campos obrigatórios por aplicativo: https://ajuda.omie.com.br/pt-BR/articles/4323338-configuracoes-omie-cadastro-de-clientes-e-fornecedores. A documentação de contas a pagar informa que a omissão de `data_emissao` adota a data corrente; por isso o NAI não depende desse valor padrão.

Testes usam registros sintéticos em memória: isolamento por proprietário, acesso por perfil, upload privado, concorrência, idempotência, validade, segregação de revisão, prévia desatualizada, timeout sem reenvio, correspondência da consulta remota, mudança de aplicativo e bloqueio de títulos exportados. Testes não criam registros reais no Omie nem nos acervos de produção.
