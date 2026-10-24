#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PACKAGE_ROOT"

# Storage runs in UTC on CI and in production; pin it so date-boundary specs
# behave the same on developer machines in other time zones.
export TZ=UTC

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

# Node 24 can abort while collecting PGlite's released WASM import wrappers.
# Keep this workaround test-only until https://github.com/nodejs/node/issues/66366 is fixed.
if [[ "$(node -p 'process.versions.node.split(".")[0]')" == "24" ]]; then
    NODE_TEST_ARGS+=(--no-wasm-code-gc)
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
