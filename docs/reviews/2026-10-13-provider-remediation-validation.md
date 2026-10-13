# Provider remediation evidence — 2026-10-13

## Code evidence

- `src/lib/all-consolidated-providers.ts` preserves the compatibility API but
  returns an empty list; it does not import embedded provider data. The result
  matches the empty-source behavior in PR #103.
- `src/app/providers/page.tsx` renders Firestore results only, archives records
  instead of deleting them, confirms writes with a reread, and removes provider
  registration writes to `users`. Company filters and displayed links now use
  explicit `companyId` / `servedCompanies` values only.
- `src/app/providers/page.tsx` and `src/lib/provider-integrity.ts` keep
  operational function separate from registered specialty, council number, and
  RQE. New or changed fiscal identity remains pending and inactive until
  independently verified. CSV imports are previewed, bounded, validated, and
  written as provider-only documents without merge or default evaluation.
- `src/lib/provider-integrity.test.ts` uses generated fictional identifiers and
  covers validation, duplicates, conflicts, company scoping, defaults, and
  write/read confirmation failures.
- `src/components/providers/provider-access-state.tsx` and its test cover
  loading, session error, denied, and authorized states.
- `tests/rules/providers-access.test.ts` adds synthetic two-company and
  multi-role rules coverage without changing authorization rules.

## Local validation

- Runtime: Node `v24.21.0`.
- `npm run format:check`: passed.
- `npm run lint`: passed with existing repository warnings; changed files have
  no lint errors.
- `npm run type-check`: passed after the build completed.
- `npm run test:coverage`: 155 files, 1,390 tests passed; statements 41.97%,
  branches 37.37%, functions 33.72%, lines 42.52%.
- `npm run build`: passed. It reported existing Genkit/OpenTelemetry dependency
  warnings for unresolved optional `@opentelemetry/winston-transport` and
  `@opentelemetry/exporter-jaeger` modules.

## Blockers and limits

- `npm run test:rules` could not download the Firestore emulator:
  `download failed, status 403: Blocked by DNS monitoring proxy`. The new
  `tests/rules/providers-access.test.ts` therefore has not executed locally.
- `npm audit --audit-level=high` reports 78 findings in the unchanged dependency
  tree (1 low, 59 moderate, 18 high). No dependency changes or audit fixes were
  made as part of this provider change.
- Final GitHub checks, authenticated UI verification, merge, and publication
  remain separate steps. No production data was read, changed, or cleaned up.
