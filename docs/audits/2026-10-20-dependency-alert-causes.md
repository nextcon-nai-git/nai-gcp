# Correção das causas dos alertas de dependências

Base: `bd05c6e66b496b7c8d2d074151aacb73af8664cc`. Auditoria em 20/10/2026, Node 24.

## Causa e correção

Os cinco alertas altos de produção vinham da cadeia Tailwind 3 → chokidar/fast-glob → micromatch → braces. O aviso [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ainda não oferece versão corrigida de braces. A solução remove essa cadeia da árvore de produção migrando para Tailwind 4.3.3 e seu plugin PostCSS oficial, em vez de ocultar o aviso.

A migração oficial atualizou as classes dos componentes, a importação CSS e as utilidades personalizadas. A configuração existente permanece carregada por `@config`. O plugin de tema NAI foi adaptado à nova API e continua limitado à mídia de tela, preservando as cores de papel na impressão. Não houve alteração intencional de regras de negócio.

Atualizações compatíveis no lockfile também retiraram avisos de dependências transitivas. Na proposta original de 20/10, o plugin de React Hooks ficou fixado em 7.0.1, a mesma versão da base daquela revisão; nenhuma regra foi desativada.

## Auditoria antes e depois

| Escopo                 | Antes                                       | Depois                                     |
| ---------------------- | ------------------------------------------- | ------------------------------------------ |
| `npm audit --omit=dev` | 65 moderados, 5 altos, 0 críticos           | 63 moderados, 0 altos, 0 críticos          |
| `npm audit` completo   | 1 baixo, 66 moderados, 13 altos, 0 críticos | 1 baixo, 64 moderados, 9 altos, 0 críticos |

Os avisos restantes não foram suprimidos. Na produção, Genkit ainda usa cadeias antigas de OpenTelemetry/UUID e instrumentação. Nas ferramentas de desenvolvimento, permanecem cadeias de braces no lint/CLI e extract-zip no Genkit CLI. As versões atuais dos fornecedores ainda carregam essas dependências; os downgrades incompatíveis sugeridos automaticamente pelo npm não foram aplicados. Reavaliar quando os fornecedores publicarem cadeias corrigidas.

## Validação e limites

- Build de produção concluído com 150 páginas geradas.
- Suíte com cobertura: 2.840 testes da base aprovados, 72,02% das linhas cobertas.
- Três novos testes compilam o CSS real e verificam tema escuro, escape de classes com opacidade, hover, mídia de impressão, raio e largura variável da barra lateral.
- Suíte final com os novos testes: 274 arquivos e 2.843 testes aprovados; verificação de tipos e formatação aprovadas.
- Comparação em Chromium com CSS anterior e atualizado: cores, dimensões, raios e espaçamentos dos cinco componentes representativos coincidem em tela. Na impressão, a paleta padrão do Tailwind 4 apresenta pequenas diferenças de cor; as dimensões e os fundos comparados foram preservados. Essa amostra não substitui revisão de todas as páginas.
- Lint mantém zero erros e os 1.246 avisos existentes na base.

Tailwind 4 requer Safari 16.4+, Chrome 111+ e Firefox 128+. Referência: [guia oficial de migração](https://tailwindcss.com/docs/upgrade-guide). A alteração precisa passar pela revisão do PR antes de integrar a produção.

## Integração com a main em 02/11/2026

A integração foi refeita sobre `c7a0ed6a3c0e52ae65937e49bfdc0366ddefd928`.
Os conflitos de componentes foram resolvidos a partir da lógica atual da main,
aplicando somente a migração de utilidades. A tela removida `whatsapp-hub` continua
removida. As telas recentes de assistente, ASOs, periódicos, eSocial e operações
também receberam as utilidades equivalentes do Tailwind 4.

O pacote e o lockfile preservam a configuração atual de ESLint e os backports de
segurança do Zod e de extração de arquivos. Somente a árvore necessária para
Tailwind 4.3.3 e seu plugin PostCSS foi alterada. O pin antigo de React Hooks não
foi restaurado sobre a política atual da main.

A revisão corrigiu a migração da borda do indicador de gráfico: a cor continua
vinculada à variável da série `--color-border`, em vez de usar o token genérico
do tema. Um teste de compilação PostCSS verifica a declaração CSS resultante.
A comparação estrutural dos 131 componentes alterados não encontrou mudanças
de lógica ou estrutura fora dos literais de apresentação. Os resultados de 20/10
acima são históricos e não substituem as verificações do commit integrado.

A revisão independente também corrigiu os stops de gradiente do tema NAI:
Tailwind 4 registra `--tw-gradient-from/via/to` como cores, portanto as posições
permanecem na lista de stops, junto da direção e da parada intermediária. Isso
evita valores CSS inválidos em cards e títulos com texto transparente. Os testes
de CSS cobrem essas declarações e a presença das quatro cores de custo AVP
detectadas no código da aplicação. A classe removida `bg-opacity-40` foi retirada
da coluna Kanban; a transparência continua explícita em `bg-muted/40`.
