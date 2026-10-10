# Omie — financeiro NEXTCON

A rota `/financial/omie` usa o backend autenticado `/api/financial/omie` para consultar os títulos do aplicativo NEXTCON. O cliente operacional selecionado no cabeçalho não altera essa conexão corporativa.

- Permissão: SUPER_ADMIN ou ADMIN sem tenant; verificação antes de qualquer acesso às credenciais.
- Configuração: App Key/App Secret existentes, validadas por ListarEmpresas. Uma única empresa com NEXTCON na razão social ou nome fantasia é necessária. Não regenerar chaves existentes.
- Credenciais: objeto privado `private-integrations/omie/nextcon.json` no bucket já configurado. As regras Storage negam todos os acessos do SDK cliente, inclusive administradores. Sem download token, URL assinada, logging ou retorno dos segredos; criptografia em repouso gerenciada pelo armazenamento. Não usa campos legados em companies.
- O backend só permite ListarEmpresas, ListarContasPagar e ListarContasReceber em endpoints fixos HTTPS. Redirecionamentos são recusados. Timeout de 20 segundos e erros sanitizados.
- Consulta sob demanda, 50 títulos por página e filtros por status. Não há sincronização automática, webhook, lançamento, baixa, emissão de cobrança ou execução de pagamentos.
- A tabela apresenta valor original e código do cliente/fornecedor; não calcula saldo a partir de pagamentos parciais nem mistura títulos com o livro diário histórico.
- Desconectar remove a configuração ativa do NAI; não revoga a chave no Omie e não altera títulos. Políticas de retenção do bucket podem preservar versões por seu prazo administrativo.

## Ativação

Em Financeiro → Omie, um administrador informa as credenciais do aplicativo NEXTCON e autoriza o armazenamento. Verificar a empresa/CNPJ exibidos e consultar as duas modalidades. Login Google no Omie não substitui essas credenciais de API. Nunca enviar App Secret pelo chat ou incluí-la no Git.

## Referências oficiais

- https://developer.omie.com.br/service-list/
- https://app.omie.com.br/api/v1/geral/empresas/
- https://app.omie.com.br/api/v1/financas/contapagar/
- https://app.omie.com.br/api/v1/financas/contareceber/
- https://ajuda.omie.com.br/pt-BR/articles/499061-obtendo-a-chave-de-acesso-para-integracoes-de-api

## Validação

Testes cobrem autorização antes de I/O, ausência de conexão, minimização de dados, empresa divergente, erros sem segredos, paginação/filtros, rejeição de operações de escrita e desconexão local. Teste de regras verifica que administradores e usuários clientes não leem, sobrescrevem ou excluem o objeto privado pelo SDK.
