# Atualização de dependências de 29/09/2026

A auditoria `npm audit --omit=dev` passou de 95 pacotes sinalizados (5 críticos,
23 altos, 64 moderados, 3 baixos) para 60 (0 críticos, 7 altos, 53 moderados).
Essas contagens incluem propagação de avisos pela árvore de dependências, não
representam falhas distintas nem confirmam exploração na aplicação.

## Atualizações

- Next.js 15.5.9 → 15.5.26, mantendo a versão principal.
- jsPDF 2.5.2 → 4.2.1; os dois usos existentes geram texto, formas, Blob e imagens
  em memória. A aplicação não usa leitura de arquivos locais pelo jsPDF.
- Genkit e plugins 1.29.0 → 1.42.0 e Firebase Admin 13.7.0 → 13.10.0, dentro das
  faixas já declaradas; dependências transitivas compatíveis foram atualizadas.
- Handlebars, protobufjs e websocket-driver recebem versões corrigidas.
- PostCSS usa a mesma resolução corrigida na raiz e no Next.js; Picomatch antigo
  recebe atualização dentro da linha 2, preservando as linhas modernas existentes.

A versão 4 do jsPDF restringe leitura de arquivos locais por padrão. Essa proteção
permanece habilitada. Os testes de compatibilidade exercitam importação padrão e
nomeada, geração de proposta como Blob e desenho do recibo com imagem sintética.

O build não inicializa exportadores de telemetria do Firebase. A inicialização em
runtime continua ativa nas condições anteriores, mas agora aguarda sua Promise e
trata falhas assíncronas sem registrar detalhes do provedor.

## Alertas remanescentes

Os sete pacotes de gravidade alta pertencem à cadeia Genkit/Firebase/OpenTelemetry.
Os avisos de origem incluem o exportador Prometheus e a propagação Jaeger; os demais
pacotes herdam a sinalização. A sugestão automática do npm para essa cadeia inclui
voltar `@genkit-ai/firebase` para 0.5.17. Essa regressão não foi aplicada.

Antes de atualizar OpenTelemetry para outra versão principal, revisar a
compatibilidade com o exportador Firebase, testar propagação de contexto e confirmar
traces/logs em homologação. Os 53 avisos moderados também permanecem visíveis.
Não foram adicionadas exclusões de advisories. O CI bloqueia qualquer alerta
crítico de produção, e o relatório do npm continua mostrando os demais níveis.

## Validação

```sh
npm ci
npm run test:run
npm run test:rules
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=critical
```

Homologar exportação de propostas e recibos com fotografia, fluxos Gemini e
recebimento de telemetria no projeto correto. Os testes locais usam dados sintéticos.

Referências dos mantenedores:

- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/parallax/jsPDF/releases/tag/v4.2.1
- https://github.com/parallax/jsPDF/releases/tag/v4.0.0
- https://github.com/protobufjs/protobuf.js/security/advisories/GHSA-xq3m-2v4x-88gg
- https://github.com/advisories/GHSA-q7rr-3cgh-j5r3
- https://github.com/advisories/GHSA-45rx-2jwx-cxfr
