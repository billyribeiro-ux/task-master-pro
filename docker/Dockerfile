# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# ─── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S sveltekit -u 1001
WORKDIR /app

COPY --from=build --chown=sveltekit:nodejs /app/build ./build
COPY --from=build --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=sveltekit:nodejs /app/package.json ./
COPY --from=build --chown=sveltekit:nodejs /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

USER sveltekit
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "build"]
