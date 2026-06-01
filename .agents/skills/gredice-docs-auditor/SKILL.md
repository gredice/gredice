---
name: gredice-docs-auditor
description: Use for Gredice repo docs: README, CONTRIBUTING, AGENTS, root guides, docs, setup/commands, app/package maps, validation, generated artifacts.
---

# Gredice Docs Auditor

Keep docs accurate to source. Use exact paths, package names, commands, and ownership boundaries.

## Source Of Truth

- Root guides: `AGENTS.md`, `WORKSPACE.md`, `FRONTEND.md`, `DESIGN.md`, `PRODUCT_SENSE.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, `SECURITY.md`, `SEO.md`.
- Repo overview and contributor flow: `README.md`, `CONTRIBUTING.md`.
- Commands and packages: root/app/package `package.json`, `turbo.json`, `pnpm-workspace.yaml`.
- Apps, domains, ports, Vercel project names, and default dev stack: `scripts/app-registry.ts`.
- Focused docs: `docs/*`, package READMEs.
- Generated asset/schema rules: `WORKSPACE.md`, `RELIABILITY.md`, and scripts under `packages/storage`, `packages/cdn`, `packages/game`, `assets`.

Use `rg`/`rg --files` first and confirm paths exist.

## Workflow

1. Identify scope: setup, app map, contributor process, API, public content, reliability, security, generated assets, or workflow behavior.
2. Read the closest doc and owning source before editing.
3. Check names, commands, paths, app domains, and validation instructions against source.
4. Remove stale or repeated guidance instead of layering new text over it.
5. Keep docs scoped and repo-specific.

## Stable Facts

- App/package map lives in `WORKSPACE.md`; local domains come from `scripts/app-registry.ts`.
- Runtime is Node.js `>=24`; pnpm is pinned by `packageManager`.
- Internal deps use `workspace:*`.
- Schema changes live in `packages/storage`; run `pnpm db-generate`; do not run `pnpm db-push`.
- Do not commit build output, caches, `.next`, coverage, `node_modules`, or unexpected generated files.

## Style

- Prefer brief, actionable text over framework explanations.
- Link to the source guide instead of repeating setup or validation blocks.
- Preserve Croatian product terms and nearby public-copy tone.
- Call out secrets, migrations, generated assets, deployments, or manual coordination explicitly.

## Validation

Docs-only: `git diff --check`. If docs describe a command or generated output, run the smallest harmless check that proves it. Query live systems only when source cannot answer the question.
