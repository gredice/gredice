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

Gredice is a Turborepo monorepo for the Gredice platform. It includes the public website, customer garden experience, farm back office, internal operations tools, API routes, Storybook, status page, shared packages, and product assets.

## Repository Map

- `apps/www`: public marketing and commerce site.
- `apps/garden`: customer garden experience and game-facing UI.
- `apps/farm`: farm back-office application.
- `apps/app`: internal operations and admin application.
- `apps/api`: API routes and API documentation.
- `apps/storybook`: public component documentation.
- `apps/status`: public status page.
- `packages/*`: shared libraries for UI, client APIs, storage, game behavior, notifications, integrations, and other platform code.
- `assets`: source brand and game assets.

## Getting Started

Use [Node.js](https://nodejs.org/en/) `>=24`, [pnpm](https://pnpm.io/) `10.33.2`, [Docker](https://www.docker.com/), and the [Vercel CLI](https://vercel.com/download).

```bash
pnpm setup
pnpm doctor
pnpm dev
```

The default dev command starts the main apps through local HTTPS domains such as `https://www.gredice.test`, `https://vrt.gredice.test`, and `https://api.gredice.test`. The `status` app is not part of the default dev stack; start it with `pnpm --filter=status dev` when working on the status page.

`pnpm setup` prepares a fresh worktree as far as local permissions and credentials allow.
`pnpm doctor` runs the same checks in read-only mode and exits non-zero when required dependencies are missing.

For local domains, certificates, environment files, generated assets, and detailed commands, see [WORKSPACE.md](./WORKSPACE.md).

## Documentation

- [AGENTS.md](./AGENTS.md): entry point for AI collaborators.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md): expectations for respectful project participation and reporting concerns.
- [CONTRIBUTING.md](./CONTRIBUTING.md): setup, development, validation, issue, and pull request guidance.
- [WORKSPACE.md](./WORKSPACE.md): repo layout, setup, commands, package boundaries, and local development servers.
- [FRONTEND.md](./FRONTEND.md): Next.js, React, TypeScript, shared UI, Storybook, and app structure rules.
- [DESIGN.md](./DESIGN.md): visual and interaction design standards.
- [PRODUCT_SENSE.md](./PRODUCT_SENSE.md): product expectations, user roles, language, and domain behavior.
- [QUALITY_SCORE.md](./QUALITY_SCORE.md): quality rubric, validation commands, type standards, and review expectations.
- [RELIABILITY.md](./RELIABILITY.md): data integrity, migrations, background work, observability, and failure handling.
- [SECURITY.md](./SECURITY.md): auth, secrets, data exposure, validation, payments, and unsafe rendering.
- [SEO.md](./SEO.md): metadata, structured data, sitemap, canonical URL, and public page rules.

## API Reference

See the [API Reference](https://api.gredice.com) for the official API documentation.

## Contributing

We welcome community contributions. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, development, validation, issue, and pull request guidance, and follow the [Code of Conduct](./CODE_OF_CONDUCT.md) in project spaces.

![Alt](https://repobeats.axiom.co/api/embed/ba847f4d1fae06c8250692c08295602bca8de554.svg "Repobeats analytics image")

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_shield)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fgredice%2Fgredice.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fgredice%2Fgredice?ref=badge_large)
