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
  - [Regenerating the game assets GLB file](#regenerating-the-game-assets-glb-file)
  - [Adding a new entity](#adding-a-new-entity)
- [Specification Driven Development](#specification-driven-development)
  - [Creating a new feature](#creating-a-new-feature)
  - [What we changed from default Spec Kit behavior](#what-we-changed-from-default-spec-kit-behavior)
- [Contributing](#contributing)
- [License](#license)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/)
- [pnpm](https://pnpm.io/)
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

3. Pull environment variables for each application (see below).

4. Start the development server from the project root:

   ```bash
   pnpm dev
   ```

### Environment variables

Use the Vercel CLI to pull the environment variables for each application by running the following command inside the `apps/<app-name>` directory:

```bash
vercel env pull .env.development.local
```

`<app-name>` can be any of `www`, `garden`, `farm`, or `app`.

If you are running the command for the first time on the development machine, make sure you are logged in to the Vercel CLI and that the project is linked:

```bash
vercel login
vercel link
```

After logging in and linking, you can proceed with pulling the environment variables for the applications you need.

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

### Regenerating the game assets GLB file

Run the following command in the project `assets/` directory:

```bash
./export.sh
```

This generates a new `game-assets.glb` file in `apps/garden/public/assets/models`.

### Adding a new entity

Use [https://gltf.pmnd.rs/](https://gltf.pmnd.rs/) to convert GLTF assets into Three.js compatible components before integrating them into the project.

## Specification Driven Development

We use Specification Driven Development (SDD) to plan and ship new features. Specifications describe the desired behavior, implementation notes capture how we will build it, and executable tasks track the actual work.

### Creating a new feature

Run these commands in Copilot Chat to generate the specification, technical plan, and task list:

```bash
/specify <FEATURE_DESCRIPTION>
/plan <TECHNICAL_IMPLEMENTATION_DETAILS>
/task
```

### What we changed from default Spec Kit behavior

- We use GitButler for branch management, so the `create-new-feature.sh` script does not create branches.

## Contributing

We welcome community contributions—check out the repository activity below and jump into issues or discussions that interest you.

![Alt](https://repobeats.axiom.co/api/embed/ba847f4d1fae06c8250692c08295602bca8de554.svg "Repobeats analytics image")

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_shield)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_large)
