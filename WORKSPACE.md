# Workspace Guide

Use this guide for repo layout, setup, commands, package boundaries, and local development servers.

## Repository layout

- `apps/api`: Next.js app exposing API routes, OpenAPI documentation, Stripe cron routes, internal cron routes, and API Playwright tests.
- `apps/www`: public marketing and commerce site. It owns SEO-heavy public pages, sitemap generation, accessibility tests, and visual tests.
- `apps/garden`: customer garden experience and game-facing UI.
- `apps/farm`: farm back-office application.
- `apps/app`: internal operations/admin application.
- `apps/storybook`: public Storybook documentation for shared and app-adjacent UI.
- `apps/status`: public status page. It is not started by the default root dev command.
- `packages/*`: shared libraries such as `@gredice/ui`, `@gredice/client`, `@gredice/storage`, `@gredice/email`, `@gredice/transactional`, `@gredice/stripe`, `@gredice/game`, and integration helpers.
- `assets`: source files for brand and 3D/game assets.
- `scripts`: repo automation for development proxy, environment pull, Vercel linking, and generated assets.

## Tooling

- Runtime: Node.js `>=24`.
- Package manager: pnpm, pinned by the root `packageManager` field.
- Task runner: Turborepo.
- Formatting and linting: Biome per app/package.
- Framework: Next.js 16 with React 19 and TypeScript 6.
- Styling: Tailwind CSS 3 where applicable.
- Browser tests: Playwright.
- Node tests: Node's built-in test runner through `node --test` with `tsx` where needed.

## Package boundaries

- Use `workspace:*` versions for internal dependencies.
- Add shared code to an existing package when the behavior is reused by more than one app.
- Keep app-only behavior inside the app that owns the workflow.
- Check existing exports before adding a new package export.
- If you add a new workspace package or script, update the relevant `package.json`, `pnpm-workspace.yaml`, and Turbo task only when needed.

## Commands

Run commands from the repo root unless an app/package script explicitly requires its own directory.

```bash
# Install dependencies
pnpm install

# Link every app to its Vercel project
pnpm vercel:link

# Pull Vercel environment variables for all apps
pnpm env:pull

# Start the default development stack with the local HTTPS proxy
pnpm dev

# Lint the full workspace
pnpm lint

# Lint one workspace
pnpm lint --filter @gredice/storage
pnpm lint --filter garden

# Run tests
pnpm test
pnpm test --filter garden

# Build
pnpm build
pnpm build --filter garden

# Generate Drizzle migrations after storage schema changes
pnpm db-generate

# Regenerate OpenAPI-derived or generated package outputs
pnpm regenerate
```

Many package lint scripts run `biome check --write`, so linting may modify files. Review the diff after linting.

### Directory type generation

`packages/directory-types` contains generated public directory API and CMS entity type helpers. Run this after CMS entity types or attribute definitions change:

```bash
pnpm --filter @gredice/directory-types regenerate
```

This refreshes the OpenAPI-derived `src/v1.d.ts` from the directory API docs, then regenerates deterministic CMS entity aliases in `src/cms.ts`.
Use `pnpm --filter @gredice/directory-types regenerate:cms-types` only when `src/v1.d.ts` is already current and only the alias file needs to be refreshed.

## Type checking

Type checking is integrated into Next.js builds and package scripts. To validate app or package types, build the consuming app or run the targeted package test/build command that exercises the change.

## Development servers

`pnpm dev` starts the default app stack and a Dockerized Caddy HTTPS proxy.
The app names, paths, local domains, ports, and Vercel project names live in
`scripts/app-registry.ts`; update that registry when adding or renaming an app.
The dev proxy writes its Caddyfile from the registry at startup.

- `www`: <https://www.gredice.test>
- `garden`: <https://vrt.gredice.test>
- `farm`: <https://farma.gredice.test>
- `app`: <https://app.gredice.test>
- `storybook`: <https://storybook.dev.gredice.test>
- `api`: <https://api.gredice.test>
- `status`: <https://status.gredice.test> with `pnpm --filter=status dev`

Dev server ports are worktree-aware. App ports use the registry base port plus
the current worktree's deterministic offset, and linked Git worktrees use proxy
ports derived from the same offset instead of binding `80` and `443`. This lets
a feature/Codex worktree run the same app beside a normal local checkout. The
dev script prints the effective URL for each app; when the HTTPS proxy port is
not `443`, use the printed port-qualified form such as
`https://vrt.gredice.test:8001`. Override the derived slot with
`GREDICE_PORT_OFFSET`, or force proxy ports with `GREDICE_PROXY_HTTP_PORT` and
`GREDICE_PROXY_HTTPS_PORT`.

The dev script verifies the hosts entries for the local `gredice.test` domains and attempts to add missing entries automatically. If it cannot modify the hosts file, add this entry manually and rerun the command:

```text
127.0.0.1 www.gredice.test vrt.gredice.test farma.gredice.test app.gredice.test storybook.dev.gredice.test api.gredice.test status.gredice.test
```

Docker must be running for the proxy. Use `SKIP_DEV_PROXY=1 pnpm dev` only when the local proxy is not needed.

Only one default Caddy proxy can bind ports `80` and `443` at a time. Starting
`pnpm dev` from another worktree stops older `gredice-dev-caddy*` containers
that are holding those ports, then starts the proxy for the current worktree. To
run another proxy concurrently, set `GREDICE_PROXY_HTTP_PORT` and
`GREDICE_PROXY_HTTPS_PORT` and include the HTTPS port in local URLs.

### Development HTTPS certificates

The local Caddy proxy terminates HTTPS. Its internal certificate authority is
stored in `~/.gredice/dev-caddy/<worktree-slug>` unless
`GREDICE_DEV_CADDY_DATA_DIR` points somewhere else. The dev script attempts to
trust the certificate authority automatically for the current OS.

If automatic trust fails, import `root.crt` manually from the Caddy data directory:

- macOS: import `root.crt` into Keychain Access and mark it as trusted for SSL.
- Windows: open `certmgr.msc`, then import `root.crt` into Trusted Root Certification Authorities.
- Linux: run `trust anchor ~/.gredice/dev-caddy/<worktree-slug>/caddy/pki/authorities/local/root.crt`, or use the distribution's certificate tooling.

After the certificate is trusted, browsers should accept the local `gredice.test` HTTPS domains.

## Environment setup

Use the Vercel CLI for local environment files. If the apps are not linked on the current machine, log in and run the repo script before pulling env vars:

```bash
vercel login
pnpm vercel:link
pnpm env:pull
```

`pnpm env:pull` runs `vercel env pull .env` in `apps/www`, `apps/garden`, `apps/farm`, `apps/app`, `apps/storybook`, `apps/api`, and `apps/status`.

### Public page revalidation

`apps/app` triggers public `apps/www` ISR revalidation after admin changes to directory plants, plant sorts, and operations. Configure the same `GREDICE_WWW_REVALIDATE_SECRET` in both apps. In production the admin app calls `https://www.gredice.com/api/revalidate/directories`; for preview or custom environments, set `GREDICE_WWW_REVALIDATE_URL` in `apps/app` to the target `www` deployment URL.

### Codex environment setup

Use a lean Codex environment for routine code tasks. Pin Node.js to `24.15.0` when the environment UI asks for an exact version, and use Corepack to install the pnpm version pinned by `packageManager`.

Recommended Codex setup script:

```bash
set -euo pipefail

corepack enable
corepack install

pnpm install --frozen-lockfile

for f in apps/*/.env.example packages/*/.env.example; do
  target="${f%.example}"
  [ -f "$target" ] || cp "$f" "$target"
done

pnpm --filter www exec playwright install --with-deps chromium
pnpm lint:ci-filters
```

Recommended Codex maintenance script:

```bash
set -euo pipefail

corepack enable
corepack install
pnpm install --frozen-lockfile --prefer-offline
```

Recommended Codex environment variables:

```bash
CI=true
NEXT_TELEMETRY_DISABLED=1
TURBO_TELEMETRY_DISABLED=1
PLAYWRIGHT_HTML_OPEN=never
```

Keep agent internet access off by default. Setup scripts already have internet access for dependency installation. If a task truly needs runtime internet access, prefer the common dependency allowlist and read-only HTTP methods.

Do not use `pnpm dev` as the default Codex validation path. It starts the local HTTPS proxy and expects Docker, host entries, and Caddy certificate setup. Use targeted `pnpm lint --filter <workspace>`, `pnpm test --filter <workspace>`, and `pnpm build --filter <workspace>` commands instead.

Avoid `pnpm bootstrap` in Codex unless Vercel auth and project access are configured. It links projects and pulls real environment variables. For most Codex tasks, the checked-in `.env.example` files provide enough safe smoke-test configuration.

For secret-backed integration or visual tests, create a separate Codex environment with the required Vercel credentials, then run:

```bash
npm i -g vercel@latest
pnpm vercel:link
pnpm env:pull
```

## Storage test database (Docker, local Postgres, and PGlite)

`@gredice/storage` tests start a disposable Postgres database automatically through `pnpm --filter @gredice/storage test`.

- **Default path (Docker available):** uses a disposable Docker Postgres container.
- **Local Postgres fallback:** set `GREDICE_STORAGE_TEST_DB_ADMIN_URL` to a local Postgres admin connection URL (for example `postgres://postgres:postgres@127.0.0.1:5432/postgres`). The test scripts will create a unique per-run database, run migrations/tests, and drop that database during cleanup.
- **Embedded fallback:** when Docker is unavailable and no local Postgres admin URL is configured, the scripts use a temporary PGlite database so limited environments such as Codex can still run storage repository tests.

Use Docker or local Postgres when validating behavior that depends on exact Postgres server semantics. The embedded fallback is intended for routine repository tests in service-limited environments.

### Local and test environment examples

Each app now includes a checked-in `.env.example` (or `.env.test.example` where needed) with safe local defaults for smoke tests. Copy the file to `.env` in each app when starting from a fresh worktree.

- Local smoke tests should run with placeholders for analytics, email, payment, and similar nonessential integrations.
- Integration or visual tests that validate those providers still require real secrets pulled from Vercel (`pnpm env:pull`) or another secure secret source.
- Never commit real secrets; keep examples sanitized and use them as shape documentation only.

## Asset generation

Coordinate with teammates before editing shared game asset files. Only one person should export shared asset changes at a time.

### Game assets

After changing `assets/GameAssets.blend`, regenerate the exported GLB and model types from the repo root:

```bash
pnpm generate:game-assets
```

This runs the platform export script from `assets`, writes `apps/garden/public/assets/models/GameAssets.glb`, then runs `pnpm generate:models-types` to update `packages/game/src/models/GameAssets.tsx` through `gltfjsx` and the local post-processing script.

Blender must be installed where the export scripts expect it:

- macOS: `/Applications/Blender.app`
- Windows: `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`
- Linux/other Unix-like systems: update `assets/export.sh` for the local Blender path before running the generator.

If the steps need to run separately, run `./export.sh` from `assets` on Unix-like systems or `.\export.ps1` from `assets` on Windows, then run `pnpm generate:models-types` from the repo root.

### Decoration sprite atlas

The decoration atlas pipeline lives in `packages/cdn/scripts` and currently processes source sheets from `apps/garden/data/sriptes`. Regenerate the ground-cover atlas with:

```bash
pnpm --filter @gredice/cdn run regenerate-cdn:decoration-atlas
```

The script extracts source sprites, packs them into stable atlas pages, and writes PNG, WebP, and JSON manifest files under `apps/garden/public/assets/sprites/decorations`. The manifest is the runtime source of truth. Keep sprite names stable, because the manifest uses relative input paths as sprite IDs.

## Generated files

- Do not commit build output, caches, `.next`, coverage, Storybook static output, or `node_modules`.
- Generated TypeScript and assets may be committed only when the source change requires it and the generated file is an established tracked artifact.
- For database migrations, follow [RELIABILITY.md](./RELIABILITY.md).
