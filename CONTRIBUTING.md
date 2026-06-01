# Contributing

Follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Keep changes scoped, reuse existing packages, and validate the work that changed.

## Before you start

- Read [WORKSPACE.md](./WORKSPACE.md) for setup, commands, app map, package boundaries, and dev servers.
- Read the guide that matches your work: [FRONTEND.md](./FRONTEND.md), [DESIGN.md](./DESIGN.md), [PRODUCT_SENSE.md](./PRODUCT_SENSE.md), [QUALITY_SCORE.md](./QUALITY_SCORE.md), [RELIABILITY.md](./RELIABILITY.md), [SECURITY.md](./SECURITY.md), or [SEO.md](./SEO.md).
- Search existing issues and PRs.
- Discuss larger product, schema, architecture, payment, inventory, delivery, or auth changes first.

## Local setup

Use Node.js `>=24`, pnpm from `packageManager`, Docker, and the Vercel CLI. See [WORKSPACE.md](./WORKSPACE.md) for the full setup and local domains.

Common path:

```bash
pnpm install
pnpm bootstrap
pnpm doctor
pnpm dev
```

## Development

- Reuse existing packages, UI, dependencies, and conventions.
- Use `workspace:*` for internal dependencies.
- Keep app-only behavior in the owning app; share code only when reuse is real.
- Prefer inferred TypeScript types, `unknown` over `any`, and avoid `as` assertions.
- Validate server-boundary data and do not expose secrets or private data.
- Preserve auth, authorization, cache invalidation, analytics, observability, and failure handling.
- Do not commit ignored build/cache output or generated artifacts unless they are established tracked outputs required by the change.

## Database and generated assets

- Schema changes live in `packages/storage`; run `pnpm db-generate`; do not run `pnpm db-push`.
- Leave new migration files out of shared PRs unless maintainers request them.
- Use repo generation scripts for game assets and model types; do not hand-edit generated model output.
- Coordinate shared asset source changes.

## Validation

Use [QUALITY_SCORE.md](./QUALITY_SCORE.md): run the narrowest relevant root command, usually filtered `lint`, `typecheck`, `test`, or `build`. Broaden checks for shared packages, critical flows, routing, static assets, production behavior, or visual/user-flow changes.

For docs-only changes, run `git diff --check`. Review the diff after linting because some lint scripts write fixes.

## Issues

- Use Issue Type as the primary kind: `Feature`, `Task`, or `Bug`.
- Use existing labels for area/package/context; do not create near-duplicates.
- Use square-bracket scopes when clear, for example `[CMS] Pages - define Page structure`.
- Product/feature issues: `User story`, `Current-system notes`, `Scope`, `Acceptance criteria`.
- Internal/reliability issues: `Goal`, `Context`, `Scope`, `Acceptance criteria`, and `Blocked by` when needed.
- Umbrella issues should checklist child work, call out ordering/dependencies, and use the `epic` label.

## Pull requests

- Keep the PR focused.
- Include relevant tests, stories, or docs updates.
- Include validation results and skipped checks with reasons.
- Mention schema changes, generated assets, environment requirements, migrations, or deployment coordination.
