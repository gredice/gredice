#!/usr/bin/env bash
set -euo pipefail

# Dependency/browser installation happens before this entrypoint. Test children
# inherit a namespace with no NIC or default route, including raw TCP clients,
# browser redirects, workers and subprocesses. The Actions runner stays online.
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ci-isolated-tests.sh"
if [[ "${1:-}" != "--inside" ]]; then
    [[ "$(uname -s)" == Linux ]] || { echo 'CI network isolation requires Linux.' >&2; exit 1; }
    exec sudo --preserve-env env "PATH=$PATH" unshare --net bash -c '
        ip link set lo up
        exec runuser --preserve-environment -u "$1" -- bash "$2" --inside "${@:3}"
    ' bash "$(id -un)" "$SCRIPT_PATH" "$@"
fi
shift

export GREDICE_CI_NETWORK_ISOLATION=1 GREDICE_CI_BLOB_FIXTURES=1
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$(dirname "$SCRIPT_PATH")/ci-blob-network-guard.mjs"
export NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
unset TURBO_TOKEN VERCEL_TOKEN
export VERCEL_ENV=development NEXT_PUBLIC_VERCEL_ENV=development
export GREDICE_API_HOST=http://127.0.0.1:45450 GREDICE_NEWS_HOST=http://127.0.0.1:45450
export GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE=true
export NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$(dirname "$SCRIPT_PATH")/ci-font-fixtures.cjs"
node "$(dirname "$SCRIPT_PATH")/ci-api-fixtures.mjs" &
CI_API_PID=$!
CI_DB_DIR=""
cleanup() {
    kill "$CI_API_PID" 2>/dev/null || true
    if [[ -n "$CI_DB_DIR" ]]; then
        "$PG_BIN/pg_ctl" -D "$CI_DB_DIR/data" -m immediate stop >/dev/null
        rm -rf "$CI_DB_DIR"
    fi
}
trap cleanup EXIT
node --input-type=module -e '
    for (let attempt = 0; attempt < 50; attempt++) {
        try { if ((await fetch("http://127.0.0.1:45450/health")).ok) process.exit(0); } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Local CI fixture API did not start.");
'

if [[ "${1:-}" == "--database" ]]; then
    shift
    PG_BIN="$(pg_config --bindir)"
    CI_DB_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/gredice-ci-db.XXXXXX")"
    "$PG_BIN/initdb" -D "$CI_DB_DIR/data" -U postgres --auth=trust --no-locale >/dev/null
    "$PG_BIN/pg_ctl" -D "$CI_DB_DIR/data" -l "$CI_DB_DIR/postgres.log" \
        -o "-h 127.0.0.1 -p 5432 -k $CI_DB_DIR" -w start >/dev/null
    "$PG_BIN/createdb" -h 127.0.0.1 -U postgres gredice_ci
    export TEST_ENV=1 POSTGRES_URL=postgresql://postgres@127.0.0.1:5432/gredice_ci
    export GREDICE_STORAGE_TEST_DB_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres
    export CMS_PAGES_PREVIEW_SECRET="$(openssl rand -hex 32)"
    (cd packages/storage && pnpm exec tsx --conditions=react-server src/migrate.ts)
    (cd packages/storage && pnpm exec tsx --conditions=react-server scripts/seedCiCatalogue.ts)
fi

# Do not exec: the EXIT trap owns the disposable PostgreSQL process.
"$@"
