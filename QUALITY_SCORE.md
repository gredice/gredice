# Quality Score Guide

Use this guide to decide whether a change is ready.

## Readiness score

Score the change from 0 to 5 before handing it off:

- `0`: Does not run, has unresolved syntax/type errors, or leaves known broken behavior.
- `1`: Runs only on the narrow happy path and has obvious missing validation or UI states.
- `2`: Implements the request but leaves meaningful edge cases, stale data, or test gaps.
- `3`: Solid targeted implementation with relevant lint/test/build checks passing.
- `4`: Handles edge cases, failure states, accessibility, and cross-app/package impact.
- `5`: Production-ready for critical paths: verified behavior, migrations handled, observability considered, and no unexplained risk.

Aim for `3` on small low-risk changes and `4` or higher on shared, public, payment, inventory, delivery, auth, or database work.

## Validation commands

Use targeted commands first. Before handing off code changes, identify the affected workspace(s) and run the narrowest relevant lint, typecheck, test, or build checks unless the user explicitly asks to skip validation. Run typecheck where the workspace provides it.

```bash
pnpm lint --filter <workspace>
pnpm typecheck --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
```

Examples:

```bash
pnpm lint --filter @gredice/storage
pnpm test --filter @gredice/storage
pnpm typecheck --filter garden
pnpm build --filter www
pnpm test --filter www
```

For shared package changes, validate both the changed package and the consuming app(s) that exercise the behavior. If a package is used by multiple apps, run checks for each relevant consumer, not only the package itself. For ordinary `@gredice/game` updates, use app typechecks as the default consumer build-compatibility check for `garden` and `www`; reserve full app builds and Playwright suites for routing, static asset, bundling, production behavior, visual, or user-flow changes. Examples:

```bash
pnpm lint --filter @gredice/storage
pnpm test --filter @gredice/storage
pnpm build --filter app
pnpm build --filter api
pnpm build --filter farm

pnpm lint --filter @gredice/game
pnpm typecheck --filter @gredice/game
pnpm test --filter @gredice/game
pnpm typecheck --filter garden
pnpm typecheck --filter www
```

For docs-only changes, at minimum check formatting-sensitive diffs with:

```bash
git diff --check
```

If a required command cannot run because of missing secrets, unavailable services, unsupported local tooling, or time constraints, note the skipped command and the concrete reason in the handoff.

## Testing expectations

- Unit-test pure domain logic, parsing, validation, and repository behavior.
- Use Playwright for app flows, accessibility, and user-visible regressions.
- For `apps/www`, preserve sitemap-driven public route, accessibility, and metadata tests when public pages change.
- For storage changes, run the relevant storage tests. Remember that storage tests manage their own test database scripts.
- For API route changes, test validation, auth, success, and failure responses.
- For shared UI, add or update Storybook stories and test the consuming app when behavior changes.

## Review checklist

- The change is scoped to the requested behavior.
- Existing user changes are preserved.
- Types come from existing shared contracts where possible.
- No avoidable `any`, non-null assertion, or `as` assertion was introduced.
- Loading, empty, error, disabled, and success states are handled where relevant.
- Mutations invalidate or revalidate the right data.
- Public pages preserve metadata, structured data, accessibility, and responsive layout.
- Secrets and private data are not logged, rendered, or sent to the client.
- New dependencies are justified and added to the right workspace.

## Documentation expectations

- Update docs when behavior, setup, scripts, architecture, or contributor expectations change.
- Keep docs concrete to this repo. Prefer exact package names, app paths, and commands over generic guidance.
- Remove stale instructions when replacing them.
