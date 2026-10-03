# Infrastructure cost verification

Epic [#5089](https://github.com/gredice/gredice/issues/5089) delivered the eight
implementation areas in PRs #5091–#5098 and the Status capacity follow-up #5101.
Budget acceptance requires matched production evidence. This runbook makes that
evidence reproducible; passing local checks does not establish monthly savings.

## Billing and rollout readback on 2 October 2026

Read-only Vercel Marketplace configuration reports the Neon **Launch** plan,
`launch_v3`, with advertised compute at **$0.106/CU-hour** and storage at
**$0.35/GB-month**. The billing snapshot at `2026-10-02T10:27:10Z` reports the
October period starting `2026-10-01T00:00:00Z`: **17.326 CU-hours / $1.84**,
classified as **Compute**, with line-item price `0.106198776`. The snapshot
contains no egress line item. This is a current provider snapshot, not the final
monthly invoice or evidence that storage/history/transfer are free.

The authenticated Neon API subsequently confirmed one organization with one
storage project in `aws-eu-central-1`; a second inventory page was empty. The
main endpoint uses **0.25–8 CU autoscaling**, **300-second autosuspend**, and was
active at readback. Its recorded start was 10 September 02:00:41 UTC, with last
activity 2 October 11:03:36 UTC. There is one ready main branch and six archived
preview branches, with seven read-write endpoints (six idle) and no replicas.
PITR is **86,400 seconds (one day)**. The root logical/synthetic size is
**231,727,104 bytes**. Preview suspend setting zero means provider default;
it must not be interpreted as disabled autosuspend.

Neon's V2 hourly consumption history gives **36.9402778 CU-hours** and
**13.860766875 GB public transfer** for the complete baseline. Compute alone
would cost **$3.9156694** at the advertised rate. The transition day records
**12.3238889 CU-hours / 5.639840761 GB**. The first four complete post-cutover
hours (2 October 07:00–11:00 UTC) record **2.0 CU-hours / 0.113884969 GB**;
branch attribution assigns all of that compute/transfer to main. The short
window's compute-only linear pace is **$38.16 per 30 days**, so it does not
establish the €5 goal. It requires remaining wakeup/compute attribution, not a
claim that transfer reduction achieved the budget.

Storage/history metric unit normalization, archived-branch billable allowances,
included transfer and final all-resource invoice reconciliation remain open.
Raw storage/history metrics are retained locally: observed normalized values
must be reconciled with the provider's byte-hour documentation before costing.
Split metric records for the same hour count as one coverage hour; the baseline
has 72 unique hours. Keep compute distinct from transfer and confirm every
billable resource rather than only the production connection.

The serving API alias resolved to READY deployment
`dpl_Gxav5HvJqqJtaWpGkGXdjJKXS6B3`, merge SHA
`c463a6e52c3f93f090ba28f2f2564dc660e6cd96`, ready at
`2026-10-02T05:56:15.809Z`, with 19 cron definitions. Its alias assignment was
`2026-10-02T05:56:16.087Z`. Between 05:57 and 10:30 UTC, Vercel's dispatcher
request-path query returned 274 records: 273 HTTP 200 and one HTTP 401. The
same production window returned no warning/error records. These request
aggregates do not prove queue completion, Redis-only execution or provider
delivery latency; inspect worker attribution and durable outcomes separately.

A bounded read-only snapshot at 11:14:04 UTC found zero queued/retrying/running
automation runs, zero queued/sending checkout/order-confirmation email rows,
and zero queued/scheduled social posts. At 11:11:36 UTC, Status Redis held 14
records with an oldest receipt 54 seconds old; the five dispatcher hints had
null due times and recent acknowledgements. These aggregate snapshots contain
no customer payloads and do not establish historical throughput, notification
delivery or authoritative emptiness for other queues.

The complete pre-change billing window, 28 September 07:00–1 October 07:00 UTC,
reproduces **$2.6621856** Vercel infrastructure EffectiveCost, about
**$26.62 per 30 days** at a linear pace. BilledCost was **$1.8615943** after
the provider's credit treatment. Subscription licenses are separate. The
transition day, 1 October 07:00–2 October 07:00 UTC, cost **$2.5838988**,
including **17.118 GB / $0.8559084** Blob transfer, **$0.5744594** active CPU
and **$0.5743404** Observability events. It straddles implementation rollout
and cannot establish post-change savings. Attribute that traffic before
selecting another optimization.

The earliest complete three-day provider billing window after cutover is
**2 October 07:00–5 October 07:00 UTC**, or **2 October 09:00–5 October 09:00
Europe/Zagreb**, subject to billing export settlement. Record any later code or
configuration changes and choose a new stable measurement window if necessary.
Do not join partial billing days or extrapolate a few quiet hours as the required
72-hour evidence.

## CI infrastructure isolation

Routine Next.js builds and test shards run through
`scripts/ci-isolated-tests.sh` on Ubuntu 24.04. Dependency/browser installation
happens first. The wrapper creates a Linux network namespace with only loopback
enabled; subprocesses, Chromium, native clients, redirects and raw IP connections
cannot reach production, previews or other external services. The Actions runner
and artifact/cache actions remain outside the test namespace. A CI check verifies
that external TCP is unreachable with the JavaScript preload removed.
Storage, game, JS, email and guard unit-test jobs use the same namespace boundary.

CI does not pull Vercel environments, inherit project secrets or use Turbo remote
caching. Storage uses a disposable PostgreSQL instance inside the namespace and
a bounded checked-in public catalogue fixture. Production-style news tests use
synthetic local CMS pages. API/news rewrites point to loopback, featured gardens
use the existing fixture, and Google Fonts use system-font CSS fixtures. Blob/CDN
images and Open Graph emoji fetches receive local fixtures; checked-in game assets
are served from disk. New tests
must supply local fixtures/services rather than adding an external allowlist.

The fixture modes, database environment and fixture inputs participate in Turbo
cache keys. Next build caches use a separate isolation prefix. Fixture artifacts
must never become production deployment output.

### Blob fixtures

Routine GitHub Actions Next.js build/test jobs enable
`GREDICE_CI_BLOB_FIXTURES=1` and preload
`scripts/ci-blob-network-guard.mjs` through `NODE_OPTIONS`. Node image reads from
any Vercel Blob tenant receive the checked-in plant placeholder. Writes and
non-image reads require an explicit local fixture. DNS lookups for Blob hosts
are blocked as a backstop for redirects and clients that bypass global `fetch`.

Chromium regression configs also block Blob host resolution in this mode. WWW
route and component tests use context-wide image fixtures, including extra
pages; manually created contexts must call `installBlobImageFixtures`. Service
workers are disabled in these fixtures so they cannot bypass interception.
Unexpected non-image Blob requests fail with a fixture instruction.

This protects routine CI from repeatedly downloading the production photos. It
does not measure their visual content or prove a production asset is reachable.
Keep any deliberate live-asset verification bounded and separate from routine
CI. Local servers and production builds do not enable the preload. Turbo hashes
the fixture mode separately and tracks the guard/placeholder inputs so fixture
build output cannot be reused for a production build.

Run the guard checks without building the app or accessing production storage:

```bash
pnpm --filter www run test:blob-guard
```

Existing CI concurrency cancels superseded runs; keep that protection and batch
related pushes. Keep sitemap/accessibility checks over the local fixture
catalogue and route-family unit coverage. Attribute transfer again after the
guard is merged before claiming billed
savings. Vercel usage alerts are a secondary signal, not the CI egress guard.

## Repeatable Vercel report

Export the full team's newline-delimited charge data from the official
[FOCUS billing charges endpoint](https://vercel.com/docs/rest-api/billing/list-focus-billing-charges).
It provides one-day granularity. Keep the authenticated export local and ensure
it contains every project, SKU, region and the entire response. The report has
no network access and accepts an existing export:

```bash
node scripts/infrastructure-cost-report.mjs \
  --input /tmp/charges.ndjson \
  --from 2026-10-02T07:00:00Z \
  --until 2026-10-05T07:00:00Z \
  --cutover 2026-10-02T05:56:16.087Z \
  --baseline-from 2026-09-28T07:00:00Z \
  --baseline-until 2026-10-01T07:00:00Z
```

It groups metered consumption by project, stable SKU and unit, keeps unattributed
spend, separates `Subscription Licenses`, and reports EffectiveCost and
BilledCost separately. It rejects future windows, missing or overlapping
periods, partial provider periods, mixed currency and unsupported charge
categories/providers. Null consumption stays unavailable rather than becoming
zero. A covered 72-hour post-rollout window is only a time/coverage gate; it
does not prove completeness, comparable traffic, database savings or correctness.
The forecast flags compare the linear infrastructure pace with $15 headroom
and $20 included usage; both need provider allowance verification and traffic
context. Subscriptions, Neon and Silo charges are outside those flags.

Run the pure report regression with:

```bash
pnpm --filter api run test:infrastructure-cost-report
```

## Database budget and operational acceptance

Use the account's actual rates and an explicit dated USD-to-EUR conversion.
For a 30-day forecast, compute cost is `observed CU-hours / observed days *
30 * account rate`; add storage, history, branch allowances/overages, transfer,
all other resources and invoice taxes/fees before comparing with €5. A 0.25-CU
endpoint active for all 720 hours would use 180 CU-hours, costing $19.08 in
compute at the advertised rate alone. This is a sizing example; measured
endpoint activity, autoscaling and all resources determine the total. Do not compare
USD totals directly with the euro target or a transfer quantity with a compute
charge.

Pair each cost window with these measurements:

- Neon active CU-hours, transfer and statement read/write evidence, using
  provider counters rather than additional frequent database polling.
- [Due-work attribution](./cron-cadences.md#optional-dispatcher-attribution):
  idle skips, recovery scans, signal failures/races and signal-to-worker-start
  delay. Also record actual enqueue-to-provider completion from durable
  outboxes; the signal timestamp is only a scheduling proxy.
- Scheduled invocation counts, cache hits/misses and payloads, and real
  traffic/build/deployment activity. Separate middleware and function records.
- Status nonempty flush sizes, oldest queue age, duplicate/retry behavior and
  retention; hourly notification and daily Blob claimed/deleted/backlog counts
  and capacity warnings. Empty snapshots cannot prove burst capacity.
- [Admin navigation and idle measurement](./admin-request-attribution.md),
  followed by authenticated post-mutation freshness and an active automation
  session. Fixture tests and signed-out checks have separate evidentiary limits.
- Checkout ordering/idempotency and delivery provider outcomes; two-minute
  read-time location expiry, hourly physical retention, public visibility
  invalidation and scheduled News/social publishing/retry outcomes.

Keep attribution flags bounded and disable them after capture. Include their
overhead and all Silo/provider costs. If the combined measured budget exceeds
the targets, name the remaining SKU/project/wakeup source and propose a bounded
change. Retain unresolved billing/configuration or authenticated acceptance
explicitly; the report must never turn unknown metrics into a passed budget.
