#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/codex-cloud-common.sh"

cd "${GREDICE_REPO_ROOT}"

codex_ensure_node
codex_prepare_pnpm

codex_log "Refreshing workspace dependencies from the existing package cache when possible."
pnpm install --frozen-lockfile --prefer-offline

codex_log "Codex Cloud maintenance complete."
