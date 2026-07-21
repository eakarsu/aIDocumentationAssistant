#!/usr/bin/env bash
set -euo pipefail

app_port="${PORT:-3000}"

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

echo "Starting AI Documentation Assistant on port ${app_port}; persistent state is unchanged."
if [ "${NODE_ENV:-development}" = "production" ]; then
  exec npm run start -- -H 127.0.0.1 -p "$app_port"
else
  exec npm run dev -- -H 127.0.0.1 -p "$app_port"
fi
