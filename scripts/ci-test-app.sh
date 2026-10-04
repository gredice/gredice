#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${TEST_ARGS:-}" ]]; then
    pnpm run test --filter="$CI_APP_NAME" --cache=local:rw
else
    pnpm build --filter="$CI_APP_NAME" --cache=local:rw
    if [[ -n "$CI_PREPARE_SCRIPT" ]]; then
        pnpm --dir "$CI_APP_PATH" run "$CI_PREPARE_SCRIPT"
    fi
    read -r -a shard_args <<< "$TEST_ARGS"
    pnpm --dir "$CI_APP_PATH" run "$CI_RUN_SCRIPT" "${shard_args[@]}"
fi
