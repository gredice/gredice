#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PACKAGE_ROOT/.env.test"

CONTAINER_NAME="${GREDICE_TEST_DB_CONTAINER:-}"
DB_PROVIDER="${GREDICE_TEST_DB_PROVIDER:-}"
FALLBACK_DB_NAME="${GREDICE_TEST_DB_NAME:-}"
FALLBACK_ADMIN_URL="${GREDICE_TEST_DB_ADMIN_URL:-}"
if [[ -z "$CONTAINER_NAME" && -f "$ENV_FILE" ]]; then
    CONTAINER_NAME="$(awk -F= '$1 == "GREDICE_TEST_DB_CONTAINER" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
fi
if [[ -z "$DB_PROVIDER" && -f "$ENV_FILE" ]]; then
    DB_PROVIDER="$(awk -F= '$1 == "GREDICE_TEST_DB_PROVIDER" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
fi
if [[ -z "$FALLBACK_DB_NAME" && -f "$ENV_FILE" ]]; then
    FALLBACK_DB_NAME="$(awk -F= '$1 == "GREDICE_TEST_DB_NAME" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
fi
if [[ -z "$FALLBACK_ADMIN_URL" && -f "$ENV_FILE" ]]; then
    FALLBACK_ADMIN_URL="$(awk -F= '$1 == "GREDICE_TEST_DB_ADMIN_URL" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
fi

if [[ "$DB_PROVIDER" == "fallback" ]]; then
    if [[ -z "$FALLBACK_DB_NAME" || -z "$FALLBACK_ADMIN_URL" ]]; then
        echo "Fallback storage test database details are missing in $ENV_FILE; nothing to stop."
        exit 0
    fi

    echo "Dropping fallback storage test database: $FALLBACK_DB_NAME"
    node --input-type=module -e "
import { Client } from 'pg';
const adminUrl = process.argv[1];
const dbName = process.argv[2];
const client = new Client({ connectionString: adminUrl });
await client.connect();
await client.query(\`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \$1 AND pid <> pg_backend_pid()\`, [dbName]);
await client.query(\`DROP DATABASE IF EXISTS \"\${dbName.replaceAll('\"', '\"\"')}\"\`);
await client.end();
" "$FALLBACK_ADMIN_URL" "$FALLBACK_DB_NAME"
    exit 0
fi

if [[ -z "$CONTAINER_NAME" ]]; then
    echo "No storage test database container recorded in $ENV_FILE; nothing to stop."
    exit 0
fi

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
    echo "Stopping storage test database container: $CONTAINER_NAME"
    docker stop "$CONTAINER_NAME" >/dev/null
else
    echo "Storage test database container already stopped: $CONTAINER_NAME"
fi
