#!/usr/bin/env bash

# Shared helpers for Codex Cloud setup scripts. Keep this file shell-only:
# these scripts must run before workspace dependencies are installed.

GREDICE_CODEX_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREDICE_REPO_ROOT="$(cd "${GREDICE_CODEX_SCRIPT_DIR}/.." && pwd)"
GREDICE_CODEX_REQUIRED_NODE_MAJOR="${GREDICE_CODEX_REQUIRED_NODE_MAJOR:-24}"
GREDICE_CODEX_NODE_VERSION="${GREDICE_CODEX_NODE_VERSION:-${GREDICE_CODEX_REQUIRED_NODE_MAJOR}}"
GREDICE_CODEX_CACHE_DIR="${GREDICE_CODEX_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME}/.cache}/gredice-codex}"

codex_log() {
  printf '[codex-cloud] %s\n' "$*"
}

codex_die() {
  printf '[codex-cloud] ERROR: %s\n' "$*" >&2
  exit 1
}

codex_node_major() {
  command -v node >/dev/null 2>&1 || return 1
  node -p "process.versions.node.split('.')[0]" 2>/dev/null
}

codex_node_is_supported() {
  local major
  major="$(codex_node_major || true)"
  [[ "${major}" =~ ^[0-9]+$ ]] && (( major >= GREDICE_CODEX_REQUIRED_NODE_MAJOR ))
}

codex_load_nvm() {
  local nvm_dir="${NVM_DIR:-${HOME}/.nvm}"
  local candidate

  for candidate in \
    "${nvm_dir}/nvm.sh" \
    "${HOME}/.nvm/nvm.sh" \
    "/usr/local/opt/nvm/nvm.sh" \
    "/opt/homebrew/opt/nvm/nvm.sh" \
    "/usr/local/share/nvm/nvm.sh"; do
    if [ -s "${candidate}" ]; then
      # shellcheck disable=SC1090
      . "${candidate}"
      return 0
    fi
  done

  return 1
}

codex_try_nvm_node() {
  codex_load_nvm || return 1
  codex_log "Installing Node.js ${GREDICE_CODEX_NODE_VERSION} with nvm."
  nvm install "${GREDICE_CODEX_NODE_VERSION}" || return 1
  nvm use "${GREDICE_CODEX_NODE_VERSION}" || return 1
  codex_node_is_supported
}

codex_try_fnm_node() {
  command -v fnm >/dev/null 2>&1 || return 1
  codex_log "Installing Node.js ${GREDICE_CODEX_NODE_VERSION} with fnm."
  fnm install "${GREDICE_CODEX_NODE_VERSION}" || return 1
  eval "$(fnm env --shell bash)"
  fnm use "${GREDICE_CODEX_NODE_VERSION}" || return 1
  codex_node_is_supported
}

codex_try_mise_node() {
  local install_path

  command -v mise >/dev/null 2>&1 || return 1
  codex_log "Installing Node.js ${GREDICE_CODEX_NODE_VERSION} with mise."
  mise install "node@${GREDICE_CODEX_NODE_VERSION}" || return 1
  install_path="$(mise where "node@${GREDICE_CODEX_NODE_VERSION}" 2>/dev/null || true)"
  if [ -n "${install_path}" ] && [ -x "${install_path}/bin/node" ]; then
    export PATH="${install_path}/bin:${PATH}"
  fi
  codex_node_is_supported
}

codex_try_volta_node() {
  command -v volta >/dev/null 2>&1 || return 1
  codex_log "Installing Node.js ${GREDICE_CODEX_NODE_VERSION} with Volta."
  volta install "node@${GREDICE_CODEX_NODE_VERSION}" || return 1
  codex_node_is_supported
}

codex_download_to_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${url}" -o "${output}"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -q "${url}" -O "${output}"
    return
  fi

  codex_die "Need curl or wget to download Node.js ${GREDICE_CODEX_NODE_VERSION}."
}

codex_resolve_binary_node_version() {
  local requested="${GREDICE_CODEX_NODE_VERSION#v}"
  local index_file

  if [[ "${requested}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    printf '%s\n' "${requested}"
    return
  fi

  if ! [[ "${requested}" =~ ^[0-9]+$ ]]; then
    codex_die "GREDICE_CODEX_NODE_VERSION must be a major version or full semver version."
  fi

  index_file="$(mktemp)"
  codex_download_to_file "https://nodejs.org/dist/index.json" "${index_file}"

  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("node:fs");
      const major = process.argv[1];
      const releases = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
        .filter((release) => release.version.startsWith(`v${major}.`))
        .sort((a, b) => {
          const av = a.version.slice(1).split(".").map(Number);
          const bv = b.version.slice(1).split(".").map(Number);
          return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2];
        });
      if (releases.length === 0) {
        process.exit(1);
      }
      console.log(releases[0].version.slice(1));
    ' "${requested}" "${index_file}" || codex_die "Could not resolve latest Node.js ${requested}.x release."
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "${requested}" "${index_file}" <<'PY' || codex_die "Could not resolve latest Node.js release."
import json
import sys

major = sys.argv[1]
with open(sys.argv[2], encoding="utf-8") as handle:
    releases = [release for release in json.load(handle) if release["version"].startswith(f"v{major}.")]

if not releases:
    raise SystemExit(1)

def version_key(release):
    return tuple(int(part) for part in release["version"][1:].split("."))

print(sorted(releases, key=version_key, reverse=True)[0]["version"][1:])
PY
  else
    codex_die "Need node or python3 to resolve latest Node.js ${requested}.x release."
  fi

  rm -f "${index_file}"
}

codex_node_binary_platform() {
  local node_os
  local node_arch

  case "$(uname -s)" in
    Linux) node_os="linux" ;;
    Darwin) node_os="darwin" ;;
    *) codex_die "Unsupported OS for Node.js binary fallback: $(uname -s)." ;;
  esac

  case "$(uname -m)" in
    x86_64 | amd64) node_arch="x64" ;;
    arm64 | aarch64) node_arch="arm64" ;;
    *) codex_die "Unsupported architecture for Node.js binary fallback: $(uname -m)." ;;
  esac

  printf '%s %s\n' "${node_os}" "${node_arch}"
}

codex_install_binary_node() {
  local version
  local platform
  local node_os
  local node_arch
  local cache_root
  local install_dir
  local archive_name
  local archive_path
  local extract_dir

  version="$(codex_resolve_binary_node_version)"
  platform="$(codex_node_binary_platform)"
  node_os="${platform%% *}"
  node_arch="${platform##* }"
  cache_root="${GREDICE_CODEX_CACHE_DIR}/node"
  archive_name="node-v${version}-${node_os}-${node_arch}.tar.xz"
  install_dir="${cache_root}/node-v${version}-${node_os}-${node_arch}"

  if [ -x "${install_dir}/bin/node" ]; then
    codex_log "Using cached Node.js ${version} from ${install_dir}."
    export PATH="${install_dir}/bin:${PATH}"
    return
  fi

  mkdir -p "${cache_root}"
  archive_path="${cache_root}/${archive_name}"
  extract_dir="$(mktemp -d "${cache_root}/node-extract.XXXXXX")"

  codex_log "Downloading Node.js ${version} for ${node_os}-${node_arch}."
  codex_download_to_file "https://nodejs.org/dist/v${version}/${archive_name}" "${archive_path}"
  tar -xJf "${archive_path}" -C "${extract_dir}" --strip-components=1
  rm -rf "${install_dir}"
  mv "${extract_dir}" "${install_dir}"
  rm -f "${archive_path}"

  export PATH="${install_dir}/bin:${PATH}"
}

codex_ensure_node() {
  local detected="not found"

  if codex_node_is_supported; then
    codex_log "Using Node.js $(node --version)."
    return
  fi

  if command -v node >/dev/null 2>&1; then
    detected="$(node --version)"
  fi

  codex_log "Node.js >=${GREDICE_CODEX_REQUIRED_NODE_MAJOR} is required; detected ${detected}."
  codex_try_nvm_node && return
  codex_try_fnm_node && return
  codex_try_mise_node && return
  codex_try_volta_node && return
  codex_install_binary_node

  if ! codex_node_is_supported; then
    codex_die "Node.js bootstrap completed but node is still $(node --version 2>/dev/null || printf 'not found')."
  fi

  codex_log "Using Node.js $(node --version)."
}

codex_prepare_pnpm() {
  command -v corepack >/dev/null 2>&1 || codex_die "Corepack is not available after Node.js setup."

  codex_log "Preparing pnpm from the root packageManager field."
  corepack enable
  corepack install
  codex_log "Using pnpm $(pnpm --version)."
}

codex_copy_example_env_files() {
  local example
  local target
  local examples

  shopt -s nullglob
  examples=(apps/*/.env.example packages/*/.env.example)

  if [ "${#examples[@]}" -eq 0 ]; then
    codex_log "No .env.example files found."
    return
  fi

  for example in "${examples[@]}"; do
    target="${example%.example}"
    if [ ! -f "${target}" ]; then
      cp "${example}" "${target}"
      codex_log "Created ${target}."
    fi
  done
}
