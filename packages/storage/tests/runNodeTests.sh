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

DB_PROVIDER="$(awk -F= '$1 == "GREDICE_TEST_DB_PROVIDER" { value = substr($0, index($0, "=") + 1) } END { print value }' .env.test)"
NODE_TEST_ARGS=(--import tsx --import ./tests/testSetup.ts --test --env-file=.env.test --conditions=react-server)
if [[ "$DB_PROVIDER" == "pglite" ]]; then
    NODE_TEST_ARGS+=(--test-concurrency=1)
fi

TEST_FILES=("$@")
if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
    TEST_FILES=("./tests/**/*.node.spec.ts")
else
    for i in "${!TEST_FILES[@]}"; do
        case "${TEST_FILES[$i]}" in
            /*|./*|../*) ;;
            tests/*) TEST_FILES[$i]="./${TEST_FILES[$i]}" ;;
            *) TEST_FILES[$i]="./tests/${TEST_FILES[$i]}" ;;
        esac
    done
fi

node "${NODE_TEST_ARGS[@]}" "${TEST_FILES[@]}"
