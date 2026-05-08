#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PACKAGE_ROOT/.env.test"

cd "$PACKAGE_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Run pnpm run test:db:start before test migrations." >&2
    exit 1
fi

if ! grep -qx 'TEST_ENV=1' "$ENV_FILE"; then
    echo "Refusing to run storage test migrations because TEST_ENV=1 is missing from $ENV_FILE." >&2
    exit 1
fi

DB_PROVIDER="$(awk -F= '$1 == "GREDICE_TEST_DB_PROVIDER" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
if [[ "$DB_PROVIDER" == "pglite" ]]; then
    if ! grep -Eq '^GREDICE_TEST_DB_PGLITE_DIR=/.+' "$ENV_FILE"; then
        echo "Refusing to run storage test migrations because GREDICE_TEST_DB_PGLITE_DIR is missing from PGlite config in $ENV_FILE." >&2
        exit 1
    fi
elif [[ "$DB_PROVIDER" == "fallback" ]]; then
    if ! grep -Eq '^POSTGRES_URL=postgres://.+' "$ENV_FILE"; then
        echo "Refusing to run storage test migrations because POSTGRES_URL is missing from fallback config in $ENV_FILE." >&2
        exit 1
    fi
else
    if ! grep -Eq '^POSTGRES_URL=postgres://postgres:postgres@127\.0\.0\.1:[0-9]+/gredice_test$' "$ENV_FILE"; then
        echo "Refusing to run storage test migrations because $ENV_FILE does not point at the local disposable Docker test database." >&2
        exit 1
    fi
fi

./node_modules/.bin/tsx --env-file="$ENV_FILE" --conditions=react-server ./src/migrate.ts
