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
