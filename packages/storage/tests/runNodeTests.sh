#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PACKAGE_ROOT"

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    bash ./tests/stopTestDb.sh || true
    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

bash ./tests/startTestDb.sh
bash ./tests/migrateTestDb.sh
node --import tsx --test --env-file=.env.test --conditions=react-server "./tests/**/*.node.spec.ts"
