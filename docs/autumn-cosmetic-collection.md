# Private autumn cosmetic album

Issue #4996 adds an optional account-private album. Its six fixed leaf/acorn
motifs are acknowledgements revealed in an album, **not proof of finding a
physical object in a garden**. No purchase, crop action, daily streak, seasonal
currency, wallet debit or garden visit is required. The optional welcome claim
grants one WoodlandAcorns decoration; the final distinct acknowledgement grants
one AutumnWreathPost decoration atomically. Rules and exact reward snapshots are
readable before either action. A configured collection window must last at least
28 days, with an inclusive opening and exclusive closing time from the server.

## Configuration and release prerequisites

Everything is default-off and no real campaign is supplied. Set
`GREDICE_AUTUMN_ACTIVITY_ENABLED=true` only after preparing and reviewing a
campaign. `GREDICE_AUTUMN_ACTIVITY_CAMPAIGN` accepts at most 64 KB of strict JSON
matching `autumnActivityCampaignSchema`. Missing JSON returns no configured
campaign. Malformed or stale prepared identities fail closed. The loader validates
a trusted prepared identity; it does not rename supplied version IDs.

`defineAutumnActivityCampaign` is an offline definition constructor. It derives
content-addressed reward and campaign versions. `prepareAutumnActivityCampaign`
is the byte-proof preflight: it compares actual supplied nonempty model/preview
bytes (each at most 10 MB) against the review SHA-256 values and validates the
supplied published directory rows before returning a prepared definition. It
neither writes configuration nor activates a campaign. The byte comparison does
not certify the depicted model, its artistic review, an HTTP URL's current bytes,
or a deployed asset. Maintainers must independently review the exact keepsake
previews and models, then read back their deployed identities and bytes. Do not
use synthetic test fixture IDs, dates, URLs or digest values as real configuration.

Each reward is exactly one reviewed static model, variant `null`, with a 1×1
footprint, no stacking, raised-bed or recycler function. Published directory
lookup must uniquely resolve the same positive safe ID and model name; internal
fallback rows or ambiguous names/IDs fail closed. Model names must remain in the
existing renderer/pack eligibility registry. Catalogue prices and ordinary sale
availability do not determine a free entitlement. The latest local public export
observed on 2026-10-03 at 09:42:54 UTC contained 144 rows and neither proposed
reward model; **publication and production readiness remain unverified**.

New actions also require `GREDICE_GARDEN_PACKS_ENABLED=true` and complete pack,
placement and lifecycle provenance readiness. The pack sales switch is irrelevant.
Existing schema and source-owned integrity guards must already be deployed in the
ordered pack rollout. This change adds no schema or migration. An activity flag
cannot bypass missing pack tables/guards, publish products, or enable sales.

## Identity, persistence and ownership

Campaign version fingerprints cover the full definition, rules, window, finite
motifs, exact reward snapshots and model/preview review identities. Reward version
fingerprints cover the full snapshot plus review metadata, excluding their own
version field. Changed rules, dates, contents or reviewed bytes require a newly
prepared version. The stable product identity is
`autumn-reward:<campaignId>:<welcome|completion>`.

Progress is durable private account events, never public garden events. Commands
use a UUID operation ID, captured `expectedAccountId`, campaign ID/version and
one allowlisted action. The authenticated owner controls access; the expected ID
is a rejection precondition. Operations are scoped to this account's activity
command namespace, across campaigns. Reusing one with a different command returns
409. Separate pack grant identities are deterministic campaign/reward keys,
independent of operation UUID or definition version.

Every mutation uses the existing account row lock and deletion fence. Directory
and configuration preparation runs with a bounded timeout before acquiring that
lock; the authoritative receipt is rechecked under it, including after a failed
preparation. Progress, the finite zero-value pack and the exact command/response
receipt commit together or roll back together. Multiple tabs, concurrent UUIDs,
reconnects and exact retries cannot create a second campaign/reward entitlement.
The event repository also fences appends, rejects changed receipts and prevents
progress or claimed purchase IDs from moving backwards. It relies on the existing
transactional account lock, rather than a new schema-level event unique index.

Definition version changes within one campaign preserve its six finite IDs,
partial progress and already claimed purchase IDs. The next valid action records
the new definition snapshot and can finish remaining progress. Existing owned
packs keep their original immutable snapshot. No version change, refund, recycling,
box storage or catalogue change resets entitlement. A new campaign ID intentionally
identifies a different collection and requires separate release review.

Reward packs allocate zero charged, paid, refund and recycling sunflowers. Owned
units remain available after the campaign ends or is withdrawn and use existing
per-unit placement and box lifecycle paths. A box still has its ordinary six-slot
capacity; neither participation nor the grant depends on a garden or free box
space. Disposal yields zero currency and cannot reclaim the reward. Account
deletion removes private activity events/receipts and detaches existing pack audit
history through the existing account deletion path.

## Routes and recovery

- `GET /api/accounts/current/autumn-activity` returns private, no-store rules,
  exact configured reward snapshots, server event status, action availability,
  readiness and saved progress. It never grants. With configuration missing or
  activity disabled it retains the last saved campaign/progress snapshot. With a
  closed configured window it keeps history and links to owned rewards.
- `POST /api/accounts/current/autumn-activity/actions` accepts only
  `autumnActivityActionBodySchema`: `{operationId,expectedAccountId,campaignId,
  campaignVersionId,action}`. Actions are `{kind:'discover',motifId}` or
  `{kind:'claim-welcome'}`. It returns a durable owner-bound receipt with zero
  charge, saved progress, any newly granted purchase ID and `replayed`.

Exact completed replay precedes activity/configuration/window/catalogue checks;
it still obeys the account deletion fence. A replay returns its original progress
snapshot, which may be older than current progress. Clients retain the complete
captured command through uncertainty and refetch current state after success;
they must not replace newer progress with an old receipt. Auth failures, expected
account mismatch, network failures, timeouts, rate limiting, server failures and
invalid receipts preserve uncertainty. Definitive validation/business conflicts
may clear pending input. Runtime client receipt validation checks owner, operation,
definition, zero value and grant-kind/progress consistency. Account selection and
mutation receipt must refer to the same captured owner.

## Validation

Run from the repository root:

```sh
pnpm --filter api exec node --import tsx --test --conditions=react-server lib/garden/autumnActivityCampaign.node.spec.ts lib/garden/autumnActivityRoutes.node.spec.ts lib/garden/autumnActivity.storage.node.spec.ts
pnpm --filter @gredice/client exec node --import tsx --test tests/autumn-activity.node.spec.ts
pnpm --filter @gredice/js exec node --import tsx --test src/autumnActivities/index.unit.ts
pnpm --filter api exec tsc --noEmit --pretty false
```

The integration wrapper always provisions a private PGlite database before imports.
With an explicitly supplied `GREDICE_PACK_TEST_ADMIN_URL` pointing to the approved
local `packtest` cluster's `/postgres` database, it instead creates and drops a
uniquely named PostgreSQL database. It rejects non-loopback/non-test administration
URLs. Tests exercise independent PostgreSQL connections, concurrent exact/different
UUIDs and mixed grants, late write rollback, owner/deletion fences, replay after
withdrawal, partial-progress version updates and real zero-value placement,
store/retrieve, refund and recycling. No opt-in skip or live database is used.
