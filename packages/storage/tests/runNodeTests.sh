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

# Storage specs share one disposable database, so run files serially to keep
# cross-spec fixtures from racing through global farm and event state.
NODE_TEST_ARGS=(--import tsx --import ./tests/testSetup.ts --test --test-concurrency=1 --env-file=.env.test --conditions=react-server)

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
