---
name: gredice-api-reference
description: Maintain Gredice API documentation and contracts. Use when changing Hono route docs, describeRoute metadata, OpenAPI generation, Scalar API reference pages, API auth/security schemes, Zod validation schemas, directories API schemas, generated directory types, packages/client API helpers, or any docs under apps/api.
---

# Gredice API Reference

## Overview

Keep API reference behavior aligned with route implementation, validation, auth, and generated TypeScript contracts. Treat docs metadata as part of the API surface.

## Current API Shape

Primary files and ownership:

- Route composition: `apps/api/app/api/[...route]/route.ts`.
- Hono route modules: `apps/api/app/api/[...route]/*Routes.ts` and nested `data/*Routes.ts`.
- Scalar page: `apps/api/app/docs/[slug]/page.tsx`.
- OpenAPI helper for directory/CMS docs: `apps/api/lib/docs/openApiDocs.ts`.
- API docs tests: `apps/api/lib/docs/openApiDocs.node.spec.ts`.
- Security helpers: `apps/api/lib/docs/security.ts`.
- Public directory type package: `packages/directory-types`.
- Client helper: `packages/client/src/directories-api.ts`.

The API app uses Hono, `hono-openapi`, Zod validators, and Next.js App Router route handlers. The reference UI reads `/api/docs/{slug}` specs through Scalar.

## Route Documentation Workflow

When adding or changing an API endpoint:

1. Read the route implementation and validators before editing docs.
2. Ensure `describeRoute` describes the actual behavior, not intended future behavior.
3. Keep `security` accurate:
   - Use `authSecurity` for endpoints that require session cookie or bearer token.
   - Use `publicSecurity` for intentionally public endpoints.
   - Use explicit mixed security only when the route supports both public and authenticated access.
4. Keep `tags` consistent within the route group when tags are already used.
5. Add request validators with `zValidator` before relying on values from params, query, or JSON bodies.
6. Document status codes only when the route really returns them.
7. For auth, account, payment, delivery, inventory, and private data endpoints, verify the server-side authorization path, not just the documented security scheme.

## Directory And CMS OpenAPI

`apps/api/lib/docs/openApiDocs.ts` builds OpenAPI 3.1 docs for directory entities and CMS pages.

Respect these details:

- Entity schemas come from `@gredice/storage` entity types and attribute definitions.
- Attribute `dataType` controls the OpenAPI schema. Unsupported types should fail loudly through `UnsupportedCmsAttributeDataTypeError`.
- `json|...`, `ref:...`, `range`, and `range|...` data types have custom handling.
- CMS page docs include `/pages` and `/pages/{slug}`.
- `image` is a shared component schema.
- Tests in `openApiDocs.node.spec.ts` should cover parser and schema behavior when this logic changes.

Do not hand-edit generated `packages/directory-types/src/v1.d.ts` or `apps/api/lib/@types/directories-api/v1.d.ts` without regenerating from the API docs source.

## Generated Type Contracts

When API docs affect generated clients:

- `packages/directory-types` re-exports OpenAPI `paths` and `components` from `src/v1.d.ts`.
- `packages/client/src/directories-api.ts` builds an `openapi-fetch` client from those generated types.
- Run `pnpm --filter @gredice/directory-types regenerate` after CMS entity types or public directory API docs change.
- Use `pnpm --filter @gredice/directory-types regenerate:cms-types` only when `src/v1.d.ts` is already current.
- `apps/api` also has `pnpm --filter api regenerate:directories-api` for its local generated type.

## Description Quality

Write API descriptions that help consumers call the endpoint:

- State the resource and actor, for example "Get delivery requests for the current user".
- Include lifecycle or side effects for mutations, for example notifications, Stripe sessions, account switching, or cache invalidation.
- Avoid generic descriptions like "Change notification" when the route is more specific.
- Keep examples and defaults grounded in validators and returned data.
- Do not expose secret names, internal stack traces, private IDs, or webhook payload details unless they are part of the public contract.

## Validation

Choose the smallest check that covers the change:

```bash
pnpm --filter api test:node
pnpm test --filter api
pnpm build --filter api
pnpm --filter @gredice/directory-types regenerate
pnpm lint --filter @gredice/directory-types
```

For visual API reference changes, start the API app and inspect `https://api.gredice.test/docs/{slug}` or the local test URL defined by `scripts/app-registry.ts`.

Only query a live API or database when source code and tests cannot answer whether a documented response matches production data.
