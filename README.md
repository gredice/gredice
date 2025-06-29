# gredice

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/)
- [pnpm](https://pnpm.io/)
- [Vercel CLI](https://vercel.com/download)

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/gredice/gredice.git
```

2. Install the dependencies:

```bash
pnpm i
```

3. Pull environment variables

For each application, you need to pull the environment variables from Vercel. You can do this by running the following command in `apps/<app-name>` directory:

```bash
vercel env pull .env.development.local
```

`<app-name>` is the name of the application you want to pull the environment variables for. One of:

- `www`
- `garden`
- `farm`
- `app`

If you are running the command for the first time on yhe development machine, make sure you are logged in to Vercel CLI. You can do this by running:

```bash
vercel login
```

After that, you need to link the project to the Vercel project. You can do this by running in `apps/<app-name>` directory:

```bash
vercel link
```

You can then proceed with pulling the environment variables.

4. Start the development server in project root:

```bash
pnpm dev
```

### Database migrations

To manage and run database migrations in development:

1. Generate new migrations (if you have made schema changes):

```bash
pnpm db-generate
```

2. Apply migrations to your database (database connection string must be set in the environment variables):

```bash
pnpm db-push
```

These commands use the monorepo's Turbo tasks to run the appropriate migration scripts in the relevant packages (typically in `packages/storage`).

- Use `pnpm db-generate` after making changes to your database schema to generate new migration files.
- Use `pnpm db-push` to apply all pending migrations database (connection string must be set in the environment variables).

## Assets

Make sure you are the only one editing the game assets file. If you are not, please contact the person who is currently editing the file so you can coordinate the changes after they are done and changes are merged.

### Regenerating the game assets GLB file

Run the following command in the project `/assets` directory:

```bash
./export.sh
```

This will generate a new `game-assets.glb` file in the `/apps/garden/public/assets/models` directory.

### Adding new entity

Use [https://gltf.pmnd.rs/](https://gltf.pmnd.rs/) to convert the GLTF file assets to a Three.js compatible components.

## Contributing

![Alt](https://repobeats.axiom.co/api/embed/ba847f4d1fae06c8250692c08295602bca8de554.svg "Repobeats analytics image")

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_shield)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_large)
