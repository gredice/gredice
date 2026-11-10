# Workspace Guide

Use this guide for repo layout, setup, commands, package boundaries, and local development servers.

## Repository layout

- `apps/api`: Next.js app exposing API routes, OpenAPI documentation, Stripe cron routes, internal cron routes, and API Playwright tests.
- `apps/www`: public marketing and commerce site. It owns SEO-heavy public pages, sitemap generation, accessibility tests, and public route tests.
- `apps/news`: public Novosti app served through `www.gredice.com/novosti` for CMS-backed blog posts and changelog updates.
- `apps/garden`: customer garden experience and game-facing UI.
- `apps/farm`: farm back-office application.
- `apps/delivery`: driver route execution and customer delivery tracking.
- `apps/app`: internal operations/admin application.
- `apps/desktop`: Electron desktop release shells for `garden`, `farm`, and `app`.
- `apps/storybook`: public Storybook documentation for shared and app-adjacent UI.
- `apps/status`: public status page. It is not started by the default root dev command.
- `packages/*`: shared libraries such as `@gredice/ui`, `@gredice/auth`, `@gredice/client`, `@gredice/storage`, `@gredice/email`, `@gredice/transactional`, `@gredice/stripe`, `@gredice/game`, and integration helpers.
- `assets`: source files for brand and 3D/game assets.
- `scripts`: repo automation for development proxy, environment pull, Vercel linking, and generated assets.

## Tooling

- Runtime: Node.js `26.x`.
- Package manager: pnpm, pinned by the root `packageManager` field.
- Task runner: Turborepo.
- Formatting and linting: Biome per app/package.
- Framework: Next.js 16 with React 19 and TypeScript 7.
- Styling: Tailwind CSS 3 where applicable.
- Browser tests: Playwright.
- Node tests: Node's built-in test runner through `node --test` with `tsx` where needed.

### Playwright runner compatibility

The component-test apps (`app`, `delivery`, `farm`, `garden`, and `www`) keep
`@playwright/test` and `@playwright/experimental-ct-react` on `1.62.1`, the final
experimental React component-test release. WWW and Farm accessibility tests pass
that runner's `Page` objects to Axe, so the scoped
`@axe-core/playwright>playwright-core` override must stay on `1.62.1` too. Renovate
protects both the app manifests and that workspace override until the component
suites migrate to stories. Update these compatibility rules together when
removing the legacy runner.

`apps/api` uses `@playwright/test` `1.63.0` independently. Do not apply a global
Playwright core override or downgrade the API runner to align component tests.

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

# Build Electron desktop artifacts for garden, farm, and app
pnpm desktop:dist

# Lint the full workspace
pnpm lint

# Lint one workspace
pnpm lint --filter @gredice/storage
pnpm lint --filter garden

# Typecheck one workspace
pnpm typecheck --filter garden
pnpm typecheck --filter www

# Run tests (keep `run`: pnpm 12 applies `pnpm test --filter` as its own
# workspace filter and skips the root turbo script and its build dependency)
pnpm test
pnpm run test --filter garden

# Build
pnpm build
pnpm build --filter garden

# Generate Drizzle migrations after storage schema changes
pnpm db-generate

# Regenerate OpenAPI-derived or generated package outputs
pnpm regenerate
```

Many package lint scripts run `biome check --write`, so linting may modify files. Review the diff after linting.

### Full release CI

Manually dispatching the `CI` workflow runs every configured app/package suite,
including Next.js lint/tests and storage, Game/JS and email tests. It does not
depend on changed-file filters; ordinary PR and push filtering is preserved.

```bash
gh workflow run ci.yml --ref main
```

Record the dispatched commit SHA and final job results. A successful aggregate
from a filtered docs/dependency run does not replace a full release run.

### Directory type generation

`packages/directory-types` contains generated public directory API and CMS entity type helpers. Run this after CMS entity types or attribute definitions change:

```bash
pnpm --filter @gredice/directory-types regenerate
```

This refreshes the OpenAPI-derived `src/v1.d.ts` from the directory API docs, then regenerates deterministic CMS entity aliases in `src/cms.ts`.
Use `pnpm --filter @gredice/directory-types regenerate:cms-types` only when `src/v1.d.ts` is already current and only the alias file needs to be refreshed.

## Type checking

Use `pnpm typecheck --filter <workspace>` for a fast TypeScript compatibility check. Next.js apps run `next typegen` before the native TypeScript 7 CLI, so route, page, and layout types are generated without running a full production build. Production builds opt into Next.js' experimental `useTypeScriptCli` integration for the same compiler.

TypeScript 7 does not expose the compiler API yet. `openapi-typescript` and Storybook's transitive tsconfig and React docgen tooling still require that API, so `pnpm-workspace.yaml` gives those tools the official `@typescript/typescript6` compatibility package and applies the matching patches from `patches/`. Remove that bridge once those dependencies support the TypeScript 7 API.

For ordinary `@gredice/game` package changes, this is the default consumer compatibility check:

```bash
pnpm typecheck --filter @gredice/game
pnpm typecheck --filter garden
pnpm typecheck --filter www
```

Run `pnpm build --filter garden` or `pnpm build --filter www` only when the change affects Next.js configuration, routing, static assets, bundling behavior, production-only code paths, or when a release/sign-off requires the full build output.

## Development servers

`pnpm dev` starts the default app stack and a Dockerized Caddy HTTPS proxy.
The app names, paths, local domains, ports, and Vercel project names live in
`scripts/app-registry.ts`; update that registry when adding or renaming an app.
The dev proxy writes its Caddyfile from the registry at startup.

- `www`: <https://www.gredice.test>
- `news`: <https://novosti.gredice.test>
- `garden`: <https://vrt.gredice.test>
- `farm`: <https://farma.gredice.test>
- `delivery`: <https://dostava.gredice.test>
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
127.0.0.1 www.gredice.test novosti.gredice.test vrt.gredice.test farma.gredice.test dostava.gredice.test app.gredice.test storybook.dev.gredice.test api.gredice.test status.gredice.test
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

## UIer interface reviews

UIer is opt-in. Admin has a **Povratne informacije** switch at
`/admin/settings#feedback-settings`, Farm has the switch in `/settings`, and
Delivery has it in the authenticated app header. Public review links for WWW,
Novosti, Vrt, API documentation, Status, and Storybook are available from
[the development center](https://www.gredice.com/development).

Open a page with `?review=true` to enable its review toolbar, or
`?review=false` to disable it. The switches reload the page when changing review
mode so disabling also removes the vendor script and event handlers. Review
state uses `sessionStorage` scoped to the browser tab and app project; normal
visitors do not load the script. WWW and Novosti keep separate project sessions
even though their public routes share an origin. UIer's **Exit** control also
ends review mode.

| App | Production address | UIer project |
| --- | --- | --- |
| WWW | <https://www.gredice.com> | [Gredice WWW](https://uier.io/app/projects/05lb2p3clzi9) |
| Admin | <https://app.gredice.com/admin> | [Gredice Admin](https://uier.io/app/projects/5uauxu25b2es) |
| Farm | <https://farma.gredice.com> | [Gredice Farm](https://uier.io/app/projects/u0ivn447swyj) |
| Delivery | <https://dostava.gredice.com> | [Gredice Delivery](https://uier.io/app/projects/9lpfhdv02wr6) |
| Garden | <https://vrt.gredice.com> | [Gredice Garden](https://uier.io/app/projects/gsa1vycznbo9) |
| News | <https://www.gredice.com/novosti> | [Gredice News](https://uier.io/app/projects/9yzihw3xk5xq) |
| Status | <https://status.gredice.com> | [Gredice Status](https://uier.io/app/projects/wl3q4fzid2uh) |
| API documentation | <https://api.gredice.com> | [Gredice API](https://uier.io/app/projects/r74n9nr3hokr) |
| Storybook | <https://storybook.dev.gredice.com> | [Gredice Storybook](https://uier.io/app/projects/a8isw8pjmxtj) |

Allow each project its production address, the matching local host from
`scripts/app-registry.ts`, and its app-specific
`https://<app>-*.preview.gredice.com` preview pattern. Novosti also runs at
`https://novosti.gredice.com/novosti`; its project must stay distinct from WWW
when reviewing the shared public host. Desktop and Android wrappers reuse the
projects of the web apps they open.

Projects use private reviews with invited reviewers. Public install identifiers
in `packages/ui/src/UierReview/projects.ts` are browser configuration, not
credentials; keep account credentials and reviewer tokens out of source control.

## Environment setup

Use the Vercel CLI for local environment files. If the apps are not linked on the current machine, log in and run the repo script before pulling env vars:

```bash
vercel login
pnpm vercel:link
pnpm env:pull
```

`pnpm env:pull` runs `vercel env pull .env` in every app with a Vercel project in `scripts/app-registry.ts`, including `apps/www`, `apps/news`, `apps/garden`, `apps/farm`, `apps/delivery`, `apps/app`, `apps/storybook`, `apps/api`, and `apps/status`.

For a preview that fails with `git_info_fail` before build logs, use the
[Git retrieval recovery runbook](./docs/vercel-preview-git-recovery.md) to verify
the current PR head and retry its existing Git deployment.

### Turborepo remote cache

Turbo build/test results are cached remotely through Vercel for the `gredice` team, which speeds up cold builds locally and in CI.

- Local and worktrees: `pnpm bootstrap` runs `pnpm turbo link --yes --scope=gredice`, which writes `.turbo/config.json` for the current worktree. The link relies on Vercel CLI auth, so run `vercel login` first if it has not been done on the machine. Each linked worktree gets its own `.turbo/config.json` (the `.turbo` directory is gitignored).
- CI: only `TURBO_TEAM=gredice` is set in workflows by default. `TURBO_TOKEN` is intentionally not exported workflow-wide to avoid exposing secrets to pull-request code; remote cache auth must be provided only in tightly scoped trusted contexts.

`pnpm doctor` reports the link status under the optional "Turbo remote cache" check.

### Next.js build cache

Next.js 16.3 enables the Turbopack filesystem cache for development and
production builds by default. Vercel persists `.next/cache` automatically,
while the reusable GitHub Actions workflow persists it only when the caller
sets `nextBuildCache: true`.

### Public page revalidation

`apps/app` triggers public `apps/www` ISR revalidation after admin changes to directory plants, plant sorts, and operations. Configure the same `GREDICE_WWW_REVALIDATE_SECRET` in both apps. In production the admin app calls `https://www.gredice.com/api/revalidate/directories`; for preview or custom environments, set `GREDICE_WWW_REVALIDATE_URL` in `apps/app` to the target `www` deployment URL.

### Codex environment setup

Use a lean Codex environment for routine code tasks. Set Node.js to a current `26.x` release when the environment UI asks for an exact version. The repo-owned setup scripts also bootstrap Node.js `26.x` for their own run if the base image starts on another Node.js major, install the repository-pinned Corepack when it is missing, then use it to install the pnpm version pinned by `packageManager`.

Recommended Codex setup script:

```bash
./scripts/codex-cloud-setup.sh
```

Recommended Codex maintenance script:

```bash
./scripts/codex-cloud-maintenance.sh
```

Override the setup-time Node.js installer with `GREDICE_CODEX_NODE_VERSION=<major-or-full-version>` only when the Codex base image does not already provide Node.js `26.x` and a specific release is required.

`./scripts/codex-cloud-setup.sh` installs the `www` Playwright Chromium browser. By default it tries `playwright install --with-deps chromium`, then falls back to browser-only `playwright install chromium` if Codex Cloud's Ubuntu package mirror or apt proxy is unavailable. Set `GREDICE_CODEX_PLAYWRIGHT_WITH_DEPS=browser-only` to skip apt entirely, or `GREDICE_CODEX_PLAYWRIGHT_WITH_DEPS=required` when a task must fail fast unless OS-level Playwright dependencies install successfully.

Recommended Codex environment variables:

```bash
CI=true
NEXT_TELEMETRY_DISABLED=1
TURBO_TELEMETRY_DISABLED=1
PLAYWRIGHT_HTML_OPEN=never
```

Keep agent internet access off by default. Setup scripts already have internet access for dependency installation. If a task truly needs runtime internet access, prefer the common dependency allowlist and read-only HTTP methods.

Do not use `pnpm dev` as the default Codex validation path. It starts the local HTTPS proxy and expects Docker, host entries, and Caddy certificate setup. Use targeted `pnpm lint --filter <workspace>`, `pnpm run test --filter <workspace>`, and `pnpm build --filter <workspace>` commands instead.

Avoid `pnpm bootstrap` in Codex unless Vercel auth and project access are configured. It links projects and pulls real environment variables. For most Codex tasks, the checked-in `.env.example` files provide enough safe smoke-test configuration.

For secret-backed integration tests, create a separate Codex environment with the required Vercel credentials, then run:

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

To run multiple storage-backed suites in one worktree, give each invocation a distinct absolute `GREDICE_STORAGE_TEST_ENV_FILE` path in an existing temporary directory. Database setup, migrations, test execution, and cleanup all use that file. The API checkout integration regression creates its own temporary configuration automatically.

### Local and test environment examples

Each app now includes a checked-in `.env.example` (or `.env.test.example` where needed) with safe local defaults for smoke tests. Copy the file to `.env` in each app when starting from a fresh worktree.

- Local smoke tests should run with placeholders for analytics, email, payment, and similar nonessential integrations.
- Integration tests that validate those providers still require real secrets pulled from Vercel (`pnpm env:pull`) or another secure secret source.
- Never commit real secrets; keep examples sanitized and use them as shape documentation only.

## Asset generation

Coordinate with teammates before editing shared game asset files. Only one person should export shared asset changes at a time.

### Game assets

Game asset source files live as one Blender file per asset under
`assets/game-assets`. The manifest `assets/game-assets.json` defines which
source file exports to each runtime GLB and which assets are preloaded first.

After changing a split Blender file or the asset manifest, regenerate the
exported GLBs and model types from the repo root:

```bash
pnpm generate:game-assets
```

This runs the platform export script from `assets`, writes one GLB per asset to
`apps/garden/public/assets/models`, then runs `pnpm generate:models-types` to
update `packages/game/src/data/gameAssetModels.generated.ts` and
`packages/game/src/models/GameAssets.tsx`. Type generation uses a temporary
combined GLB under `apps/garden/.tmp` and removes it after `gltfjsx` finishes.

Blender must be installed where the export scripts expect it:

- macOS: `/Applications/Blender.app`
- Windows: `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`
- Linux/other Unix-like systems: `blender` on `PATH`, or set `BLENDER_BINARY`.

If the steps need to run separately, run `./export.sh` from `assets` on
Unix-like systems or `.\export.ps1` from `assets` on Windows, then run
`pnpm generate:models-types` from the repo root.

To recreate the split Blender files from an old monolithic source, run Blender
against `assets/split-game-assets.py` with `-- --source /path/to/GameAssets.blend`.

For the complete workflow that turns a model into a placeable and purchasable
game entity, including runtime component registration, public block screenshots,
and the directory CMS row, see [docs/game-entity-creation.md](./docs/game-entity-creation.md).

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
