#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3201}"
WEB_PORT="${WEB_PORT:-3200}"
API_HOST="${API_HOST:-0.0.0.0}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
LOG_LEVEL="${LOG_LEVEL:-info}"
DATABASE_URL="${DATABASE_URL:-postgresql://team_platform:team_platform@127.0.0.1:15432/team_platform?schema=public}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:16379}"
REDIS_KEY_PREFIX="${REDIS_KEY_PREFIX:-team_platform:}"
AUTH_TOKEN_SECRET="${AUTH_TOKEN_SECRET:-team-platform-local-dev-secret}"
WEB_API_BASE_URL="${WEB_API_BASE_URL:-/api/platform}"
PLATFORM_API_INTERNAL_URL="${PLATFORM_API_INTERNAL_URL:-http://localhost:${API_PORT}}"
HEALTH_CHECK_ALLOWED_HOSTS="${HEALTH_CHECK_ALLOWED_HOSTS:-localhost:3100,localhost:3201}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing command: $1" >&2
    exit 1
  fi
}

stop_screen() {
  local name="$1"
  screen -S "$name" -X quit >/dev/null 2>&1 || true
}

assert_port_free() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is already in use" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2
    exit 1
  fi
}

wait_port_free() {
  local port="$1"
  local attempts="${2:-20}"
  for _ in $(seq 1 "$attempts"); do
    if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  assert_port_free "$port"
}

stop_platform_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  for pid in $pids; do
    local cwd
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { print substr($0, 2); exit }')"
    if [[ "$cwd" == "$ROOT_DIR"* ]]; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

require_command docker
require_command pnpm
require_command screen
require_command curl

mkdir -p tmp

docker compose up -d

DATABASE_URL="$DATABASE_URL" \
  pnpm --filter @team-platform/api exec prisma migrate deploy --schema prisma/schema.prisma

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  DATABASE_URL="$DATABASE_URL" \
  REDIS_URL="$REDIS_URL" \
  REDIS_KEY_PREFIX="$REDIS_KEY_PREFIX" \
  AUTH_TOKEN_SECRET="$AUTH_TOKEN_SECRET" \
  WEB_API_BASE_URL="$WEB_API_BASE_URL" \
  PLATFORM_API_INTERNAL_URL="$PLATFORM_API_INTERNAL_URL" \
  pnpm build
fi

stop_screen team-platform-api
stop_screen team-platform-web
stop_platform_port "$API_PORT"
stop_platform_port "$WEB_PORT"
wait_port_free "$API_PORT"
wait_port_free "$WEB_PORT"
assert_port_free "$API_PORT"
assert_port_free "$WEB_PORT"

screen -dmS team-platform-api bash -lc "
  cd \"$ROOT_DIR\" &&
  DATABASE_URL=\"$DATABASE_URL\" \
  REDIS_URL=\"$REDIS_URL\" \
  REDIS_KEY_PREFIX=\"$REDIS_KEY_PREFIX\" \
  HEALTH_CHECK_ALLOWED_HOSTS=\"$HEALTH_CHECK_ALLOWED_HOSTS\" \
  AUTH_TOKEN_SECRET=\"$AUTH_TOKEN_SECRET\" \
  NODE_ENV=production \
  ENVIRONMENT=\"$ENVIRONMENT\" \
  LOG_LEVEL=\"$LOG_LEVEL\" \
  API_HOST=\"$API_HOST\" \
  API_PORT=\"$API_PORT\" \
  pnpm --filter @team-platform/api start >> tmp/team-platform-api.log 2>&1
"

screen -dmS team-platform-web bash -lc "
  cd \"$ROOT_DIR\" &&
  NODE_ENV=production \
  ENVIRONMENT=\"$ENVIRONMENT\" \
  LOG_LEVEL=\"$LOG_LEVEL\" \
  WEB_PORT=\"$WEB_PORT\" \
  WEB_API_BASE_URL=\"$WEB_API_BASE_URL\" \
  PLATFORM_API_INTERNAL_URL=\"$PLATFORM_API_INTERNAL_URL\" \
  pnpm --filter @team-platform/web exec next start -p \"$WEB_PORT\" >> tmp/team-platform-web.log 2>&1
"

sleep 3

curl -fsS "http://localhost:${API_PORT}/health/ready" >/dev/null
curl -fsS "http://localhost:${WEB_PORT}" >/dev/null

echo "team-platform is running"
echo "web: http://localhost:${WEB_PORT}"
echo "api upstream: http://localhost:${API_PORT}"
echo "api through web: http://localhost:${WEB_PORT}/api/platform/health/ready"
echo "logs: tmp/team-platform-api.log, tmp/team-platform-web.log"
