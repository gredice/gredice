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

if ! grep -Eq '^POSTGRES_URL=postgres://postgres:postgres@(localhost|127\.0\.0\.1):[0-9]+/gredice_test$' "$ENV_FILE"; then
    echo "Refusing to run storage test migrations because $ENV_FILE does not point at the local disposable test database." >&2
    exit 1
fi

pnpm exec tsx --env-file="$ENV_FILE" --conditions=react-server ./src/migrate.ts
