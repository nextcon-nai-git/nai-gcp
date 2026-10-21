# CI e verificações de qualidade

## Workflows

- `.github/workflows/ci.yml` (push e pull_request): `npm ci`, Prettier (check), ESLint, `tsc --noEmit`, testes com cobertura, build e upload do relatório de cobertura (artefato `coverage-report`).
- `.github/workflows/security.yml` (PR, push na `main`, semanal): CodeQL (JS/TS), relatório `npm audit --audit-level=high` com `continue-on-error: true` e dependency review em PRs, bloqueando novas dependências críticas.
- `.github/dependabot.yml`: atualizações semanais de npm e GitHub Actions.
- `.github/workflows/deploy.yml` (Firebase validation): auditoria de dependências de produção com bloqueio de críticos, lint, TypeScript, testes, emuladores de Firestore/Storage e build. O deploy de regras e índices é separado, por `workflow_dispatch`, na `main`, com `deploy_firestore=true` e credencial configurada.
- `.github/workflows/firebase-deploy.yml`: aviso de descontinuação; não publica o site.
- O backend conectado do Firebase App Hosting publica o site a partir da `main`. Uma execução verde de CI não comprova rollout nem publicação de regras.

Antes do merge, conferir o check **Code scanning results / CodeQL** do SHA final,
além do job **Security / CodeQL**. O job pode concluir a análise e o envio do SARIF
com sucesso enquanto o check separado reprova pelos alertas encontrados. Na revisão
do PR #100, essa diferença revelou quatro alertas que exigiram diagnóstico antes
da integração. O `npm audit` não bloqueante também precisa ser lido pelo resultado
do comando, não apenas pela cor do job.

## Rodar localmente

Usar Node 24, conforme `engines.node` e o ambiente de execução do backend `nai`.
Vitest e `@vitest/coverage-v8` usam a mesma versão 4.1.11 para manter
compatibilidade entre os testes locais e os workflows.

```bash
npm ci
npm run format:check   # ou npm run format para corrigir
npm run lint
npm run type-check
npm run test:coverage
npm run test:rules      # requer Java 21 no CI; projeto local demo-nai-security
npm run build
npm run ci             # formato, lint, tipos, cobertura e build; regras são executadas à parte
```

## Cobertura

O Vitest usa `@vitest/coverage-v8`. Os pisos vigentes em `vitest.config.ts` são
70% de linhas, 30% de instruções e 25% de funções e ramos. A medição inclui
`src/**/*.{ts,tsx}` e exclui apenas os arquivos de teste e de declaração de tipos.

As medições anteriores e seus limites estão nos relatórios de
[18/10/2026](reviews/marco-70-2026-10-18.md) e da
[entrada de contratos](reviews/2026-10-19-contract-import.md). Cada resultado
pertence ao código e às dependências usados naquela execução; o commit final de
uma nova entrega precisa executar novamente os checks. Aprovação da suíte e
percentual de cobertura são medidas diferentes. Nenhum dos dois atesta todas as
integrações externas ou substitui homologação operacional.

## ESLint

Regras adicionadas: `no-console` (warn; permite `warn`/`error`), `no-debugger` (error), `@typescript-eslint/no-explicit-any` (warn)
e aviso para cadeias `.then()` (preferir async/await). Violações pré-existentes (`react/no-unescaped-entities`,
`react-hooks/static-components`, `react-hooks/purity`, `react-hooks/set-state-in-effect`, `jsx-a11y/alt-text`,
`no-require-imports`) foram rebaixadas para warning para permitir correção incremental.
A base do PR #99 apresentou 1.471 avisos e zero erros; a medição final da revisão
está no relatório citado acima.
`tsconfig.json` já usa `strict: true`.

### Compatibilidade das dependências de lint

A recuperação de 19/10/2026 restaura o conjunto de dependências anterior ao
[PR #144](https://github.com/nextcon-nai-git/nai-gcp/pull/144), preservando as demais
atualizações da aplicação:

| Dependência                 | Versão no lockfile |
| --------------------------- | ------------------ |
| `eslint`                    | 9.39.4             |
| `eslint-config-next`        | 16.2.3             |
| `eslint-plugin-react`       | 7.37.5             |
| `eslint-plugin-react-hooks` | 7.0.1              |

O PR #144 elevou o ESLint para 10.12.0, mas o `eslint-plugin-react` 7.37.5 declara
suporte a ESLint até `^9.7`. O
[CI da main em 19/10](https://github.com/nextcon-nai-git/nai-gcp/actions/runs/39262472633)
abortou ao carregar `react/display-name` com
`contextOrFilename.getFilename is not a function`, antes dos testes e do build.
A atualização também alterou dependências transitivas; restaurar o seu delta no
lockfile mantém o conjunto conhecido sem relaxar as regras de `eslint.config.mjs`.

O Dependabot continua propondo atualizações menores e correções do ESLint. As
atualizações de versão principal ficam suspensas até validar em conjunto o
ESLint, a configuração Next e seus plugins. Essa migração deve manter as regras
atuais e passar por instalação reproduzível, lint, tipos, testes e build antes de
retirar a restrição. A alteração do lockfile não comprova essas verificações nem
a publicação do aplicativo; seus resultados devem ser registrados no SHA final.

## Recuperação da interface

Consulte [recuperação de telas e logs](testing/error-recovery.md) para o limite de
erros das páginas autenticadas, a nova tentativa, a preservação da navegação e os
cuidados com o contexto registrado no Cloud Logging.

## Revisão de dependências no GitHub

O job `Dependency review` exige suporte à revisão e Dependency graph habilitado
no repositório. A execução do PR #26 retornou que o recurso está indisponível e
indicou verificar [Security analysis](https://github.com/nextcon-nai-git/nai-gcp/settings/security_analysis).
Uma falha de configuração não é aprovação da segurança das dependências. Na
consulta de 13/10/2026, a API do repositório informava `protected=false` para
`main`; os jobs existentes, por si só, não constituem proteção de branch.
