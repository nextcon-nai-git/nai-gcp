# Revisão NAI-GCP — 8 de outubro de 2026

Base: `c0f32699acda3d490d532546298278f3d9f76327` (main, PR #49).

## Cobertura real

Inventário inicial: 534 arquivos em src, 94 páginas, 42 rotas de API e 22 arquivos de ações. A base contém aproximadamente 113 mil linhas, incluindo dados. Foram executadas verificações estáticas na base e leitura manual dos fluxos de autenticação, gestão de chaves, regras de dados, cliente HTTP, Livro Diário, shell, fila offline e integrações. Os 40 destinos fixos do menu lateral têm páginas existentes. Isso não equivale a validação funcional de todas as telas nem a revisão humana de cada linha; não há certificação de conformidade integral.

## Correções nesta revisão

| Problema observado                                                                                      | Correção                                                                                                                  | Evidência                                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Gestão de chaves extraía token sem verificá-lo, usava SDK cliente no servidor e não aplicava isolamento | Autenticação revogada/expirada pelo requireAuth, administrador obrigatório, vínculo de empresa, validação Zod e Admin SDK | Testes de API: anônimo, operação, acesso global, outra empresa e revogação |
| Chave sem empresa recebia GLOBAL como fallback                                                          | Rejeição explícita de credencial sem vínculo ou escopos válidos                                                           | Testes de ambos os validadores                                             |
| Regra genérica permitia acesso direto a api_keys por equipe operacional                                 | api_keys excluído da leitura/escrita genérica; administração pela API                                                     | Teste de regras com cliente, administrador e superadministrador            |
| Portal listava hashes diretamente e emitia chave sem token; botão de revogação sem ação                 | Listagem sem hash pela API, Bearer nas operações, revogação funcional, confirmação e erros visíveis                       | TypeScript e testes de fronteira do servidor                               |
| Reconexão apagava fila offline sem transferência                                                        | Preservação da fila e aviso de envio pendente                                                                             | Teste React de reconexão e preservação                                     |
| HTTP carregava resposta inteira antes de verificar tamanho                                              | Limite durante leitura incremental e cancelamento                                                                         | Teste de stream sem Content-Length                                         |
| Cache ignorava limites de tamanho e aceitava cookies/API keys                                           | Limites e TTL na identidade do cache, credenciais sem cache                                                               | Testes de quatro tipos de credenciais e limite distinto                    |
| PDF financeiro pendente podia aparecer após trocar livro/usuário                                        | Geração de requisição separada e descarte de resultado obsoleto                                                           | Revisão do fluxo e suíte contábil existente                                |
| Conteúdo principal sem atalho de teclado                                                                | Link de salto e destino focável no main                                                                                   | Inspeção do markup                                                         |

## Referências adotadas

- OWASP ASVS: https://owasp.org/projects/asvs — autenticação, autorização e validação.
- WCAG 2.2, tradução autorizada W3C: https://www.w3.org/Translations/WCAG22-pt-BR/ — navegação por teclado e desvio de blocos.
- Guia ANPD de segurança da informação: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-vf.pdf — referência brasileira para controles de acesso e proteção dos dados.

As referências orientam mudanças específicas; não constituem atestado de adequação total à LGPD, às NRs ou a um nível ASVS/WCAG.

## Pendências confirmadas, fora do patch

1. `/api/offline-sync`, integrações Senior e TOTVS e persistência genérica de classificação retornam configuração pendente/501. Duas filas locais coexistem e precisam ser consolidadas com vínculo de usuário, envio autenticado e idempotência.
2. Webhooks e diversas ações/rotas M2M ainda usam SDK cliente no servidor. Exclusão e replay precisam de verificação explícita do proprietário antes de migrar o armazenamento ao Admin SDK. O dispatcher segue redirecionamentos e não fixa a resolução DNS validada: não considerar a mitigação SSRF completa.
3. `suggest-exams` é público e aciona IA sem controle de autenticação/taxa por usuário: revisar o contrato dos consumidores e a proteção contra abuso.
4. Rate limiting de API continua local ao processo; implantar controle compartilhado para múltiplas instâncias.
5. O módulo contábil da base não apresenta ranking específico dos dez recebimentos/saídas; débito/crédito contábil não deve ser tratado automaticamente como entrada/saída de caixa. Requer plano de contas e classificação com evidência para implementar sem produzir ranking errado.
6. Não houve teste com conta real nem alterações em dados de clientes. Não houve teste visual de todas as páginas.

## Implantação

Aplicar a aplicação e `firestore.rules` em conjunto. A proteção contra escrita direta de chaves depende da publicação das regras. As demais rotas que usam SDK cliente permanecem uma dívida identificada; o patch não transforma esses fluxos em integração completa.

## Validação

- Suíte geral: 409 testes em 66 arquivos passaram; três testes adicionais do guard também passaram separadamente.
- Emuladores Firestore/Storage: 39 testes em cinco arquivos passaram, incluindo restrição de api_keys.
- TypeScript: sem erros.
- Prettier da base: aprovado.
- ESLint da base: zero erros, 1.749 avisos. O lint inicial tinha 1.752 avisos; não foi feita limpeza ampla.
- Cobertura medida: 20,81% de statements, 21,12% de linhas, 17,07% de branches e 15,62% de funções. A suíte não demonstra cobertura funcional de 100%.
- Build inicial: encerrado por OOM do ambiente (cgroup de 8 GiB). Segunda tentativa com heap de 2 GiB: JavaScript heap OOM na verificação de tipos. Terceira tentativa com heap de 4 GiB em execução; não considerar o build aprovado até seu encerramento.
- Nenhuma publicação em produção nesta revisão; aplicação e regras devem passar pelo CI e ser implantadas em conjunto.
