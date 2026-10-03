# CI e verificações de qualidade

## Workflows

- `.github/workflows/ci.yml` (push e pull_request): `npm ci`, Prettier (check), ESLint, `tsc --noEmit`, testes com cobertura, build e upload do relatório de cobertura (artefato `coverage-report`).
- `.github/workflows/security.yml` (PR, push na `main`, semanal): CodeQL (JS/TS), `npm audit --audit-level=high` e dependency review em PRs.
- `.github/dependabot.yml`: atualizações semanais de npm e GitHub Actions.
- `.github/workflows/deploy.yml` e `firebase-deploy.yml` são anteriores e não foram alterados.

## Rodar localmente

```bash
npm ci
npm run format:check   # ou npm run format para corrigir
npm run lint
npm run type-check
npm run test:coverage
npm run build
npm run ci             # todos os passos acima
```

## Cobertura

O Vitest usa `@vitest/coverage-v8`. A cobertura atual é ~2,7%, muito abaixo da meta de 80% (75% em branches).
Por isso os limiares em `vitest.config.ts` estão em 2% (statements/lines/functions/branches) e devem ser elevados
conforme novos testes forem adicionados.

## ESLint

Regras adicionadas: `no-console` (warn; permite `warn`/`error`), `no-debugger` (error), `@typescript-eslint/no-explicit-any` (warn)
e aviso para cadeias `.then()` (preferir async/await). Violações pré-existentes (`react/no-unescaped-entities`,
`react-hooks/static-components`, `react-hooks/purity`, `react-hooks/set-state-in-effect`, `jsx-a11y/alt-text`,
`no-require-imports`) foram rebaixadas para warning para permitir correção incremental (~590 avisos atuais).
`tsconfig.json` já usa `strict: true`.
