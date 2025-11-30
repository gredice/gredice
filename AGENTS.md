# Welcome, AI collaborator

This repository is the **Gredice** monorepo. It hosts several Next.js applications, supporting packages, and shared assets that power the Gredice platform.

## Quick start checklist

- Use **Node.js** and **pnpm**.
- Install dependencies from the repo root with `pnpm install`.
- Before editing code, look for additional `AGENTS.md` files inside the path you plan to touch—nested instructions override this file.
- Keep the worktree clean: run the relevant lint/tests locally and commit only intentional changes (never commit `node_modules` or build artifacts).
- Use linting commands to check and format edited files.

## Repository layout

- `apps/`
  - `api/`: Next.js app exposing API routes and OpenAPI generation.
  - `app/`, `garden/`, `farm/`, `www/`: Product-facing Next.js front-ends (each with its own scripts, linting, and Playwright setup).
- `packages/`: Shared libraries (client SDK, storage, UI kit, transactional email helpers, payment integration, etc.). Use pnpm workspaces to depend on these via `workspace:*` versions.
- `assets/`: Source files for 3D game assets.
- `turbo.json`, `pnpm-workspace.yaml`, and app-level `package.json` files coordinate Turborepo tasks, workspace scopes, and scripts.

## Conventions and standards

- Don't create new components or utilities without checking for existing ones in `@gredice/ui` or other shared packages.
- If a UI component is not present in `@gredice/ui`, consider contributing it there if it has potential for reuse across applications.
- Do not create multiple components in same file, split them into separate files.

## TypeScript types

- Don't create types that duplicate existing ones. Reuse types from shared packages whenever possible.
- Don't create types that can be inferred by TypeScript.
- When types are unknown, use `unknown` instead of `any` to ensure type safety.
- Avoid using `as` type assertions.

## Database & storage tooling

- Schema changes live under `packages/storage`.
- Don't apply migrations. The DB migrations will be applied manually after reviewing changes.

## Package dependencies

- Use `workspace:*` versions for internal package dependencies in `package.json` files.
- Common shared packages (not all listed):
  - `@gredice/storage`: Database schema and migrations using Drizzle ORM
  - `@gredice/email`: Email sending utilities
  - `@gredice/ui`: Shared UI components with Tailwind CSS
  - `@gredice/client`: API client SDK
  - `@gredice/transactional`: Email templates and components
  - `@gredice/stripe`: Payment integration utilities
  - `@gredice/game`: Game-related components and models

## Collaboration tips

- When introducing new scripts or workspace packages, update the relevant `package.json` and workspace manifests.
- Follow the repo's existing TypeScript, React, and Biome conventions.

## Common commands reference

```bash
# Install dependencies for entire monorepo
pnpm install

# Lint entire workspace
pnpm lint

# Lint specific package
pnpm lint --filter @gredice/storage

# Lint and apply fixes to specific app/package (from app/package directory)
pnpm lint --filter @gredice/storage -- --write

# Run tests for all packages
pnpm test

# Run tests for specific app
pnpm test --filter garden

# Build all apps
pnpm build

# Build specific app
pnpm build --filter garden
```

## Using commands

- To check types for packages, build the app that consumes them, as type checking is integrated into the Next.js build process.
- Prefer targeted Turborepo commands (`pnpm <COMMAND> --filter ...`) to speed up workflows during development and CI validation.

## Development servers

- **Development servers**: Use `pnpm dev` to start all apps, then you can access them at:
  - `www`: <https://www.gredice.test>
  - `garden`: <https://vrt.gredice.test>
  - `farm`: <https://farma.gredice.test>
  - `app`: <https://app.gredice.test>
  - `api`: <https://api.gredice.test>
