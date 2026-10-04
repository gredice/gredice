# AI collaborator notes

Gredice is a Next.js/Turborepo monorepo with apps, shared packages, docs, and assets.

## Start here

- Use Node.js `>=24` and the pnpm version pinned in `packageManager`.
- Check for nested `AGENTS.md` files before editing; nested files override this one.
- Read only the guide that matches the change:
  - [WORKSPACE.md](./WORKSPACE.md): layout, setup, commands, dev servers.
  - [FRONTEND.md](./FRONTEND.md): Next.js, React, TypeScript, UI structure.
  - [DESIGN.md](./DESIGN.md): visual standards.
  - [PRODUCT_SENSE.md](./PRODUCT_SENSE.md): product language and roles.
  - [QUALITY_SCORE.md](./QUALITY_SCORE.md): validation and review expectations.
  - [RELIABILITY.md](./RELIABILITY.md): data, migrations, background work.
  - [SECURITY.md](./SECURITY.md): auth, secrets, private data.
  - [SEO.md](./SEO.md): public metadata, structured data, sitemap.

## Rules

- Reuse existing packages, UI, types, and patterns before adding new ones.
- Use `workspace:*` for internal package dependencies.
- Prefer inferred TypeScript types; use `unknown` over `any`; avoid `as` assertions.
- Keep schema work in `packages/storage`; run `pnpm db-generate`; never run `pnpm db-push`.
- Do not commit `node_modules`, build output, `.next`, coverage, or generated files unless the generated artifact is expected for the source change.
- Preserve user changes already in the worktree.

## Validation

Run commands from the repo root. Use the narrowest relevant checks from [QUALITY_SCORE.md](./QUALITY_SCORE.md), usually filtered `lint`, `typecheck`, `test`, or `build`. For docs-only edits, `git diff --check` is enough.

If a check cannot run, state the skipped command and reason.

## GitHub issues

Use Issue Type as the primary kind: `Feature`, `Task`, or `Bug`. Use existing labels for area/package/context, keep the square-bracket scope convention when clear, and use the section templates in [CONTRIBUTING.md](./CONTRIBUTING.md).
