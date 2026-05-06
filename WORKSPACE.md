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
- Package manager: pnpm `10.33.2`.
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

## Type checking

Type checking is integrated into Next.js builds and package scripts. To validate app or package types, build the consuming app or run the targeted package test/build command that exercises the change.

## Development servers

`pnpm dev` starts the default app stack and a Dockerized Caddy HTTPS proxy.

- `www`: <https://www.gredice.test>
- `garden`: <https://vrt.gredice.test>
- `farm`: <https://farma.gredice.test>
- `app`: <https://app.gredice.test>
- `storybook`: <https://storybook.gredice.test>
- `api`: <https://api.gredice.test>
- `status`: <https://status.gredice.test> with `pnpm --filter=status dev`

Hosts file entry:

```text
127.0.0.1 www.gredice.test vrt.gredice.test farma.gredice.test app.gredice.test storybook.gredice.test api.gredice.test status.gredice.test
```

Docker must be running for the proxy. Use `SKIP_DEV_PROXY=1 pnpm dev` only when the local proxy is not needed.

## Generated files

- Do not commit build output, caches, `.next`, coverage, Storybook static output, or `node_modules`.
- Generated TypeScript and assets may be committed only when the source change requires it and the generated file is an established tracked artifact.
- For database migrations, follow [RELIABILITY.md](./RELIABILITY.md).
