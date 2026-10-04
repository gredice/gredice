# Search adoption path for `garden`, `app`, and `farm` (GRE-370)

## Goal

Define how future apps should adopt shared search building blocks from the initial `apps/www` rollout without coupling private/authenticated search to public route assumptions.

## Shared foundation (must stay reusable)

These pieces should be treated as app-agnostic contracts and reused by all adopters:

1. **Public API response contract**
   - Keep `GET /api/search/public` response shape stable (`query`, `results`, `pagination`, `facets`, `meta`).
   - Preserve app-agnostic fields (`id`, `entityType`, `score`, `rank`, optional `matchedFields`) as first-class.
2. **Generated client types (`@gredice/client`)**
   - Continue generating search response and request types from API contracts.
   - Consumers should prefer generated types over app-local duplicates.
3. **Category metadata contract**
   - Reuse category slug semantics (`all`, `plants`, `operations`, `blocks`, `sorts`) where public scope applies.
   - Allow each app to hide unsupported categories, but avoid redefining slug meaning.
4. **Result model**
   - Treat result payload as data-first (`entityType`, ids, relevance, optional display fields).
   - Keep `summary` and `image` optional to support sparse/private datasets.
5. **UI interaction patterns**
   - Query + category + pagination state model should remain portable.
   - Keep empty-query and no-results behavior consistent for predictability.

## `www`-specific behavior (must not leak into shared layers)

The following should remain specific to `apps/www` and not be required by future authenticated apps:

- Public route metadata and canonical URL resolution based on `KnownPages`.
- SEO concerns (`noindex`, canonical tags, crawlability, public metadata).
- Public-only entity inclusion/exclusion decisions.
- Public link formatting and localization assumptions in href construction.

## Security and privacy boundary

- `GET /api/search/public` must remain limited to publicly visible entities.
- Private domains (customer gardens, invoices, deliveries, admin-only entities, farm tasks) must use **separate authenticated endpoints** (for example, `/api/search/private` or role-scoped endpoints) with explicit authorization checks.
- Never blend private and public results in one unauthenticated response.
- Role-aware result masking (fields and entity visibility) should happen server-side, not in clients.

## App-by-app adoption plan

### `garden` (customer-facing authenticated app)

Use shared search primitives, then layer in customer scoping:

- Start with public categories already meaningful to customers.
- Add private result groups scoped to current account/user (e.g. owned gardens, saved plans, deliveries).
- Require session-authenticated query execution and account-level filtering.

### `app` (internal admin app)

Adopt shared contract and add admin-specific result surfaces:

- Reuse shared ranking/pagination/category concepts.
- Add admin entities (orders, invoices, customers, operational records).
- Enforce staff role checks and field-level redaction where needed.

### `farm` (operator workflow app)

Adopt shared foundations and prioritize task-centric discoverability:

- Reuse query normalization and portable result metadata.
- Add operational entities (work tasks, schedules, block work queues, supply actions).
- Enforce operator permissions by farm/location/team membership.

## Recommended follow-up issues

1. **[Search][Garden] Add authenticated private search endpoint and customer-scoped result groups**
   - Includes account scoping, result visibility rules, and UX category mapping.
2. **[Search][App] Add internal admin search entities with role-based field visibility**
   - Includes invoices/orders/customers search and redaction policy.
3. **[Search][Farm] Add operator task search with farm/team permission filters**
   - Includes task queues, deliveries, and operational entities.
4. **[Search][API] Define shared private-search contract and authorization policy**
   - Includes whether to use a single private endpoint vs role-specific endpoints.

## Open questions to resolve before private search rollout

- Should private search be a single endpoint with role-based projection, or multiple app-specific endpoints?
- Which entity types require strict field redaction in snippets/summaries?
- Should relevance ranking differ by app context (customer intent vs operator urgency vs admin exact match)?
- How should audit logging and telemetry distinguish public vs authenticated search usage?
- Can any private entity be safely represented with a public fallback, or must identities remain entirely separate?

## Developer guidance for future shared modules

If search modules are extracted from `www`:

- Put app-agnostic helpers in shared packages (for example query state/model helpers), not inside `apps/www`.
- Keep public URL mapping adapters in `apps/www`.
- Keep auth and permission adapters in each consuming app or an auth-aware shared package.
- Add contract tests for generated client types whenever response fields change.
