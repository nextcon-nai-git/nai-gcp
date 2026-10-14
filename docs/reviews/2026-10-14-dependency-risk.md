# Dependências — avaliação incremental em 14/10/2026 UTC

## Jaeger: correção verificada localmente

O lockfile instalava `@opentelemetry/propagator-jaeger` 1.25.1 por meio do
SDK OpenTelemetry 1.25.1 utilizado pelo Genkit 1.42.0. Um cabeçalho sintético
`uber-trace-id: %` reproduziu `URIError` na chamada de extração, sem rede ou
credenciais. O advisory do mantenedor informa correção em 2.9.0:
https://github.com/open-telemetry/opentelemetry-js/security/advisories/GHSA-45rx-2jwx-cxfr

Um override restrito ao propagador fixa 2.9.0. Seu core 2.9.0 fica aninhado;
o core 1.25.1 dos demais componentes não é substituído. A API peer permanece
compatível com a API 1.9.0 instalada e o requisito de Node é atendido pelo Node 24.
Não foi aplicado `npm audit fix --force` nem alterada a coleta de telemetria.

O teste resolve o propagador a partir do próprio SDK antigo, registra-o no
NodeTracerProvider e verifica cabeçalhos malformados de trace/baggage, além da
preservação de traceId, spanId e amostragem em extração e injeção válidas.
Os quatro casos passaram; com os seis testes existentes de ciclo de telemetria,
foram dez casos aprovados. Typecheck também passou. O CI completo continua sendo
obrigatório antes do merge.

## Prometheus: caminho observado e limite da conclusão

O advisory exige exporter Prometheus ativo e endpoint alcançável:
https://github.com/open-telemetry/opentelemetry-js/security/advisories/GHSA-q7rr-3cgh-j5r3

Na versão instalada, `@genkit-ai/google-cloud/lib/gcpOpenTelemetry.js` fornece
explicitamente PeriodicExportingMetricReader e o exporter Google Cloud; não
instancia servidor Prometheus nesse caminho. O código e apphosting.yaml não
configuram exporter Prometheus. Isso reduz a exposição inferida neste fluxo,
mas não comprova a configuração externa de todo o ambiente. O alerta transitivo
permanece aberto; a atualização coordenada de Genkit/OpenTelemetry e a inspeção
de eventuais agentes externos ainda são necessárias.

## Braces/Tailwind: sem patch compatível identificado

O advisory GHSA-vfj7-8cjw-p6xm afeta braces até 3.0.3 e não lista versão
corrigida na consulta de 14/10/2026:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

No código do projeto, o plugin Tailwind é importado pela configuração de build;
os padrões de conteúdo são literais locais. Não foi encontrado uso de braces,
micromatch, fast-glob ou chokidar recebendo entrada de usuário em src. A análise
estática não garante ausência de chamadas transitivas. Manter padrões e fontes
de build restritos ao repositório revisado reduz a exposição, mas não remove o
alerta. A migração para Tailwind 4 exige avaliação visual e de compatibilidade.

Esta avaliação não declara a árvore livre de vulnerabilidades nem aceita
silenciosamente os alertas moderados. As contagens do audit incluem dependências
afetadas indiretamente; não representam a quantidade de falhas independentes.
