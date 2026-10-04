<p align="center">
  <img src="assets/brand/gredice-logotype.svg" alt="Gredice logo" width="320">
</p>

<p align="center">
  Tools for growing thriving gardens through collaborative planning, simulation, and automation.
</p>

<p align="center">
  <a href="https://linear.app/gredice">
    <img src="https://img.shields.io/badge/Linear-Gredice-5E6AD2?logo=linear&logoColor=white" alt="Linear project">
  </a>
</p>

---

## Overview

Gredice is a Turborepo monorepo for the Gredice platform. It includes the public website, customer garden experience, farm back office, delivery operations, internal tools, API routes, Storybook, status page, shared packages, and product assets.

## Repository Map

- `apps/www`: public marketing and commerce site.
- `apps/garden`: customer garden experience and game-facing UI.
- `apps/farm`: farm back-office application.
- `apps/delivery`: driver routes and customer delivery tracking.
- `apps/app`: internal operations and admin application.
- `apps/api`: API routes and API documentation.
- `apps/storybook`: public component documentation.
- `apps/status`: public status page.
- `packages/*`: shared libraries for UI, client APIs, storage, game behavior, notifications, integrations, and other platform code.
- `assets`: source brand and game assets.

## Getting Started

Requirements: nvm/Node.js `>=24`, Corepack-managed pnpm, Vercel CLI, and Docker.

```bash
nvm use
corepack enable
pnpm i -g vercel
pnpm install
pnpm bootstrap
pnpm doctor
pnpm dev
```

`pnpm dev` starts the main local HTTPS apps. `status` is separate. For domains, certificates, env files, worktree port offsets, generated assets, and command details, see [WORKSPACE.md](./WORKSPACE.md).

Run `vercel login` if bootstrap or environment checks report missing auth.

## Documentation

[AGENTS.md](./AGENTS.md) is the AI entry point. [CONTRIBUTING.md](./CONTRIBUTING.md) covers contributor flow. The main operating guides are [WORKSPACE.md](./WORKSPACE.md), [FRONTEND.md](./FRONTEND.md), [DESIGN.md](./DESIGN.md), [PRODUCT_SENSE.md](./PRODUCT_SENSE.md), [QUALITY_SCORE.md](./QUALITY_SCORE.md), [RELIABILITY.md](./RELIABILITY.md), [SECURITY.md](./SECURITY.md), and [SEO.md](./SEO.md). Focused docs live under [docs](./docs).

## API Reference

See the [API Reference](https://api.gredice.com) for the official API documentation.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

![Alt](https://repobeats.axiom.co/api/embed/ba847f4d1fae06c8250692c08295602bca8de554.svg "Repobeats analytics image")

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_shield)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_large)
