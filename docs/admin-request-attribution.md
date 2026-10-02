# Admin request attribution and read reuse

Issue: [#5088](https://github.com/gredice/gredice/issues/5088), within [#5089](https://github.com/gredice/gredice/issues/5089).

## Baseline and limits

The 2026-10-02 production audit recorded 21,387 Admin function-source records over 72 hours, with several navigation destinations around 700–800. These records can overlap middleware/function work and are not unique visits. The audit did not include RSC/prefetch headers or PostgreSQL statement statistics, so it does not establish prefetch as a cause or quantify this change's production savings.

Source attribution identifies two avoidable paths:

- The Admin layout's approval badge called the full approval-list builder, including both operation and plant-sort catalogues and task decoration.
- The dashboard repeated the layout's approval count, CMS review count, achievement count, and quick-action setting. The approval page also repeated the badge's three core data loads.

The layout/category readers and the dashboard's raw entity-type reader have different filtering semantics and remain separate. Link prefetch behavior remains the existing Next.js default. The automation table's seven-second refresh remains restricted to live runs. API polling and the social cron are separate request sources; the latter is covered by the background-work issues.

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

## Validation and comparable rollout measurements

Run `pnpm --filter app run test:unit`. The new tests use Next's real RSC renderer to check one core load per render, a fresh next request, overlapping session isolation, same-request failure sharing and later retry, planting eligibility, and sanitized header classification. The fixture prints three measured core reads for a badge plus list render. It is not a production SQL or cost benchmark.

Before and after deployment, repeat the same authenticated sequence on `/admin`, `/admin/approvals`, `/admin/schedule`, and a delivery page, followed by an idle window. Record elapsed time, deployment SHA, actual navigations, network RSC/prefetch flags, API polling, and enabled attribution records. Check approvals and badges after a mutation and retry a failed navigation. Include an active automation-run session separately from an idle session.

Compare equally sized production windows with route function invocations, middleware records separately, attributed prefetch/render groups, Redis hit/miss and payload evidence, database reads/bytes when available, and billed CPU. Confirm net savings after excluding attribution overhead and changing user activity. Production request attribution, browser workflow acceptance, and a comparable 72-hour cost window are outstanding until this deployment has been measured; the local read reduction does not close those acceptance criteria.
