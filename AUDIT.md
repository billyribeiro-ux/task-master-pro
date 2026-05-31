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

## 4. Verification (current state)

```
pnpm check      → 0 errors, 0 warnings
pnpm lint       → clean (Prettier + ESLint 10)
pnpm build      → success (adapter-node, Vite 8)
pnpm test:unit  → 14 passed (2 files)
```

## 5. Remaining gaps & prioritized roadmap

### High priority

- **Content-Security-Policy uses `'unsafe-inline'` for scripts**
  (`src/hooks.server.ts`). Move to SvelteKit's built-in nonce/hash CSP via
  `kit.csp` in `svelte.config.js` to eliminate inline-script XSS surface.
- **No Drizzle migrations** — there is no `drizzle/` directory; the app relies on
  `db:push`. Generate versioned migrations (`pnpm db:generate`) and run
  `db:migrate` in deploy so schema changes are reviewable and reversible.
- **Test coverage is still thin.** Bootstrapped, but the 33-table data layer, auth
  guards, payment guards, and API routes need integration tests
  (`vitest.integration.config.ts` exists but has no specs). Add Playwright smoke
  flows for login → board → task CRUD.

### Medium priority

- **`x-forwarded-for` trust**: rate limiting trusts the first XFF hop, which is
  spoofable unless behind a known proxy. Pin to the real client via
  `ADDRESS_HEADER`/`XFF_DEPTH` (adapter-node) and document the expected proxy.
- **Centralize feature-flag env access** through `env.ts` so call sites stop using
  ad-hoc `?? 'fallback'` defaults (esp. S3 default `minioadmin` credentials, which
  should never silently apply in production).
- **Observability**: request logging exists; add error reporting (Sentry or
  OpenTelemetry traces) and surface `requestId` to clients on 5xx for support.
- **Graceful Redis/Socket.IO shutdown** hooks for clean rolling deploys.

### Lower priority / polish

- Consider SvelteKit **remote functions** (already enabled experimentally) to
  replace some hand-rolled `/api/v1` fetch calls with type-safe RPC.
- Add `@vitest/coverage-v8` and a coverage gate in CI.
- Add a `Dockerfile` + compose (Postgres/libSQL, Redis, MinIO) for reproducible
  prod-like environments.
- Accessibility pass on the Kanban drag-and-drop (keyboard reordering).
