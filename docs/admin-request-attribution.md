# Admin request attribution and read reuse

Issue: [#5088](https://github.com/gredice/gredice/issues/5088), within [#5089](https://github.com/gredice/gredice/issues/5089).

## Baseline and limits

The 2026-10-02 production audit recorded 21,387 Admin function-source records over 72 hours, with several navigation destinations around 700–800. These records can overlap middleware/function work and are not unique visits. The audit did not include RSC/prefetch headers or PostgreSQL statement statistics, so it does not establish prefetch as a cause or quantify this change's production savings.

Source attribution identifies two avoidable paths:

- The Admin layout's approval badge called the full approval-list builder, including both operation and plant-sort catalogues and task decoration.
- The dashboard repeated the layout's approval count, CMS review count, achievement count, and quick-action setting. The approval page also repeated the badge's three core data loads.

The layout/category readers and the dashboard's raw entity-type reader have different filtering semantics and remain separate. Admin sidebar `NavItem` links disable prefetch after the read-only production sample below demonstrated 63 private, uncached prefetch requests during three selected client navigations. The automation table's seven-second refresh remains restricted to live runs. API polling and the social cron are separate request sources; the latter is covered by the background-work issues.

## Changed read paths

The following counts cover the named repository calls, not every query in a route. Redis hits can already avoid some SQL while still retrieving/parsing the returned data.

| Render path | Baseline source calls | Changed source calls |
| --- | --- | --- |
| Any Admin layout: approval badge | 3 core reads + 2 catalogues + full task decoration | 3 core reads + eligibility count; no catalogue or decoration |
| Layout + dashboard: approval badges | 6 core reads + 4 catalogues | 3 core reads, once per render |
| Layout + dashboard: CMS/achievement counts and quick-action setting | 6 reads | 3 reads |
| Layout + approvals page | 6 core reads + 4 catalogues | 3 core reads + 2 catalogues for the actual list |

`adminRequestRead` uses React `cache`, which shares in-flight results and failures within a React render request. It adds no persistent cache or TTL. New requests, including a retry or a different Admin session, read again. Existing storage cache keys, TTLs, invalidation, role checks, and action revalidation stay in place. All callers still authorize the Admin role before these server-only readers. The count and list share the legacy/selected planting eligibility predicates, including abandoned-bed, completion, and deleted-membership rules.

## Optional production attribution

Set `ADMIN_REQUEST_ATTRIBUTION=1` on the Admin app for a short measurement window, then unset it. It is disabled by default. Each physical read in the changed paths emits an `admin-request-read` record with:

- A random request UUID, shared by this render's records.
- Boolean `rsc`, `routerPrefetch`, `segmentPrefetch`, and `browserPrefetch` flags from `rsc`, `next-router-prefetch`, `next-router-segment-prefetch`, `purpose`, and `sec-purpose` headers.
- A fixed reader name, elapsed milliseconds, and a failure flag.

The records contain no cookies, authorization values, user/account IDs, URLs, query strings, returned data, or error text. Header/logging failures do not change the read result. These timings include existing Redis/database/replay work and are not billed CPU or SQL counts. `approvals.pending-data` groups the three core repository reads; `approvals.pending-count` includes awaiting that shared group and counting. Do not add their durations together as independent work.

Group these records by request UUID, then correlate deployment/time and route invocation aggregates in Vercel. Header flags distinguish indicated prefetch from ordinary RSC work, but an unflagged request is not proof of user activity. Use a recorded navigation/idle script to establish actual user activity rather than inferring it from logs.

## Bounded browser measurement

Run the read-only measurement harness with an existing authenticated Playwright storage-state file stored locally outside the repository:

```bash
node scripts/admin-request-measurement.mjs \
  --storage-state /absolute/local/path/admin-state.json
```

The target is fixed to `https://app.gredice.com`. A local fixture or development server can use `--origin http://127.0.0.1:<port>` or `--origin http://localhost:<port>`; other origins, credentials, paths, query strings, and fragments are rejected. No option accepts custom navigation paths or an output file. The harness loads only Admin session cookies for the target and discards unrelated cookies and all local storage. It never writes storage state, records response bodies, or prints cookies, raw headers, query strings, page text, private route identifiers, or raw browser errors. The existing local state remains sensitive and must not be committed.

The fixed sequence uses document navigation to `/admin`, `/admin/approvals`, `/admin/schedule`, and `/admin/delivery/requests`, with three seconds to settle after each route, then fifteen seconds idle on delivery requests. `--settle-ms`, `--idle-ms`, and `--timeout-ms` adjust bounded intervals; total runtime defaults to ninety seconds and cannot exceed two minutes. Navigation requires the authenticated Admin shell, a successful response, and the expected path; a failed run exits with a nonzero status and a sanitized report.

The JSON report records actual document navigations, route acceptance and duration, browser error counts, and request counts grouped by activity phase, fixed route bucket, safe method category, and indicated-prefetch/ordinary-RSC/other classification. Response attribution reduces `x-vercel-cache`, `server`, and `cache-control` to bounded classifications; raw header values are never reported. Cancelled requests remain separate from failures and HTTP errors. Dynamic Admin routes and API paths collapse to `/admin/other` and `/api/other`. Requests initiated during idle remain attributed to idle even if they later complete; this describes the script's activity, not proof of another real user's activity. Browser requests are not function invocations, unique visits, SQL reads, Redis bytes, or billed CPU.

All non-read HTTP methods are blocked, including Server Actions, analytics uploads, and refresh-token writes. An expired session may therefore fail acceptance and needs a fresh existing local state. `/admin/automations` is excluded because its page initializes default automation definitions; this harness does not exercise an active automation session or perform a mutation. Client navigation, post-mutation badge/list freshness, and operation retry acceptance require separate focused checks in a disposable authenticated environment. Do not treat a completed read-only report as acceptance of those workflows.

Run the privacy and browser-fixture regressions with the existing Admin Playwright Chromium installation:

```bash
pnpm --filter app run test:admin-request-measurement
```

The real browser fixture uses only an ephemeral loopback server and a fake session cookie. It verifies that prefetch and idle requests are attributed, private URL/header/body values are absent from the report, and no attempted POST reaches the fixture. Parser tests reject arbitrary origins, output locations, paths, remote state URLs, and unbounded intervals. Browser error text is also checked for accidental disclosure. A delayed-start regression confirms that timeout cleanup joins the worker and closes a browser that finishes launching after cancellation. Parsing/privacy regressions also run in `test:unit`; the Chromium fixture runs only in the dedicated command above.

## Read-only production navigation evidence, 2026-10-02

An existing authenticated Edge session accepted the production dashboard and client-link navigations to approvals, schedule, and delivery requests. The approvals page showed its empty state. No mutations, operation retries, session exports, or attribution environment changes were performed. The capture started after the initial dashboard document load and is a small browser sample, not a matched production cost comparison.

During schedule navigation, opening the **Logistika** navigation group, and navigating to delivery requests, 63 captured GET requests indicated prefetch: 61 collapsed to `/admin/other` and two targeted `/admin/delivery/requests`. Their observed responses classified as `x-vercel-cache: MISS`, server `vercel`, and cache control `no-store`. Eight subsequently cancelled; none of these captured responses returned an HTTP error. The browser event buffer reported an older-history truncation, so the sample does not cover earlier dashboard loading or all activity in the session.

The **Logistika** group visibly mounted links for delivery slots, requests, operations, and notifications. In source, `NavGroup` mounts its children when expanded and `NavItem` rendered Next `Link` with default prefetch. Other already visible navigation links could also prefetch; the sample does not assign every prefetch to a particular link. It demonstrates private, uncached work for destinations beyond the three selected pages.

Sidebar `NavItem` now uses `prefetch={false}`. The installed Next App Router `Link` disables viewport, hover, and touch prefetch with that prop while preserving client navigation on click. The clicked destination may need one fetch at click time instead of using speculative data; accepting that possible navigation delay avoids preparing unvisited private pages. Click/drag handling, active styling, authorization, and badges remain unchanged. Public links, shared UI links, breadcrumbs, dashboard links, and operational refresh keep their existing behavior. A fresh authenticated browser pass after deployment must confirm selected routes still load and classify any remaining prefetch by its other source. The change does not establish billed CPU savings or complete the comparable production cost criterion.

An exact fifteen-second delivery idle window, **11:12:55.917–11:13:10.943 UTC**, recorded zero same-origin requests, including zero Admin, RSC, prefetch, and API requests. The window began at a fresh event cursor to exclude preceding navigation/settling. This confirms no polling in that one idle sample. Active automation-run refresh, actual mutation invalidation, client retry behavior, private-session browser isolation, and comparable production net savings remain separate pending checks.

## Record-detail prefetch attribution after sidebar rollout

A fresh authenticated pass on merged commit `a2f04ddcbe9973062f9a3a6bacee171a438f8a66` accepted dashboard, approvals, schedule and delivery navigation. The observed immutable client bundle contained the sidebar's compiled `prefetch: false`. Expanding **Logistika** mounted its four links without prefetching any of their destinations. An exact fifteen-second delivery idle window, **11:39:00.467–11:39:15.488 UTC**, recorded zero same-origin requests.

Remaining speculative requests came from schedule content. A later bounded interval captured **47** indicated-prefetch GETs: **17** for bed details across **15** distinct bed paths and **30** for operation details across **26** distinct operation paths. All had the router-prefetch flag; six also had the segment-prefetch flag. Observed responses were private `MISS`/`no-store`. The schedule DOM contained 35 bed-detail links (14 in the viewport) and 124 operation-detail links (19 in the viewport); those detail destinations were absent from the sidebar. Opening the navigation group overlapped continued schedule row prefetch and did not cause it. No entity IDs, raw paths, query strings or headers are retained in this report.

Navigating to delivery requests then captured eleven detail-prefetch GETs: ten for operation details and one for a bed. The page contained 65 operation-detail anchors, thirteen in the viewport, matching the operation requests. The one bed request may have remained queued from schedule navigation and is not attributed to a delivery link. All 58 detail requests in this untruncated sample had the router-prefetch flag and private `MISS`/`no-store` responses; none returned an HTTP error. This sample is separate from the earlier fifteen-second idle measurement.

The three schedule section components now disable prefetch on their farm, bed and operation detail links. The delivery row's related-operation action also disables prefetch; shared `Button` link props expose Next Link's existing prefetch option without changing the default. Fetching a selected destination at click time preserves navigation while avoiding speculative work for the many unvisited records. Schedule mutations and refresh behavior are unchanged. A fresh production pass must verify this second change and classify any remaining request sources. The short browser samples differ in captured loading and settling activity and do not establish net request or billing savings.

## Validation and comparable rollout measurements

Run `pnpm --filter app run test:unit`. The new tests use Next's real RSC renderer to check one core load per render, a fresh next request, overlapping session isolation, same-request failure sharing and later retry, planting eligibility, and sanitized header classification. The fixture prints three measured core reads for a badge plus list render. It is not a production SQL or cost benchmark.

Before and after deployment, repeat the same authenticated sequence on `/admin`, `/admin/approvals`, `/admin/schedule`, and a delivery page, followed by an idle window. Record elapsed time, deployment SHA, actual navigations, network RSC/prefetch flags, API polling, and enabled attribution records. Check approvals and badges after a mutation and retry a failed navigation. Include an active automation-run session separately from an idle session.

Compare equally sized production windows with route function invocations, middleware records separately, attributed prefetch/render groups, Redis hit/miss and payload evidence, database reads/bytes when available, and billed CPU. Confirm net savings after excluding attribution overhead and changing user activity. Production request attribution, browser workflow acceptance, and a comparable 72-hour cost window are outstanding until this deployment has been measured; the local read reduction does not close those acceptance criteria.
