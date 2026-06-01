---
name: gredice-docs-auditor
description: Audit, create, or update Gredice repository documentation. Use for README, CONTRIBUTING, AGENTS.md, root guides, docs/*.md, setup docs, command docs, contributor guidance, app/package maps, validation instructions, generated artifact rules, and any change that may make documentation stale against package scripts, app registry, workspace layout, or source behavior.
---

# Gredice Docs Auditor

## Overview

Keep Gredice repository documentation accurate to the current monorepo. Prefer concrete paths, package names, commands, and ownership boundaries over generic guidance.

## Source Of Truth

Read the relevant current source before writing or auditing docs:

- Root operating guides: `AGENTS.md`, `WORKSPACE.md`, `FRONTEND.md`, `DESIGN.md`, `PRODUCT_SENSE.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, `SECURITY.md`, `SEO.md`.
- Contributor guide and repo overview: `README.md`, `CONTRIBUTING.md`.
- Package manager and scripts: root `package.json`, app/package `package.json`, `turbo.json`, `pnpm-workspace.yaml`.
- App names, local domains, ports, Vercel project names, and default dev stack: `scripts/app-registry.ts`.
- Existing focused docs: `docs/notification-workflows.md`, `docs/game-scene-performance.md`, package README files.
- Generated asset and schema rules: `WORKSPACE.md`, `RELIABILITY.md`, package scripts under `packages/storage`, `packages/cdn`, `packages/game`, and app scripts.

Use `rg` and `rg --files` first. Confirm paths exist before documenting them.

## Audit Workflow

1. Identify the doc scope: setup, app map, contributor process, API, public content, reliability, security, generated assets, or workflow behavior.
2. Read the closest existing docs and the owning source files. Do not update a broad guide from memory.
3. Check whether names, commands, paths, app domains, and validation instructions still match code.
4. Remove stale instructions when replacing behavior. Do not leave contradictory old/new guidance.
5. Keep docs repo-specific. Prefer "run `pnpm test --filter @gredice/storage`" over "run tests".
6. Keep docs scoped. Do not rewrite unrelated sections for tone or style while fixing one stale fact.

## Repo Map Facts

Use the current app registry and workspace guide as the source of truth:

- `apps/www`: public marketing, commerce, CMS-rendered pages, SEO, sitemap, public tests.
- `apps/garden`: customer garden/game experience.
- `apps/farm`: farm back office.
- `apps/app`: internal operations/admin.
- `apps/storybook`: public component documentation.
- `apps/api`: Hono API routes, Scalar API reference, API docs, Stripe cron/webhooks.
- `apps/status`: public status page, not part of default root dev.
- `packages/*`: shared packages such as `@gredice/ui`, `@gredice/client`, `@gredice/storage`, `@gredice/game`, `@gredice/transactional`, `@gredice/stripe`.
- `assets`: source brand and game assets.

Local domains come from `scripts/app-registry.ts`, not hand-written lists. The default stack is started by `pnpm dev`; `status` starts separately with `pnpm --filter=status dev`.

## Command Accuracy

Before documenting commands, check the relevant `package.json` script. Current common commands:

```bash
pnpm bootstrap
pnpm doctor
pnpm dev
pnpm dev:all
pnpm lint --filter <workspace>
pnpm typecheck --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
pnpm db-generate
pnpm regenerate
git diff --check
```

Use `pnpm install` only when the task is dependency setup. The README currently emphasizes `pnpm bootstrap`, `pnpm doctor`, and `pnpm dev` for fresh worktrees.

Document these non-negotiables when relevant:

- Runtime is Node.js `>=24`; package manager is pinned by the root `packageManager` field.
- Use `workspace:*` for internal dependencies.
- Schema changes live in `packages/storage`; run `pnpm db-generate`.
- Do not run `pnpm db-push`.
- Do not commit `node_modules`, build output, `.next`, coverage, or generated artifacts unless they are established tracked outputs required by the source change.

## Documentation Style

Write for contributors who need to act:

- Use exact app/package names and paths.
- Use exact command names and filters.
- Explain ownership boundaries when behavior spans apps and packages.
- Prefer tables only when comparing multiple items.
- Avoid future promises, vague best practices, and generic framework descriptions.
- Preserve Croatian product terms and nearby public-copy tone when documenting user-facing content.
- Call out secrets, migrations, generated assets, deployments, or manual coordination explicitly.

## Validation

For docs-only edits, run:

```bash
git diff --check
```

For docs that describe a command or generated output, run the smallest harmless check that proves the instruction is still valid. Do not run `pnpm db-push`.

If live product state matters, query the API, database, Linear, or GitHub only after the static source does not answer the question.
