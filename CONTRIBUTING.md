# Contributing

1. `npm ci`
2. Before pushing run: `npm run format:check && npm run lint && npm run type-check && npm run test:run`
3. Use `src/lib/logger.ts` for logging (structured JSON for Cloud Logging); wrap risky UI in `ErrorBoundary`.
4. Never commit secrets; copy `.env.example` to `.env.local`. Use Secret Manager in deployed environments.
5. Keep dependency versions aligned: `vitest` and `@vitest/coverage-v8` must be the same version.

See `docs/CI.md` for the pipeline.
