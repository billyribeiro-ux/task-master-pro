# TaskMaster Pro

Production-grade project management application built with SvelteKit 2, Svelte 5, and modern tooling.

## Features

- **Kanban Board** — Drag-and-drop task management with real-time updates
- **Authentication** — Email/password + GitHub & Google OAuth
- **Time Tracking** — Start/stop timers on tasks, view logged hours
- **Analytics** — Task status, priority breakdowns, completion trends
- **File Attachments** — S3-compatible presigned uploads via MinIO
- **Stripe Billing** — Subscription checkout, portal, webhooks
- **Real-Time** — Socket.IO presence and live task updates
- **Dark Mode** — System-aware theme with manual toggle

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Framework  | SvelteKit 2.50+ / Svelte 5 (runes) |
| Styling    | Tailwind CSS v4 (CSS-first)        |
| Database   | SQLite via libSQL + Drizzle ORM    |
| Auth       | Lucia pattern + Arctic OAuth       |
| Payments   | Stripe                             |
| Storage    | S3 (MinIO for local dev)           |
| Real-time  | Socket.IO                          |
| Validation | Zod                                |
| Testing    | Vitest + Playwright                |
| CI/CD      | GitHub Actions                     |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (optional, for Redis/MinIO/Stripe CLI)

### Setup

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start dev server
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` — SQLite connection string
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe
- `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` — S3 storage
- `ORIGIN` — Application URL

### Docker (Local Services)

```bash
cd docker
docker-compose up -d
```

Starts Redis, MinIO, and Stripe CLI for local development.

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `pnpm dev`         | Start dev server             |
| `pnpm build`       | Production build             |
| `pnpm preview`     | Preview production build     |
| `pnpm check`       | Type-check with svelte-check |
| `pnpm lint`        | Lint with ESLint + Prettier  |
| `pnpm format`      | Format with Prettier         |
| `pnpm test:unit`   | Run unit tests               |
| `pnpm test:e2e`    | Run Playwright e2e tests     |
| `pnpm db:generate` | Generate migrations          |
| `pnpm db:migrate`  | Run migrations               |
| `pnpm db:push`     | Push schema to DB            |
| `pnpm db:studio`   | Open Drizzle Studio          |

## Project Structure

```
src/
├── app.css                    # Tailwind v4 config
├── app.d.ts                   # Global type augmentation
├── app.html                   # HTML shell
├── hooks.server.ts            # Auth, security headers, rate limiting
├── hooks.client.ts            # Client error handler
├── lib/
│   ├── components/ui/         # Reusable UI components
│   ├── server/
│   │   ├── auth/              # Lucia-pattern auth + OAuth + guards
│   │   ├── db/                # Drizzle schema + client
│   │   ├── payments/          # Stripe + plan guards
│   │   ├── realtime/          # Socket.IO server
│   │   └── storage/           # S3 client
│   ├── stores/                # Svelte 5 rune stores
│   ├── utils/                 # Fractional indexing
│   └── validation/            # Zod schemas
└── routes/
    ├── (auth)/                # Login, Register, OAuth, Logout
    ├── (app)/                 # Authenticated app shell
    │   ├── dashboard/
    │   ├── projects/
    │   │   └── [projectId]/
    │   │       ├── board/     # Kanban board
    │   │       └── settings/  # Project settings + members
    │   ├── analytics/
    │   ├── time-tracking/
    │   ├── notifications/
    │   └── settings/
    │       └── billing/
    └── api/v1/                # REST API endpoints
```

## License

Private — All rights reserved.
