#!/usr/bin/env bash
# Builds and (re)starts the stack from whatever is currently checked out in
# this repo, waits for backend+frontend to report healthy, and prunes
# dangling images left behind by the rebuild. Assumes the working tree is
# already at the commit you want deployed -- this script does not touch git;
# that's the caller's job (see .github/workflows/ci.yml's `deploy` job,
# which does `git fetch && git reset --hard origin/main` before invoking
# this). Kept separate on purpose: a script rewriting itself mid-execution
# via `git reset --hard` while bash is still reading it is a real, if
# obscure, way to corrupt the running process.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Deploys via the Cloudflare Tunnel profile (no host port published) --
# see README.md's "Docker" section for why. Swap these two lines for plain
# `docker compose up -d --build` if you later put a real reverse proxy in
# front instead.
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.tunnel-only.yml --profile tunnel)

echo "==> Building and starting containers"
"${COMPOSE[@]}" up -d --build

wait_healthy() {
  local container="$1"
  for _ in $(seq 1 30); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null)" = "healthy" ]; then
      return 0
    fi
    sleep 2
  done
  echo "==> $container did not become healthy within 60s" >&2
  docker logs --tail=50 "$container" >&2
  return 1
}

echo "==> Waiting for backend"
wait_healthy bountyhunter-backend-1

echo "==> Waiting for frontend"
wait_healthy bountyhunter-frontend-1

echo "==> Cleaning up dangling images from the rebuild"
docker image prune -f >/dev/null

echo "==> Deploy complete"
"${COMPOSE[@]}" ps
