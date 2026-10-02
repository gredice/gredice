# Suncokret cost accounting

`POST /api/ai/suncokret/chat` reserves estimated cost before generation. The
reservation counts against both the rolling daily cap and the weekly cap.

When generation finishes, `scheduleSuncokretUsageSettlement` registers cost
settlement with Vercel `waitUntil`. Chat completion and message persistence do
not wait for Gateway usage ingestion. Debug finish metadata reports a token
estimate with `costSource: 'token-estimate'`; the ledger is authoritative.

Each unique Gateway generation is looked up once initially. Only a 404
`Usage event not found` response is retried, after 1, 2 and 4 seconds. Successful
lookups are retained while other tool steps retry. A shared 15-second deadline
bounds lookups and backoff, and aborts pending network requests.

The reservation remains counted until settlement finalizes that request's
ledger row. When all generation costs are available, their billed totals are
summed and converted using the configured USD/EUR rate. Missing metadata,
invalid costs, retry exhaustion, timeout or other lookup failures finalize the
row using token-estimated cost. Persistent lookup failure produces one warning
per request. A database finalization failure logs an error and retains the
reservation; it does not release quota or retry the write.

There is no historical balance correction, reconciliation scan or schema change.
Usage that arrives after the bounded polling window keeps its token estimate.

Focused regressions:

```bash
pnpm --filter api exec node --import tsx --test --conditions=react-server lib/ai/suncokretModels.node.spec.ts lib/ai/suncokretUsageSettlement.node.spec.ts lib/ai/suncokretUsage.node.spec.ts
pnpm --filter @gredice/storage exec bash ./tests/runNodeTests.sh aiChatRepo.node.spec.ts
```

The [Gateway generation lookup documentation](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api#look-up-a-generation)
describes asynchronous usage ingestion and delayed availability.
