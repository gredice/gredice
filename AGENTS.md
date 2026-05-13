# Welcome, AI collaborator

This repository is the **Gredice** monorepo. It hosts multiple Next.js applications, shared packages, and assets for the Gredice platform.

## First steps

- Use Node.js `>=24` and the pnpm version pinned by the root `packageManager` field.
- Install dependencies from the repo root with `pnpm install`.
- Before editing code, look for additional `AGENTS.md` files inside the path you plan to touch. Nested instructions override this file.
- Keep the worktree clean. Commit only intentional source changes and never commit `node_modules`, build output, `.next`, coverage, or generated artifacts unless explicitly requested.
- Use targeted Turbo commands from the repo root whenever possible.
- Before handing off code changes, identify the affected workspace(s) and run targeted lint, test, and build checks unless the user explicitly asks to skip validation.

## Read the relevant guides

- [WORKSPACE.md](./WORKSPACE.md): repo layout, local setup, commands, package boundaries, and development servers.
- [FRONTEND.md](./FRONTEND.md): Next.js, React, TypeScript, shared UI, Storybook, and app structure rules.
- [DESIGN.md](./DESIGN.md): visual design standards for product, marketing, admin, farm, garden, and Storybook work.
- [PRODUCT_SENSE.md](./PRODUCT_SENSE.md): Gredice product expectations, user roles, language, and domain behavior.
- [QUALITY_SCORE.md](./QUALITY_SCORE.md): quality rubric, validation commands, type standards, and review expectations.
- [RELIABILITY.md](./RELIABILITY.md): data integrity, migrations, background work, observability, and failure handling.
- [SECURITY.md](./SECURITY.md): auth, secrets, data exposure, validation, payments, and unsafe rendering.
- [SEO.md](./SEO.md): metadata, structured data, sitemap, canonical URL, and public page rules.

## Non-negotiables

- Reuse existing packages and UI before adding new utilities or components.
- Use `workspace:*` for internal package dependencies.
- Do not duplicate shared TypeScript types. Prefer inferred types, use `unknown` instead of `any`, and avoid `as` assertions.
- Schema changes live in `packages/storage`; run `pnpm db-generate` after editing schema.
- Do not run `pnpm db-push`. Database migrations are applied manually during deployment.
- For shared PRs, leave new migration files out of version control unless explicitly requested.
- Follow existing Biome, TypeScript, React, Next.js, Tailwind, and package conventions.

## Task validation

For code changes, use the narrowest reliable validation set from the repo root:

```bash
pnpm lint --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
```

Examples:

```bash
pnpm lint --filter garden
pnpm test --filter garden
pnpm build --filter garden
```

For shared package changes, also validate the consuming app(s) that exercise the changed behavior. For storage changes, run `pnpm test --filter @gredice/storage` and build affected consumers such as `app`, `api`, or `farm`.

If validation cannot run because of missing secrets, unavailable services, or time constraints, state exactly which command was skipped and why.

## GitHub issues

- Use GitHub Issue Type as the primary kind: `Feature` for larger product capabilities or umbrella work, `Task` for concrete implementation slices, and `Bug` for broken or incorrect behavior.
- Use labels for routing and context, not as a replacement for issue type. Apply the existing area, package, feature, asset, documentation, test, enhancement, epic, and AI-origin labels that match the issue. Use multiple labels when work spans multiple apps or packages, and do not create near-duplicate labels.
- Title issues with the existing square-bracket scope convention when a clear product, domain, or workstream exists, for example `[CMS] Pages - define Page structure` or `[Field] Ability to see diary and history if field had plants before`. Use a short imperative or outcome-focused title for devex/tooling tasks when labels already carry the scope.
- For product and feature work, prefer issue bodies with `User story`, `Current-system notes`, `Scope`, and `Acceptance criteria` sections. For internal tooling or reliability work, use `Goal`, `Context`, `Scope`, and `Acceptance criteria`, adding `Blocked by` when sequencing matters.
- For umbrella issues, link implementation issues with a checklist, include a suggested implementation order, and call out dependency relationships with issue references such as `#2501`. Mark these with the epic label when they group related work.
- Milestones are not used by default in this repo; only add one when explicitly requested.

## Quick commands

```bash
pnpm install
pnpm dev
pnpm lint --filter garden
pnpm test --filter garden
pnpm build --filter garden
```

For full command guidance, see [WORKSPACE.md](./WORKSPACE.md).
