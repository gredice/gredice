#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PACKAGE_ROOT/.env.test"

CONTAINER_NAME="${GREDICE_TEST_DB_CONTAINER:-}"
if [[ -z "$CONTAINER_NAME" && -f "$ENV_FILE" ]]; then
    CONTAINER_NAME="$(awk -F= '$1 == "GREDICE_TEST_DB_CONTAINER" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
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
