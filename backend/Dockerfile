# syntax=docker/dockerfile:1

# --- deps -----------------------------------------------------------------
# Installs the full workspace deps (not --prod): the backend is run through
# tsx, same as `pnpm start` locally, so tsx/typescript stay runtime deps here
# too. better-sqlite3 needs a C++ toolchain if no prebuilt binary matches the
# target platform/arch, so it's present in this stage (and dropped in the
# final image below).
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter backend...

# --- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY backend/tsconfig.json backend/
COPY backend/drizzle ./backend/drizzle
COPY backend/drizzle.config.ts backend/
COPY backend/src ./backend/src

# The data dir is created (and owned by the unprivileged `node` user that
# ships in the base image) before the volume is first mounted, so the named
# volume in docker-compose.yml inherits these permissions instead of coming
# up root-owned.
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node

WORKDIR /app/backend
ENV PORT=3001 \
    DB_PATH=/app/backend/data/bounties.db
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/tsx", "src/server.ts"]
