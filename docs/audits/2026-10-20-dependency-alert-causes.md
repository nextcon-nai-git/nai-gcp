# Correção das causas dos alertas de dependências

Base: `bd05c6e66b496b7c8d2d074151aacb73af8664cc`. Auditoria em 20/10/2026, Node 24.

## Causa e correção

Os cinco alertas altos de produção vinham da cadeia Tailwind 3 → chokidar/fast-glob → micromatch → braces. O aviso [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ainda não oferece versão corrigida de braces. A solução remove essa cadeia da árvore de produção migrando para Tailwind 4.3.3 e seu plugin PostCSS oficial, em vez de ocultar o aviso.

A migração oficial atualizou as classes dos componentes, a importação CSS e as utilidades personalizadas. A configuração existente permanece carregada por `@config`. O plugin de tema NAI foi adaptado à nova API e continua limitado à mídia de tela, preservando as cores de papel na impressão. Não houve alteração intencional de regras de negócio.

Atualizações compatíveis no lockfile também retiram avisos de dependências transitivas. A versão do plugin de React Hooks fica fixada em 7.0.1, a mesma da base, para manter a política de lint existente; nenhuma regra foi desativada.

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
