#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$project_dir/.env" ]; then
  echo "Missing .env" >&2
  exit 1
fi
set -a
. "$project_dir/.env"
set +a

backend_port="${BACKEND_PORT:-${PORT:-3000}}"
frontend_port="${FRONTEND_PORT:-$((backend_port + 1))}"
app_port="$frontend_port"
export BACKEND_PORT="$backend_port" FRONTEND_PORT="$frontend_port"
export NEXT_PUBLIC_APP_URL="http://127.0.0.1:${frontend_port}"

if [ "${NODE_ENV:-}" = "test" ]; then
  export ENCRYPTION_KEY="${ENCRYPTION_KEY:-${MEMORY_ENCRYPTION_KEY_BASE64:-}}"
  export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:${app_port}}"
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: ./start.sh"
  echo "Startup never installs packages, creates/resets/seeds a database, rewrites .env, or kills processes."
  echo "Apply reviewed migrations separately with: npm run db:deploy"
  exit 0
fi

if [ "$#" -ne 0 ]; then
  echo "Unknown argument: $1"
  exit 2
fi

for required in DATABASE_URL JWT_SECRET ENCRYPTION_KEY NEXT_PUBLIC_APP_URL; do
  if [ -z "${!required:-}" ]; then
    echo "Missing required environment variable: ${required}"
    exit 1
  fi
done

if [ ! -d node_modules ]; then
  echo "Dependencies are missing. Run npm ci as a separate reviewed setup step."
  exit 1
fi

for assigned_port in "$backend_port" "$frontend_port"; do
  if lsof -nP -iTCP:"$assigned_port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Assigned port $assigned_port is already occupied" >&2
    exit 1
  fi
done

echo "Starting AI Documentation Assistant API proxy on ${backend_port} and UI on ${frontend_port}; persistent state is unchanged."
if [ "${NODE_ENV:-development}" = "production" ]; then
  npm run start -- -H 127.0.0.1 -p "$frontend_port" & app_pid=$!
else
  npm run dev -- -H 127.0.0.1 -p "$frontend_port" & app_pid=$!
fi
node "$project_dir/scripts/runtime-api-proxy.mjs" & proxy_pid=$!
cleanup(){ trap - EXIT INT TERM; kill "$app_pid" "$proxy_pid" 2>/dev/null || true; wait "$app_pid" "$proxy_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$app_pid" "$proxy_pid"
