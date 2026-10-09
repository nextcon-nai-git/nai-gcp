# NAI-GCP — navegação e prontidão, 9 de outubro de 2026

O PR #51 foi integrado na main pelo commit `0f733d86ba4da89206873359348a07ab7bb8a6bd`, preservando o faturamento mensal do Grupo AVP (#56). A árvore combinada foi validada localmente: 460 testes e TypeScript passaram. CI, Security e Firebase validation do PR passaram; a validação Firebase da main também passou, incluindo build e testes de regras.

## Verificação ao vivo

Na sessão existente, `https://www.nai.nextconsaude.com.br/` carregou o painel. Financeiro, Prestadores e Grupo AVP carregaram por navegação do menu. A operação AVP mostrou fonte conectada. Nenhum cadastro, envio, exclusão ou alteração de dados reais foi executado. O domínio sem www retornou erro 502 do proxy usado neste ambiente; isso não demonstra indisponibilidade para todos os usuários.

Clientes permaneceu em carregamento no teste. A inspeção confirmou um defeito no hook compartilhado: assinantes tardios não recebiam o último snapshot e erros só atualizavam o assinante original. A observação ao vivo é compatível com esse defeito, mas não prova que ele seja a única causa possível.

## Correção adicional

O hook conserva o último estado de dados/erro enquanto há consumidores, entrega esse estado a assinantes novos e propaga erros a todos. A comparação usa `queryEqual` público, evitando serializar estruturas privadas do SDK e distinguindo instâncias Firestore. O último consumidor libera a assinatura e o estado. Trocas de consulta limpam os dados anteriores; callbacks de assinaturas encerradas são ignorados.

Nove testes direcionados passaram, incluindo resultados vazios, assinante tardio, falhas/permissões, troca de consultas, desmontagem e instâncias diferentes. Suíte completa: 468 testes em 75 arquivos passaram. TypeScript e formatação passaram; lint dos arquivos alterados: zero erros e dois avisos. A publicação da correção e a repetição do fluxo Clientes devem ser confirmadas após o rollout.

## Limites de publicação

O workflow da main valida aplicação/regras, mas não publica Firestore em push; a etapa de deploy foi ignorada nesta execução. É necessário executar `deploy.yml` manualmente com `deploy_firestore=true` e credenciais configuradas. O lançamento automático do App Hosting a partir da main está descrito no repositório, mas o commit efetivamente publicado não foi confirmado no console. Este ambiente não dispõe de sessão CLI Firebase/GCP autenticada nem de ferramenta para acionar esse workflow.

Permanecem pendentes sincronização offline, fila durável de webhooks, integrações não configuradas e validação integral dos fluxos com contas de diferentes perfis. Não há afirmação de 100% de funcionalidade, revisão linha a linha ou conformidade normativa integral.
