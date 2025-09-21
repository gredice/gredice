# Welcome, AI collaborator

This repository is the **Gredice** monorepo. It hosts several Next.js applications, supporting packages, and shared assets that power the Gredice platform. The notes below will help you ramp up quickly and work safely.

## Quick start checklist

- ✅ Use **Node.js** and **pnpm**.
- ✅ Install dependencies from the repo root with `pnpm install`.
- ✅ Before editing code, look for additional `AGENTS.md` files inside the path you plan to touch—nested instructions override this file.
- ✅ Keep the worktree clean: run the relevant lint/tests locally and commit only intentional changes (never commit `node_modules` or build artifacts).
- ✅ Use Biome for linting and formatting (configured in individual `biome.json` files).

## Repository layout

- `apps/`
  - `api/`: Next.js app exposing API routes and OpenAPI generation.
  - `app/`, `garden/`, `farm/`, `www/`: Product-facing Next.js front-ends (each with its own scripts, linting, and Playwright setup).
- `packages/`: Shared libraries (client SDK, storage, UI kit, transactional email helpers, payment integration, etc.). Use pnpm workspaces to depend on these via `workspace:*` versions.
- `assets/`: Source files for 3D game assets. Running `./export.sh` regenerates `game-assets.glb` in `apps/garden/public/assets/models`.
- `turbo.json`, `pnpm-workspace.yaml`, and app-level `package.json` files coordinate Turborepo tasks, workspace scopes, and scripts.

## Core workflows

- **Development servers**: Use `pnpm dev` from the repo root for the turborepo pipeline, or `pnpm dev --filter <app>` to focus on a single application.
  - `www`: <http://localhost:3000>
  - `garden`: <http://localhost:3001>
  - `farm`: <http://localhost:3002>
  - `app`: <http://localhost:3003>
  - `api`: <http://localhost:3005>
- **Linting**: Run `pnpm lint` for the full workspace. Individual apps/packages use [Biome](https://biomejs.dev) with `biome check`; you can lint a single target with `pnpm lint --filter <name>`.
- **Formatting**: Use `pnpm biome check --write` to apply Biome formatting for single module, or `biome check --write` within individual package directories.
- **Testing**: Use `pnpm test` to execute the configured Turborepo test tasks. Many apps expose Playwright-powered suites (`pnpm test:run --filter www`, etc.). Scope tests to the area you modified whenever possible.
- **Builds**: Validate production builds with `pnpm build`, or filter down to specific packages/apps as needed.

## Conventions and standards

- Don't create new components or utilities without checking for existing ones in `@gredice/ui` or other shared packages.
- If a component is not present in `@gredice/ui`, consider contributing it there if it has potential for reuse and general applicability.

## Database & storage tooling

- Schema changes live under `packages/storage`. Use `pnpm db-generate` after modifying the schema to create migrations.
- NEVER apply migrations with `pnpm db-push`, the DB migrations will be applied automatically during deployment.

## Assets workflow

- Regenerate 3D assets by running `./export.sh` inside the `assets/` directory. Ensure no one else is working on the GLB at the same time to prevent merge conflicts.
- The export script uses Blender to convert `GameAssets.blend` to `GameAssets.glb` in `apps/garden/public/assets/models/`.

## Package dependencies

- Use `workspace:*` versions for internal package dependencies in `package.json` files.
- Common shared packages:
  - `@gredice/storage`: Database schema and migrations using Drizzle ORM
  - `@gredice/ui`: Shared UI components with Tailwind CSS
  - `@gredice/client`: API client SDK
  - `@gredice/transactional`: Email templates and components
  - `@gredice/stripe`: Payment integration utilities
  - `@gredice/game`: Game-related components and models

## Collaboration tips

- Prefer targeted Turborepo commands (`pnpm <COMMAND> --filter ...`) to speed up workflows during development and CI validation.
- When introducing new scripts or workspace packages, update the relevant `package.json` and workspace manifests.
- Document non-obvious behaviors (e.g., manual steps, feature flag dependencies) in `AILOGS.md`. This helps future collaborators understand the context. But don't duplicate information already covered in this file or nested `AGENTS.md` files. Maintain a single source of truth.
- Follow the repo's existing TypeScript, React, and Biome conventions. Avoid adding alternative linting or formatting tools without prior alignment.

## Common commands reference

```bash
# Install dependencies for entire monorepo
pnpm install

# Start all development servers
pnpm dev

# Start specific app development server
pnpm dev --filter www

# Lint entire workspace
pnpm lint

# Lint specific package
pnpm lint --filter @gredice/storage

# Format code with Biome (from package directory)
biome check --write

# Run tests for all packages
pnpm test

# Run tests for specific app
pnpm test --filter garden

# Build all packages and apps
pnpm build

# Generate database migrations (after schema changes)
pnpm db-generate

# Regenerate assets and other generated files
pnpm regenerate
```

Happy shipping!
