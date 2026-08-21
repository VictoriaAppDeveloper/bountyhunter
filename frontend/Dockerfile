# syntax=docker/dockerfile:1

# --- build ------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter frontend...
COPY frontend ./frontend
RUN pnpm --filter frontend run build

# --- runtime ------------------------------------------------------------------
# nginx-unprivileged: same nginx image, but pre-configured to listen on 8080
# and run its worker processes as a non-root user out of the box, instead of
# needing our own USER/port surgery on top of the stock nginx image.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O- http://127.0.0.1:8080/ >/dev/null || exit 1
