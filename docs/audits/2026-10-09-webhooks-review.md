# Revisão NAI-GCP — 9 de outubro de 2026

Base atual: `f15097fd1c8aedd31b5350e4a996b245c603eadc`. Continuação do PR #51, preservando as alterações posteriores de RD Conversas e prestadores. Não houve operações em dados reais ou publicação em produção.

## Correções

- Rotas de webhooks e dispatcher passam a usar Admin SDK no servidor.
- Desativação exige vínculo de empresa; preserva o histórico e registra a chave responsável.
- Replay exige vínculo da entrega, webhook ativo, mesma empresa, segredo existente e destino original. Falha antes de alterar ou enviar dados se alguma condição não é satisfeita.
- Transporte HTTPS fixa o IP público obtido na validação, mantém hostname e validação TLS, não segue redirecionamentos e descarta resposta ao receber cabeçalhos. O timeout cobre a conexão até os cabeçalhos.
- URLs com credenciais ou fragmentos são rejeitadas. Assinatura HMAC é recalculada com o segredo atual no envio.
- Filtro por webhook agora funciona no histórico. Status e identificadores são validados. Quatro índices cobrem combinações de filtros e ordenação por criação.
- Regras negam leitura/escrita direta de webhooks e entregas pelo navegador, incluindo administradores. A API mantém os controles explícitos antes do acesso Admin.

## Validação

- 441 testes passaram em 72 arquivos.
- 40 testes de regras passaram em cinco arquivos nos emuladores Firestore/Storage.
- TypeScript sem erros e formatação integral aprovada.
- Lint: zero erros e 1.742 avisos existentes.
- Build aprovado (exit 0), com 124 páginas geradas: `NODE_OPTIONS=--max-old-space-size=4096 npx next build --no-lint --experimental-debug-memory-usage`. Lint validado separadamente. Primeira tentativa encerrada por falta de memória; segunda concluiu geração, mas falhou na limpeza de `.next/export`. Após remoção dos artefatos gerados, a compilação limpa concluiu. Avisos de dependências opcionais OpenTelemetry/Genkit permanecem.

## Estado do CI anterior

No commit `631d778`, CI e Firebase validation passaram. CodeQL passou. O job Dependency review falhou com a mensagem “Dependency review is not supported on this repository”, apontando para habilitação do Dependency graph nas configurações do GitHub. Nenhum controle de segurança foi desativado para ocultar a falha.

## Implantação e limites

Publicar aplicação, `firestore.rules` e `firestore.indexes.json` em conjunto. Aguardar os índices antes de usar todos os filtros. Regras antigas ainda permitem acesso direto até a implantação das regras novas.

Os testes usam dados sintéticos e mocks de transporte; não verificam entrega real a um parceiro. Não houve ensaio visual nem revisão humana de cada linha do sistema. O dispatcher ainda inicia entregas em background no processo web; uma fila durável/worker com retentativas agendadas, idempotência e trava de replay concorrente permanece necessária. Não há alegação de 100% de cobertura ou certificação normativa.
