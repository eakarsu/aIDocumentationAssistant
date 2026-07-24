#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
else
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD
fi
unset demo_credentials_email demo_credentials_password demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

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
