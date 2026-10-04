# Jesenski album UI (#4996)

The private Garden HUD activity is optional. Its six leaf/acorn motifs are album
acknowledgements, not proof of harvesting, buying or finding an object in a real
garden. Rules, collection dates and exact reward quantities appear before the
first action. There are no streaks, purchases or additional currency.

The explicit welcome action grants one configured `WoodlandAcorns`; the final
first-time motif discovery grants one configured `AutumnWreathPost` atomically
on the server. Both snapshots contain one static `variant: null` piece and zero
paid/refund/recycling allocations. The UI reads the immutable configured name
and quantity. It renders the exact configured reviewed preview URL (the contract requires it
to equal the snapshot preview). A visible failure state offers an explicit
image retry. Local fixtures serve existing reviewed WebP bytes for those test
URLs without creating model assets.
The completed album and acquired decorations survive the campaign window.
The separate pumpkin trail has no reward or required connection to this album.

## Visibility and readiness

Both `NEXT_PUBLIC_GREDICE_AUTUMN_ACTIVITY_ENABLED=true` and
`NEXT_PUBLIC_GREDICE_GARDEN_PACKS_ENABLED=true` are prerequisites for this UI.
They default off and only control client visibility. They never authorize a
discovery or grant. The owned-pack UI prerequisite ensures acquired gifts can
be inspected and placed through existing prepaid inventory, without paid
`useBlockPlace` calls. Inventory copy uses “Moji paketi” and “Preuzeto” for
both bought and gifted packs; exact unit provenance is unchanged.

Server campaign configuration, authenticated ownership, the minimum 28-day
window, exact reviewed published reward identities, storage rollout and
integrity/lifecycle readiness remain authoritative. Paid pack sales are
independent and need not be enabled for cosmetic gifts. This source supplies no
real product IDs, campaign dates, publication, catalogue rows or configuration.
The current missing reward catalogue rows still prevent a live campaign.

The activity query stays disabled for anonymous, mock, local sandbox and sandbox
gardens, isolated public viewers, either public flag off, or an unresolved
account/garden membership. The HUD reads private state only under the current
authenticated user/account key. A response with another account ID is rejected;
old cached progress is hidden and the account/group queries refresh. Previously
stored server campaign/progress can remain readable after collection ends or
discovery is disabled. Closing the panel never opts in or writes progress.

## Retry and synchronization

`useAutumnActivityAction` captures the campaign/version, expected authenticated
account, action and operation UUID. Before the first POST it stores this small
command in versioned owner-scoped `sessionStorage`; the shared strict client
parser validates recovery. It sends the same command through lost responses,
network failures, authentication/rate failures, server uncertainty, remounts and
account changes. Other accounts cannot see or submit that recovery session.
The server's expected-owner assertion also fences a shared cookie switch when
the old account cache has not changed. A receipt or definitive business rejection
settles the command; uncertainty never creates a fresh UUID.

Progress and rewards are never optimistic. A confirmed receipt invalidates the
owner's activity GET and owned inventory. It does not debit or credit a wallet.
A versioned localStorage notification contains only a random invalidation nonce;
another same-origin tab refreshes only the matching owner key. Notifications
never grant a reward. Focus, reconnect and a foreground 60-second refresh also
reconcile server state. Storage failures leave mounted command recovery and
focus/reconnect refresh available, but browser storage cannot guarantee recovery
after the tab closes. Server idempotency and one-time campaign entitlements still
prevent duplicate gifts across tabs and reloads.

The mobile album uses two columns (three on desktop), named motif buttons,
numbers/check marks, persistent errors, explicit retry and a polite server
progress announcement. Reduced motion and muted audio do not change the flow;
there is no canvas, audio or animated reward requirement. The inventory button
uses the existing supported backpack tab state.

## Local checks

```sh
pnpm --filter garden exec playwright test --config=playwright.autumn-activity.config.ts
GREDICE_GARDEN_CT_PORT=5490 pnpm --filter garden exec playwright test --config=playwright.garden-pack-inventory.config.ts
pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/gardenOverview2DBundleBoundary.unit.ts
pnpm --filter @gredice/game typecheck
pnpm --filter garden typecheck
pnpm --filter www typecheck
```

The album fixture uses synthetic IDs, prices of zero, review hashes and dates.
Its actual client hooks cover rules/rewards before participation, the six-piece
sequence, welcome/completion, remount, uncertain retries, selected-account and
shared-cookie fences, query failures, ended campaigns, real second-tab refresh,
reconnect and disabled-query contexts. The backend's isolated database suites
separately prove atomic persistence, concurrency and zero-value lifecycle rules.
Local tests are not production campaign enablement or deployed acceptance.
