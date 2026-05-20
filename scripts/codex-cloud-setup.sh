#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/codex-cloud-common.sh"

cd "${GREDICE_REPO_ROOT}"

codex_ensure_node
codex_prepare_pnpm

codex_log "Installing workspace dependencies."
pnpm install --frozen-lockfile

codex_log "Creating safe local env files from checked-in examples."
codex_copy_example_env_files

codex_log "Installing Chromium for the www Playwright workspace."
pnpm --filter www exec playwright install --with-deps chromium

codex_log "Validating CI path filters."
pnpm lint:ci-filters

codex_log "Codex Cloud setup complete."
