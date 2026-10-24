# Suncokret cost accounting

`POST /api/ai/suncokret/chat` reserves estimated cost before generation. The
reservation counts against both the rolling daily cap and the weekly cap.

When generation finishes, `scheduleSuncokretUsageSettlement` registers cost
settlement with Vercel `waitUntil`. Chat completion and message persistence do
not wait for Gateway usage ingestion. Debug finish metadata reports a token
estimate with `costSource: 'token-estimate'`; the ledger is authoritative.

Each unique Gateway generation is looked up once initially. Only a 404
`Usage event not found` response is retried, after 1, 2, 4, 8, 16 and 32 seconds
(seven attempts, with the final poll after 63 seconds of backoff). Successful
lookups are retained while other tool steps retry. A shared 90-second deadline
bounds lookups and backoff, and aborts pending network requests. The API route's
existing 300-second maximum duration is unchanged. Vercel's `getDeadline()` caps
polling to the invocation's remaining runtime minus five seconds for ledger
persistence. If only that headroom remains, settlement skips polling and
immediately persists the estimate. Outside Vercel, where no invocation deadline
is available, the 90-second bound applies. Polling remains outside the chat
stream; the reservation stays counted in both quotas throughout the longer window.

The reservation remains counted until settlement finalizes that request's
ledger row. When all generation costs are available, their billed totals are
summed and converted using the configured USD/EUR rate. Missing metadata,
invalid costs, retry exhaustion, timeout or other lookup failures finalize the
row using token-estimated cost. Persistent lookup failure produces one warning
per request, including the ledger ID and all unique generation IDs for a
read-only comparison. A database finalization failure logs an error and retains
the reservation; it does not release quota or retry the write.

There is no historical balance correction, reconciliation scan or schema change.
Usage that arrives after the bounded polling window keeps its token estimate.

## Read-only investigation on 4 October 2026

Three successful chats at 19:37 UTC on 3 October exhausted the original
1/2/4-second retries deployed by #5076. All three reported generations now return
HTTP 200 from the Gateway generation endpoint using the configured production API
key. This supports delayed ingestion; the exact availability lag was not measured.
The production ledger was inspected in a `BEGIN READ ONLY` transaction and rolled
back. No production data was corrected.

| Chat start, 3 October UTC | Finalized estimate, micro EUR | Gateway cost, micro EUR at the configured 0.88 USD/EUR rate |
| --- | ---: | ---: |
| 19:37:03 | 607 | At least 727 |
| 19:37:33 | 168 | 497 |
| 19:37:56 | 149 | 478 |

The latter two generation records match all stored input/cache/output token
counts. The first reported generation finished with tool calls, so its cost is
only a lower bound on that chat's total. The three rows undercount quota cost by
at least 778 micro EUR (EUR 0.000778), including Gateway costs not represented by
token pricing. These are usage-quota entries, not customer payment debits.
The affected account's four finalized rows in the relevant rolling-day window
totaled 1,357 micro EUR with no pending reservations, below even the default trial
daily cap of 300,000 micro EUR. No quota exhaustion or overcharge was established.

The longer retry window addresses availability after the old seven-second
backoff window without changing caps, token pricing, reservations, historical
ledger rows, or schema. It remains bounded: ingestion later than this window still
uses the documented estimate fallback. A durable reconciliation queue would be a
separate change if longer delays recur.

Focused regressions:

```bash
pnpm --filter api exec node --import tsx --test --conditions=react-server lib/ai/suncokretModels.node.spec.ts lib/ai/suncokretUsageSettlement.node.spec.ts lib/ai/suncokretUsage.node.spec.ts
pnpm --filter @gredice/storage exec bash ./tests/runNodeTests.sh aiChatRepo.node.spec.ts
```

The [Gateway generation lookup documentation](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api#look-up-a-generation)
describes asynchronous usage ingestion and delayed availability.
