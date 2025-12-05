<p align="center">
  <img src="assets/brand/gredice-logotype.svg" alt="Gredice logo" width="320">
</p>

<p align="center">
  Tools for growing thriving gardens through collaborative planning, simulation, and automation.
</p>

---

## Overview

Gredice is a Turborepo monorepo that powers the entire Gredice platform. It includes multiple Next.js applications (`www`, `garden`, `farm`, `app`, and `api`) plus shared packages and assets that bring the experience together. Clone the repo to explore the user-facing products, APIs, and infrastructure that help modular gardens thrive.

## Table of Contents

- [Development](#development)
  - [Prerequisites](#prerequisites)
  - [Quick start](#quick-start)
  - [Environment variables](#environment-variables)
  - [API reference](#api-reference)
- [Database migrations](#database-migrations)
- [Assets workflow](#assets-workflow)
  - [Regenerating game assets](#regenerating-game-assets)
  - [Adding a new entity model](#adding-a-new-entity-model)
- [Contributing](#contributing)
- [License](#license)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (used for the local reverse proxy)
- [Vercel CLI](https://vercel.com/download)

### Quick start

1. Clone the repository:

   ```bash
   git clone https://github.com/gredice/gredice.git
   cd gredice
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Pull environment variables for all applications:

   ```bash
   pnpm env:pull
   ```

4. Start the development server from the project root:

   ```bash
   pnpm dev
   ```

### Local domains

Running `pnpm dev` automatically starts a Dockerized Caddy reverse proxy so that each app is available on the same subdomains we use in production:

- <https://www.gredice.test> → marketing site (`apps/www`)
- <https://vrt.gredice.test> → customer garden (`apps/garden`)
- <https://farma.gredice.test> → farm back office (`apps/farm`)
- <https://app.gredice.test> → internal operations (`apps/app`)
- <https://api.gredice.test> → API routes (`apps/api`)

Add the following entry to your hosts file (e.g. `/etc/hosts` on macOS/Linux or `C:\Windows\System32\drivers\etc\hosts` on Windows) so the domains resolve to your machine:

```text
127.0.0.1 www.gredice.test vrt.gredice.test farma.gredice.test app.gredice.test api.gredice.test
```

Make sure Docker Desktop (or the Docker daemon) is running before you start the dev server. To bypass the proxy—for example, if Docker is unavailable—run `SKIP_DEV_PROXY=1 pnpm dev`. If the proxy ever lingers after an interrupted session, you can stop it manually with `docker stop gredice-dev-caddy`.

### Development HTTPS certificates

The development proxy terminates HTTPS locally so the applications behave the same way they do in production. When you run `pnpm dev`, the script stores Caddy's internal certificate authority in `~/.gredice/dev-caddy` (or the path specified by `GREDICE_DEV_CADDY_DATA_DIR`) and attempts to trust it automatically for your operating system. You may be prompted for your password if the trust store requires elevated access.

If the automatic step fails, you can trust the authority manually from the path above:

- **macOS**: open Keychain Access, import `root.crt` from the Caddy data directory, and mark it as trusted for SSL.
- **Windows**: run `certmgr.msc`, open the *Trusted Root Certification Authorities* store (either user or local machine), and import `root.crt`.
- **Linux**: install it into your user trust store with `trust anchor ~/.gredice/dev-caddy/caddy/pki/authorities/local/root.crt`, or use your distribution's certificate tooling.

After the certificate is trusted, browsers will stop warning about the `*.gredice.test` HTTPS domains.

### Environment variables

Use the Vercel CLI to pull environment variables for every app at once:

```bash
pnpm env:pull
```

This runs `vercel env pull .env` in `apps/www`, `apps/garden`, `apps/farm`, `apps/app`, and `apps/api`.

If you are running the command for the first time on the development machine, make sure you are logged in to the Vercel CLI and that the project is linked:

```bash
vercel login
vercel link
```

After logging in and linking, rerun `pnpm env:pull` to update all local environment files.

### API reference

See the [API Reference](https://api.gredice.com) for the official documentation. You can use the API to interact with the Gredice platform, manage gardens and farms, and integrate Gredice capabilities into your own applications.

## Database migrations

Use the workspace scripts to manage migrations during development:

1. Generate new migrations after making schema changes:

   ```bash
   pnpm db-generate
   ```

2. Apply migrations to your local database (requires the connection string in your environment):

   ```bash
   pnpm db-push
   ```

These commands leverage the monorepo's Turbo tasks to execute the appropriate migration scripts in the relevant packages (typically `packages/storage`).

- Run `pnpm db-generate` whenever you adjust the database schema to create new migration files.
- Run `pnpm db-push` to apply all pending migrations to your database once the environment variables are configured.

## Assets workflow

Coordinate with teammates before editing the shared game asset files. Only one person should export changes at a time to avoid conflicting updates.

### Regenerating game assets

After updating the `GameAssets.blend` file in the `assets/` directory, regenerate both the GLB file and TypeScript types by running this command from the project root:

```bash
pnpm generate:game-assets
```

This command does the following:

1. Exports `GameAssets.blend` to `apps/garden/public/assets/models/GameAssets.glb` using Blender
2. Generates TypeScript types in `packages/game/src/models/GameAssets.tsx` using gltfjsx
3. Applies linting and formatting fixes to ensure the generated code is error-free

**Prerequisites**: This command requires [Blender](https://www.blender.org/download/) to be installed at the default location for your platform:

- **macOS**: `/Applications/Blender.app`
- **Windows**: `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`
- **Linux/other**: Update the path in `assets/export.sh`

The command automatically detects your platform and uses the appropriate export script (`export.ps1` on Windows, `export.sh` on Unix-like systems).

### Manual steps (alternative)

If you need to run the steps separately:

1. **Export the GLB file** - Run from the `assets/` directory:

   **Unix-like systems (macOS, Linux):**

   ```bash
   ./export.sh
   ```

   **Windows:**

   ```powershell
   .\export.ps1
   ```

2. **Generate TypeScript types** - Run from the project root:

   ```bash
   pnpm generate:models-types
   ```

### Adding a new entity model

We use [https://gltf.pmnd.rs/](https://gltf.pmnd.rs/) to convert GLTF assets into Three.js compatible components before integrating them into the project.

When adding new models to `GameAssets.blend`, run `pnpm generate:game-assets` to update the GLB export and TypeScript types.

## Contributing

We welcome community contributions—check out the repository activity below and jump into issues or discussions that interest you.

![Alt](https://repobeats.axiom.co/api/embed/ba847f4d1fae06c8250692c08295602bca8de554.svg "Repobeats analytics image")

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_shield)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_large)
