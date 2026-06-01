# Contributing to Gredice

Thank you for contributing to Gredice. This repository is a Turborepo monorepo for multiple Next.js applications, shared packages, documentation, and assets. Contributions are easiest to review when they are scoped, grounded in the existing packages, and validated with targeted commands.

Please also follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

- Read [WORKSPACE.md](./WORKSPACE.md) for repo layout, local setup, commands, package boundaries, and development servers.
- Read the guide that matches your change: [FRONTEND.md](./FRONTEND.md), [DESIGN.md](./DESIGN.md), [PRODUCT_SENSE.md](./PRODUCT_SENSE.md), [QUALITY_SCORE.md](./QUALITY_SCORE.md), [RELIABILITY.md](./RELIABILITY.md), [SECURITY.md](./SECURITY.md), or [SEO.md](./SEO.md).
- Search existing issues and pull requests before opening duplicate work.
- Discuss larger product, schema, architecture, payment, inventory, delivery, or auth changes before investing heavily in implementation.
- Keep changes focused. Separate unrelated fixes, refactors, generated output, and feature work into different pull requests.

## Local setup

Use Node.js `>=24`, the pnpm version pinned by `packageManager`, Docker, and the Vercel CLI.

```bash
pnpm install
vercel login
pnpm vercel:link
pnpm env:pull
pnpm dev
```

The default dev command starts the main apps through local HTTPS domains:

- `apps/www`: <https://www.gredice.test>
- `apps/garden`: <https://vrt.gredice.test>
- `apps/farm`: <https://farma.gredice.test>
- `apps/app`: <https://app.gredice.test>
- `apps/storybook`: <https://storybook.dev.gredice.test>
- `apps/api`: <https://api.gredice.test>

The `status` app is not part of the default dev stack. Start it separately when needed:

```bash
pnpm --filter=status dev
```

## Development guidelines

- Reuse existing packages and UI before adding new utilities, components, dependencies, or packages.
- Use `workspace:*` for internal package dependencies.
- Keep app-only behavior inside the owning app. Move shared behavior into an existing package only when reuse is real.
- Do not duplicate shared TypeScript types. Prefer inferred types, use `unknown` instead of `any`, and avoid `as` assertions.
- Validate data at server boundaries and avoid exposing secrets or private data to the client.
- Preserve existing auth, authorization, cache invalidation, analytics, observability, and failure-handling patterns.
- Do not commit `node_modules`, `.next`, build output, coverage, Storybook static output, or other generated artifacts unless the generated file is an established tracked artifact required by the source change.

## Database and generated assets

Database schema changes live in `packages/storage`.

```bash
pnpm db-generate
```

Run `pnpm db-generate` after editing schema. Do not run `pnpm db-push`. For shared pull requests, leave new migration files out of version control unless maintainers explicitly request them.

For game assets, use the existing generation scripts instead of hand-editing generated model output:

```bash
pnpm generate:game-assets
pnpm generate:models-types
```

Coordinate with maintainers before changing shared game asset sources.

## Validation

Run targeted commands from the repo root. Choose the smallest check that covers the change, then broaden when the change touches shared behavior or critical flows. Run typecheck where the workspace provides it.

```bash
pnpm lint --filter <workspace>
pnpm typecheck --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
```

Examples:

```bash
pnpm lint --filter garden
pnpm typecheck --filter garden
pnpm test --filter garden
pnpm build --filter www
pnpm test --filter @gredice/storage
```

For ordinary `@gredice/game` package changes, validate the package and run `garden`/`www` typechecks instead of building and testing both apps every time. Run the app builds or Playwright suites when app routing, static assets, bundling, production behavior, visual behavior, or user flows changed.

For docs-only changes, run:

```bash
git diff --check
```

Note that some lint scripts run `biome check --write` and may modify files. Review the diff after linting.

## Issues

Use GitHub Issue Type as the primary kind:

- `Feature` for larger product capabilities or umbrella work.
- `Task` for concrete implementation slices.
- `Bug` for broken or incorrect behavior.

Use labels for routing and context, including existing area, package, feature, asset, documentation, test, enhancement, epic, and AI-origin labels. Do not create near-duplicate labels.

Use the existing square-bracket scope convention when a clear scope exists, such as `[CMS] Pages - define Page structure` or `[Field] Ability to see diary and history if field had plants before`.

For product and feature issues, prefer these sections:

- `User story`
- `Current-system notes`
- `Scope`
- `Acceptance criteria`

For internal tooling or reliability issues, prefer:

- `Goal`
- `Context`
- `Scope`
- `Acceptance criteria`
- `Blocked by`, when sequencing matters

Umbrella issues should link implementation issues with a checklist, include a suggested implementation order, call out dependencies with issue references, and use the `epic` label.

## Pull requests

Before opening a pull request:

- Confirm the change is scoped to the requested behavior.
- Include relevant tests, stories, or docs updates for user-facing and shared behavior.
- Run the targeted validation commands and include the results in the pull request description.
- Call out skipped checks and why they were skipped.
- Mention schema changes, generated assets, environment requirements, migrations, or deployment coordination explicitly.
- Keep pull request descriptions concrete enough for reviewers to understand the user impact and the technical shape of the change.
