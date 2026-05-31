# TaskMaster Pro — Audit & Modernization (May 30, 2026)

Comprehensive dependency upgrade and full-stack audit. This document records what
was changed, what was found, and the prioritized roadmap to "state of the art".

## 1. Dependencies — all upgraded to latest

Every direct dependency was bumped to the newest version available as of
2026-05-30 and the lockfile regenerated under **pnpm 11.4.0 / Node 22+**.

Notable major/minor moves:

| Package                                                                                                                                                                                                                | From   | To              | Notes                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------- | ------------------------------------------------------------ |
| `eslint` + `@eslint/js`                                                                                                                                                                                                | 9.39.4 | 10.4.1 / 10.0.1 | Pin lifted — `typescript-eslint@8.60` now supports ESLint 10 |
| `prettier-plugin-svelte`                                                                                                                                                                                               | 3.5.1  | 4.0.1           | Major; no config change required                             |
| `@sveltejs/kit`                                                                                                                                                                                                        | 2.57.1 | 2.61.1          |                                                              |
| `@sveltejs/vite-plugin-svelte`                                                                                                                                                                                         | 7.0.0  | 7.1.2           |                                                              |
| `svelte`                                                                                                                                                                                                               | 5.55.4 | 5.56.0          |                                                              |
| `vite`                                                                                                                                                                                                                 | 8.0.8  | 8.0.14          |                                                              |
| `tailwindcss` + `@tailwindcss/vite`                                                                                                                                                                                    | 4.2.2  | 4.3.0           |                                                              |
| `stripe`                                                                                                                                                                                                               | 22.0.2 | 22.2.0          |                                                              |
| `zod`                                                                                                                                                                                                                  | 4.3.6  | 4.4.3           |                                                              |
| `@aws-sdk/*`                                                                                                                                                                                                           | 3.1032 | 3.1057          |                                                              |
| `date-fns`, `ioredis`, `nanoid`, `yjs`, `vitest`, `@playwright/test`, `typescript-eslint`, `svelte-check`, `@types/node`, `globals`, `eslint-plugin-svelte`, `@libsql/client`, `prettier-plugin-tailwindcss`, `arctic` | —      | latest          | minor/patch                                                  |

### Toolchain hardening

- Added `packageManager: "pnpm@11.4.0"` and `engines` (`node >=22`, `pnpm >=11`).
- `pnpm-workspace.yaml`: removed the malformed `allowBuilds` placeholder that pnpm
  kept rewriting, allow-listed `esbuild` + `@node-rs/argon2` builds, and set
  `verifyDepsBeforeRun: false` so the deps integrity pre-check no longer hard-fails
  every `pnpm run`/`pnpm exec` on esbuild's no-op postinstall.

### ESLint 10 new-rule fixes (real issues caught)

- `preserve-caught-error`: `src/lib/server/storage/s3.ts` now chains the original
  error via `{ cause }` in all three throw sites.
- `no-useless-assignment`: removed a dead `newPosition` initializer in the board page.

## 2. Bugs fixed during the audit

- **AI requests were missing the `model` field** (`src/lib/server/ai/engine.ts`).
  OpenAI-compatible providers reject such requests — both call sites now send
  `model: AI_MODEL` (default `gpt-4o-mini`, overridable via env). The AI feature
  could not have worked against a real provider before this.
- **CI version drift** (`.github/workflows/ci.yml`): pinned pnpm 9 could not install
  the pnpm 11 lockfile (`--frozen-lockfile` would fail), and Node 20 contradicted
  `engines`. Now reads pnpm from `packageManager` and uses Node 22.
- **`.env.example` was missing `AI_PROVIDER_URL` / `AI_API_KEY`** (used in code).
  Added them plus `AI_MODEL`.
- **Stripe webhook used `console.*`** instead of the structured pino logger — now
  consistent and queryable in production.

## 3. Architecture improvements implemented

- **Distributed rate limiting** (`src/lib/server/rate-limit.ts` + `redis.ts`):
  `ioredis` was a dependency but completely unused. Rate limiting was in-memory and
  would not hold across multiple instances. Now a Redis fixed-window counter
  (`INCR` + `PEXPIRE`) shared across instances, with a transparent in-memory
  fallback when `REDIS_URL` is absent or Redis is unreachable. Responses now carry
  `X-RateLimit-*` headers.
- **Startup env validation** (`src/lib/server/env.ts`): Zod-validated configuration
  invoked from `hooks.server.ts`. Fails fast in production on invalid/missing core
  settings (e.g. `ORIGIN`), logs a single structured summary of disabled
  integrations in dev, and is skipped during `vite build`.
- **Test suite bootstrapped**: added `jsdom`, then 14 unit tests covering the
  fractional-index ordering utility and the rate limiter (incl. fake-timer window
  reset). `pnpm test:unit` previously found 0 tests and crashed on missing `jsdom`.

## 4. Roadmap — now implemented

All previously-listed gaps have been addressed:

- **CSP hardened** — moved to SvelteKit's native nonce-based CSP (`kit.csp` in
  `svelte.config.js`); `script-src` no longer allows `unsafe-inline`. The manual
  header in `hooks.server.ts` was removed. (`style-src` keeps `unsafe-inline` for
  inline `style=` attributes, which CSP nonces cannot cover.)
- **Drizzle migrations** — generated `drizzle/0000_*.sql` for all 33 tables and
  un-ignored `drizzle/` so migrations are version-controlled; deploy runs
  `pnpm db:migrate`.
- **Client IP hardened** — rate limiting now uses `event.getClientAddress()`
  (honouring adapter-node `ADDRESS_HEADER`/`XFF_DEPTH`) instead of raw, spoofable
  `x-forwarded-for`. Proxy env vars documented in `.env.example`.
- **S3 production guard** — `createS3Client()` refuses to start in production if
  the credentials are still the local `minioadmin` defaults.
- **Observability** — `handleError` server hook logs with the request's
  correlation id and surfaces a safe `requestId` to clients; `SIGTERM`/`SIGINT`
  graceful shutdown closes Redis.
- **Coverage** — `@vitest/coverage-v8` + `pnpm test:coverage`, uploaded as a CI
  artifact in the unit job.
- **Tests** — 19 unit tests (fractional-index, rate-limit, env validation) plus a
  Playwright `tests/smoke.spec.ts` (public pages, auth redirect, security headers,
  health). Added the missing `vitest.integration.config.ts`.
- **Docker** — multi-stage `docker/Dockerfile` (Node 24, non-root, healthcheck) +
  `Dockerfile.dev` + `docker-compose.yml` (app, Redis, MinIO, Stripe CLI).

### Toolchain pinning (May 30, 2026)

- **Node 24 (latest LTS)** enforced via `engines`, `.nvmrc`, CI, and all Docker
  stages. **pnpm only** — `package-lock.json`/`yarn.lock` are git-ignored and
  corepack reads the pinned `packageManager`.

## 5. Verification (current state)

```
pnpm check         → 0 errors, 0 warnings
pnpm lint          → clean (Prettier + ESLint 10)
pnpm build         → success (adapter-node, Vite 8)
pnpm test:unit     → 19 passed (3 files)
pnpm test:coverage → reports generated (text/html/lcov)
```

## 6. Future enhancements (optional)

- Migrate hand-rolled `/api/v1` fetches to SvelteKit **remote functions**
  (already enabled experimentally) for end-to-end type safety.
- External error tracking (Sentry/OpenTelemetry traces) on top of the structured
  logs and `requestId` correlation now in place.
- Accessibility: keyboard-driven reordering for the Kanban drag-and-drop.
- Expand integration tests against an ephemeral libSQL + Redis in CI.
