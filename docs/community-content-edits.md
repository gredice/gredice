# Community content edits

Community content edits let authenticated customers propose changes to public directory content without changing live data immediately. Each proposal becomes a pending admin review item; approval applies the change through the existing directory attribute mutation path.

## Enabled public entity types

Only entity types with stable public detail routes and registry-approved fields are enabled.

| Entity type | Public route | Status |
| --- | --- | --- |
| `plant` | `/biljke/{alias}` | Enabled |
| `plantSort` | `/biljke/{plantAlias}/sorte/{sortAlias}` | Enabled |
| `operation` | `/radnje/{alias}` | Enabled |
| `block` | `/blokovi/{alias}` | Enabled |

The public search contract lists the same route-backed entity set. Current additional generated dictionary types (`brand`, `faq`, `faq-category`, `farmSupply`, `hqLocations`, `liquidPreparation`, `occasions`, `operationFrequency`, `plantStage`, `seed`) stay disabled because they do not have stable per-entity public detail routes or are helper/internal dictionaries.

## Registry boundary

Editable fields live in `packages/storage/src/helpers/communityEditableFields.ts`. The registry is the server-side allowlist for both UI discovery and manual API calls.

Keep these fields out of the registry by default:

- Prices, inventory, SKU-like fields, refunds, fulfillment rules, and internal scheduling logic.
- Private user/account data.
- Generated image/model/asset references.
- Relationship-heavy fields where changing one value has cross-entity effects.
- Helper dictionaries that do not have a stable public edit context.

When enabling a new field, confirm:

- The public page renders the same entity type and entity id that the request will submit.
- The field has a single clear public label and maps to a non-deleted attribute definition.
- The data type matches the public control type.
- Approval can safely use the existing attribute mutation/revision path.
- Public page revalidation is covered by `apps/app/lib/revalidation/publicDirectoryPages.ts`.

## Workflow

1. A logged-in user opens a page-level or section-level edit modal on `www`.
2. `www` fetches editable fields from `GET /api/directories/community-edits/entities/{entityType}/{entityId}/fields`.
3. The user submits changed values to `POST /api/directories/community-edits`.
4. Storage writes `community_edit_requests` and `community_edit_request_changes` with the original value hash, the proposed review value, and a replayable text/markdown patch where possible.
5. Admins review requests at `/admin/community-edits`.
6. Rejecting a request records reviewer metadata without changing live content.
7. Approving a request applies exact-base changes directly. If a text/markdown base changed, storage replays the stored patch against the current value so non-overlapping requests on the same attribute can both merge.
8. If the patch no longer matches cleanly, or a non-text value changed after submission, approval marks the request conflicted instead of overwriting.

## Release QA

Run automated checks first:

- `pnpm --filter @gredice/storage test:node communityEditRequestsRepo.node.spec.ts`
- `pnpm --filter @gredice/storage lint`
- `pnpm --filter api lint`
- `pnpm --filter www typecheck`
- `pnpm --filter app lint`
- `git diff --check`

Manual QA before launch:

- Plant: submit a markdown section edit as an authenticated user; verify pending admin request has `entityTypeName = plant`.
- Plant sort: submit a sort-specific edit and confirm it targets `plantSort`, not the parent plant.
- Operation: submit description or instructions markdown and confirm price/internal fields are not offered.
- Block: submit description markdown and a safe public attribute edit.
- Anonymous flow: open each edit modal signed out and confirm login guidance appears and no request is created.
- Admin list: filter by pending, conflicted, entity type, submitter, and age.
- Admin detail: verify submitter metadata, public/admin links, old value, proposed value, and diff are readable.
- Reject: reject with a note and confirm the public page content does not change.
- Approve: approve and confirm attribute values, entity revision history, search document refresh, and public page revalidation.
- Conflict: submit an edit, change the same field directly in admin, then approve the edit and confirm it becomes conflicted.
- Mobile and keyboard: reach page-level and section-level edit actions, fill controls, submit, and close the modal.

Production/staging notes:

- `GREDICE_WWW_REVALIDATE_SECRET` must be configured for app-to-www revalidation in production.
- `GREDICE_WWW_REVALIDATE_URL` should point at the target `www` deployment outside local development.
- If those variables are absent outside production, approval still mutates storage but public ISR cache may not refresh immediately.
