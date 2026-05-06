# Welcome, AI collaborator

This repository is the **Gredice** monorepo. It hosts multiple Next.js applications, shared packages, and assets for the Gredice platform.

## First steps

- Use Node.js `>=24` and pnpm `10.33.2`.
- Install dependencies from the repo root with `pnpm install`.
- Before editing code, look for additional `AGENTS.md` files inside the path you plan to touch. Nested instructions override this file.
- Keep the worktree clean. Commit only intentional source changes and never commit `node_modules`, build output, `.next`, coverage, or generated artifacts unless explicitly requested.
- Use targeted Turbo commands from the repo root whenever possible.

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

## Quick commands

```bash
pnpm install
pnpm dev
pnpm lint --filter garden
pnpm test --filter garden
pnpm build --filter garden
```

For full command guidance, see [WORKSPACE.md](./WORKSPACE.md).
