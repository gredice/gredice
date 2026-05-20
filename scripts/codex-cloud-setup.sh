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

case "${GREDICE_CODEX_PLAYWRIGHT_WITH_DEPS:-auto}" in
  0 | false | no | browser-only)
    codex_log "Installing Chromium for the www Playwright workspace without apt-managed OS dependencies."
    pnpm --filter www exec playwright install chromium
    ;;
  1 | true | yes | required)
    codex_log "Installing Chromium for the www Playwright workspace with apt-managed OS dependencies."
    pnpm --filter www exec playwright install --with-deps chromium
    ;;
  auto | '')
    codex_log "Installing Chromium for the www Playwright workspace with apt-managed OS dependencies when available."
    if ! pnpm --filter www exec playwright install --with-deps chromium; then
      codex_log "Playwright OS dependency install failed; retrying Chromium browser-only install."
      pnpm --filter www exec playwright install chromium
    fi
    ;;
  *)
    codex_die "GREDICE_CODEX_PLAYWRIGHT_WITH_DEPS must be auto, required, true, false, yes, no, 1, 0, or browser-only."
    ;;
esac

codex_log "Validating CI path filters."
pnpm lint:ci-filters

codex_log "Codex Cloud setup complete."
