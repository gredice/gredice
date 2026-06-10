# Quality Score

Use this as the handoff bar.

## Readiness

- `0`: Does not run or leaves known broken behavior.
- `1`: Narrow happy path only.
- `2`: Request is implemented with meaningful edge/test gaps.
- `3`: Targeted implementation with relevant checks passing.
- `4`: Handles edge cases, failure states, accessibility, and cross-app/package impact.
- `5`: Production-ready for critical paths: verified behavior, migrations/observability considered, no unexplained risk.

Aim for `3` on small low-risk changes and `4+` for shared, public, payment, inventory, delivery, auth, or database work.

## Validation

Run commands from the repo root. Pick the smallest reliable filtered check:

```bash
pnpm lint --filter <workspace>
pnpm typecheck --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
```

Shared package changes need checks for the package and relevant consumers. For ordinary `@gredice/game` updates, use package checks plus `garden` and `www` typechecks; reserve app builds and Playwright suites for routing, static assets, bundling, production behavior, visual changes, or user flows.

Docs-only changes: `git diff --check`.

If a required check cannot run, report the command and concrete reason.

## Testing

- Unit-test pure domain logic, parsing, validation, and repositories.
- Use Playwright for app flows, accessibility, and visible regressions.
- Preserve `apps/www` sitemap-driven route, accessibility, and metadata tests for public page work.
- Storage/API changes should cover validation, auth, success, failure, and relevant repository behavior.
- Shared UI changes need Storybook coverage and a consuming-app check when behavior changes.

## Review

- Scope matches the request and preserves existing user changes.
- Types come from shared contracts where possible; no avoidable `any`, non-null assertion, or `as`.
- Relevant loading, empty, error, disabled, and success states are handled.
- Mutations invalidate or revalidate the right data.
- Public pages preserve metadata, structured data, accessibility, and responsive layout.
- Secrets/private data are not logged, rendered, or sent to the client.
- New dependencies are justified and added to the right workspace.

## Docs

Update docs when behavior, setup, scripts, architecture, or contributor expectations change. Keep them repo-specific and remove stale guidance.
