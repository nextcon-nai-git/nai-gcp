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

O Vitest usa `@vitest/coverage-v8`. Os limites configurados são 30% de statements
e lines, e 25% de functions e branches. A revisão iniciada em 12/10/2026 mediu,
na base do PR #99, 37,08% de statements, 37,60% de lines, 29,68% de functions e
32,00% de branches, com 994 testes aprovados em 133 arquivos.

O resultado da nova revisão está em [revisão de 13/10/2026](reviews/2026-10-13-integral.md).
Aprovação da suíte e percentual de cobertura são medidas diferentes. Nenhum dos
dois atesta todas as integrações externas ou substitui homologação operacional.

## ESLint

Regras adicionadas: `no-console` (warn; permite `warn`/`error`), `no-debugger` (error), `@typescript-eslint/no-explicit-any` (warn)
e aviso para cadeias `.then()` (preferir async/await). Violações pré-existentes (`react/no-unescaped-entities`,
`react-hooks/static-components`, `react-hooks/purity`, `react-hooks/set-state-in-effect`, `jsx-a11y/alt-text`,
`no-require-imports`) foram rebaixadas para warning para permitir correção incremental.
A base do PR #99 apresentou 1.471 avisos e zero erros; a medição final da revisão
está no relatório citado acima.
`tsconfig.json` já usa `strict: true`.

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
