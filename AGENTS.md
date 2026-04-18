# Agents — TaskMaster Pro

This file instructs coding agents (Claude, Copilot, Cursor, Windsurf, Codex, Gemini, etc.) on how to work effectively in this repo.

## Stack at a glance

- **Runtime:** Node.js 22+, Svelte 5 runes, SvelteKit 2.57+
- **Build:** Vite 8, `@sveltejs/vite-plugin-svelte` 7, `@sveltejs/adapter-node` 5
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`) with `@theme` custom properties in `src/app.css`
- **State:** Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), `SvelteMap`/`SvelteSet` from `svelte/reactivity`, `bp` breakpoint singleton in `src/lib/stores/breakpoints.svelte.ts`
- **Data:** Drizzle ORM (SQLite/libSQL), Zod v4 validation, Lucia-style sessions with Arctic OAuth
- **Realtime:** Socket.IO for presence/tasks, Yjs + `y-websocket` for collaborative editing
- **Testing:** Vitest 4 (unit/integration), Playwright 1.59 (e2e)

## Svelte MCP server

The Svelte team ships an official MCP server at `https://mcp.svelte.dev/mcp`. This project pre-declares it in `.mcp.json` for clients that read that file.

**You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:**

### Available Svelte MCP tools

1. **`list-sections`** — Use this FIRST to discover all available documentation sections. Returns a structured list with titles, `use_cases`, and paths. When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

2. **`get-documentation`** — Retrieves full documentation content for specific sections. Accepts single or multiple sections. After calling `list-sections`, you MUST analyze the `use_cases` field and then fetch ALL documentation sections relevant to the user's task at once.

3. **`svelte-autofixer`** — Analyzes Svelte code and returns issues/suggestions. You MUST use this whenever writing Svelte code, before sending it to the user. Keep calling it until no issues or suggestions remain.

4. **`playground-link`** — Generates a Svelte Playground link for the provided code. Only use this when the code is NOT being written to a file in this project, and only after user confirmation.

## House rules

- **Svelte 5 only.** Do not introduce `export let`, `$:` reactive declarations, `on:` event directives, `createEventDispatcher`, or `<slot>` elements. Use runes, attachment attributes (`onclick={…}`), callback props, and `{@render children()}`.
- **Use `SvelteMap`/`SvelteSet`** from `svelte/reactivity` when mutable reactive collections are needed. Plain `Map`/`Set` will trip `svelte/prefer-svelte-reactivity`.
- **Internal navigation uses `resolve()`** from `$app/paths`. For dynamic routes use the full generated route ID, e.g. `resolve('/(app)/projects/[projectId]/board', { projectId })`.
- **Tailwind v4 migration:** use `bg-linear-to-*` (not `bg-gradient-to-*`), `outline-2` (no redundant `outline` utility), and named spacing utilities (e.g. `min-h-11`) instead of arbitrary values when a canonical one exists.
- **Pre-filled form state** should be initialized with `let x = $state(data.foo.bar)` plus `// svelte-ignore state_referenced_locally` — the initial capture is intentional so user edits are not clobbered on re-render. Do not sync props to local state via `$effect`.
- **Server code:** validate all inputs with Zod, guard requests with `requireAuth`/`requireProjectAccess` from `$lib/server/auth/guards.ts`, prefer parameterised Drizzle queries.
- **Route groups are real:** the app lives under `(app)` / `(auth)`. Generated route IDs include those segments.

## Useful commands

```sh
pnpm install         # install deps
pnpm dev             # Vite dev server
pnpm check           # svelte-kit sync + svelte-check
pnpm lint            # Prettier + ESLint (flat config)
pnpm format          # Prettier --write
pnpm build           # Production build via adapter-node
pnpm test:unit       # Vitest unit tests
pnpm test:e2e        # Playwright e2e tests
pnpm db:push         # Drizzle schema push to SQLite
```

## Before submitting changes

1. `pnpm check` — must pass with 0 errors / 0 warnings
2. `pnpm lint` — must be clean
3. `pnpm build` — must succeed
4. When touching Svelte components, run the `svelte-autofixer` MCP tool on the final source
