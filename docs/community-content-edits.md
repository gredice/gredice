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

1. A logged-in user opens a page-level or section-level edit dialog on `www` from a section's contribution bar (see [Public contribution UI](#public-contribution-ui)). A signed-out visitor gets the sign-in dialog directly and returns to the same dialog afterwards.
2. `www` fetches editable fields from `GET /api/directories/community-edits/entities/{entityType}/{entityId}/fields`.
3. The user submits changed values to `POST /api/directories/community-edits`.
4. Storage writes `community_edit_requests` and `community_edit_request_changes` with the original value hash, the proposed review value, and a replayable text/markdown patch where possible.
5. Admins review requests at `/admin/community-edits`.
6. Rejecting a request records reviewer metadata without changing live content.
7. Approving a request applies exact-base changes directly. If a text/markdown base changed, storage replays the stored patch against the current value so non-overlapping requests on the same attribute can both merge.
8. If the patch no longer matches cleanly, or a non-text value changed after submission, approval marks the request conflicted instead of overwriting.
9. Every final outcome (applied, rejected, conflicted) notifies the submitter, who follows all of their requests at `/moji-prijedlozi` on `www`.

## Public contribution UI

All of it lives in `apps/www/components/community-edits`.

- **Section bar** (`SectionContributionBar`): sits directly under a section's content on plant, sort, operation, block, disease and pest pages. Left: “Je li ovo korisno?” with labeled Da/Ne feedback. Middle: “Predloži izmjenu”. Right: the section's editors (`SectionContributors`), newest edit first, up to three avatars; hover, click or keyboard opens a list of up to five editors with links to their public profiles.
- **Page panel** (`PageContributors`): closes each of those pages with “Ovu stranicu uređuje zajednica”, the date of the last accepted edit, the editors and a page-level edit button.
- **Suggestion card** (`CommunitySuggestionCard`): the one dashed “Nedostaje …?” card for suggesting a new sort, tip, operation, disease or pest. It is the last cell of the grid it extends (`/radnje`, `/bolesti`, `/stetnici`, plant sorts) and also appears in empty search states.
- **Dialogs**: the edit dialog and the suggestion dialog share `CommunityDialogFrame` (context line with entity and section, one review-promise sentence, sticky footer, one `role="alert"` error style). The edit dialog keeps a draft while the visitor stays on the page, marks changed fields with “Izmijenjeno” and “Vrati”, lists the changes beside “Pošalji prijedlog”, validates ranges, and shows the next community-editing badge from `@gredice/js/achievements`. Fields the dialog cannot edit safely (references without options, raw JSON) show a notice instead of an input.
- **After sending**: the success state shows the three steps (Poslano, Pregled, Objava) and links to `/moji-prijedlozi`.
- **Moji prijedlozi** (`apps/www/app/moji-prijedlozi`): client-rendered, `noindex`, outside the sitemap. Lists the visitor's requests with status, dates, the moderator's reply, a link to the published page, and “Predloži ponovno” for conflicted requests. Linked from the footer, the leaderboard and the dialog success state.
- **Contributor data on static pages**: `apps/www/lib/community/getEntityContributors.ts` reads `getCommunityEntityContributors` from storage during rendering (cached per request, empty on failure). Approval already revalidates the public directory pages, which refreshes the avatars.
- **Profile and leaderboard**: `/korisnici/{publicId}` shows a “Doprinosi” count and “Poboljšane stranice”; `/korisnici` lists “Urednici”. Both read the new API fields defensively, so a `www` deployment that is ahead of the API hides those parts instead of failing.

## Review reply and submitter status

Each review form in `/admin/community-edits/{requestId}` has two fields:

- **Poruka pošiljatelju** (`submitterMessage`) is the moderator's reply. It is stored in `community_edit_requests.submitter_message`, shown to the submitter in “Moji prijedlozi” and appended to the notification.
- **Interna napomena** (`reviewerNote`) stays internal. It is never returned by a public or submitter-facing read.

`approveCommunityEditRequest`, `rejectCommunityEditRequest` and `markCommunityEditRequestConflicted` accept `submitterMessage` and store it trimmed, or `null` when empty. A reply written for an approval is not kept when that approval turns into an automatic conflict; the conflict notification carries its own explanation.

`GET /api/directories/community-edits/mine` lists the signed-in user's own requests, newest first (up to 50), with `Cache-Control: no-store`:

```ts
{
    acceptedCount: number; // requests in status `applied`
    items: Array<{
        id: number;
        status: 'applied' | 'approved' | 'canceled' | 'conflicted' | 'pending' | 'rejected';
        kind: 'edit' | 'suggestion';
        title: string; // entity public name; for a suggestion, the suggested name
        context: string | null; // section label, or e.g. "Nova sorta · Rajčica"
        changeLabels: string[]; // public labels of the changed fields
        publicPath: string;
        submitterMessage: string | null;
        createdAt: string;
        reviewedAt: string | null;
        appliedAt: string | null;
    }>;
}
```

The wording lives in `apps/api/lib/communityEdits/communityEditPresentation.ts`. Fields that left the registry are dropped from `changeLabels` instead of exposing an internal field key. The response never contains the internal note, the reviewer's identity or an e-mail address.

## Submitter notifications

`apps/app/app/admin/community-edits/notifyCommunityEditSubmitter.ts` runs after every review action. It notifies only for `applied`, `rejected` and `conflicted` (including a conflict detected during approval), targets the submitter's primary account and user, and uses the default `general` category and type, like the plant-status approval notifications. The idempotency key `community-edit:{status}:{requestId}` makes repeated submits a no-op. A notification failure is logged and never fails the review.

The notification links to `https://www.gredice.com/moji-prijedlozi`. The garden notification list allowlists that exact URL in `packages/game/src/hud/notificationNavigation.ts`. The web-push service worker only opens garden and delivery-tracker URLs, so a push click opens the garden app, where the in-app notification carries the link.

## Contributors read model

`packages/storage/src/repositories/communityEditContributionsRepo.ts` holds the public read models. Only requests in status `applied` count as contributions.

- `getCommunityEntityContributors(entityId)` returns who improved an entity, for the whole page and per section, latest edit first with one row per user. A request counts for each distinct section its changes touch; a change without a section falls back to the request's section; an accepted entity suggestion (no change rows) counts for the request's section, for example `new-plant-tip`. Temporary users are left out.
- `getCommunityContributionSummaryForUser(userId)` returns the accepted count and the pages most recently improved (one row per public path). The public profile route returns it as `contributions`.
- `getCommunityEditorLeaderboard()` ranks registered users by accepted requests, with the achievement leaderboard's tie-break. The leaderboard route returns the top five as `editors`.

These reads select explicit columns and do not touch `submitter_message`, because `www` renders contributors while it builds and that can happen before the migration has run.

## Disease and pest suggestions

The disease and pest suggestion dialogs on plant pages, sort pages and the
health directories offer **Odaberi postojeće** and a new-record mode. Existing
records use searchable published-directory choices; records already linked to
all selected plants are omitted. New records retain the existing entity
suggestion review workflow.

Link suggestions read the selected disease/pest's latest `affected-plants`
field, preserve every existing plant reference, append the selected plants,
and submit a normal community edit with its `baseValueHash`. Submission does
not change live data. Approval uses the existing reference validation,
conflict detection, revision and public-page revalidation paths. The source
page is retained as `publicPath`, including when submitted from a sort page.
Sort pages inherit health information from their parent plant; the dialog
explicitly states that the relationship applies to the plant and its sorts.

Community text inputs, textareas, native selects and reference pickers use the
shared styles in `apps/www/components/community-edits/communityControlStyles.ts`
so enabled controls have a consistent card background. The markdown editor
already uses the same card surface.

## Operation suggestions

On `/radnje`, the **Nedostaje radnja?** suggestion card (dialog title
“Predloži novu radnju”) sits at the end of each
public stage group (`apps/www/app/radnje/OperationSuggestionCard.tsx`), not a
header button. Opening it from a group preselects that group's plant stage;
the stage stays editable. When a search leaves no operations, the empty state
shows the same card without a preselected stage. The internal OPG partner
group has no card. Each card keeps its own sign-in return key
(`operation:{stageId}`), so returning from login reopens the form for the
group the user started from.

## Release QA

Run automated checks first:

- `pnpm --filter @gredice/storage test:node ./tests/communityEditRequestsRepo.node.spec.ts ./tests/communityEditContributionsRepo.node.spec.ts`
- `pnpm --filter api exec node --experimental-test-module-mocks --import tsx --test --conditions=react-server ./lib/communityEdits/communityEditPresentation.node.spec.ts`
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
- Reply: reject with a “Poruka pošiljatelju” and an “Interna napomena”; confirm the submitter sees only the reply in “Moji prijedlozi” and receives one notification.
- Approve: approve and confirm attribute values, entity revision history, search document refresh, and public page revalidation.
- Conflict: submit an edit, change the same field directly in admin, then approve the edit and confirm it becomes conflicted.
- Mobile and keyboard: reach page-level and section-level edit actions, fill controls, submit, and close the modal.

Production/staging notes:

- Migration `0095_community_edit_submitter_message` adds the nullable `submitter_message` column. The API production build applies it through `pnpm --filter @gredice/storage migrate:deploy`. Until that build finishes, the admin community-edit pages of a newer `app` deployment fail on the missing column; public contributor reads are unaffected.
- `GREDICE_WWW_REVALIDATE_SECRET` must be configured for app-to-www revalidation in production.
- `GREDICE_WWW_REVALIDATE_URL` should point at the target `www` deployment outside local development.
- If those variables are absent outside production, approval still mutates storage but public ISR cache may not refresh immediately.
