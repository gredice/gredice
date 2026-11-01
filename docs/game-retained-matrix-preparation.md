# Retained matrix preparation

Issue #5067's scratch writer was delivered in #5115. `writeMeshInstanceMatrices`
owns its scratch objects per invocation, composes the shared local transform
once, and lends one matrix to a synchronous callback. `createChunkMatrices`
still allocates an independent Float64 buffer for every compiler request.
`createMeshInstanceMatrix` still returns an independently owned matrix.
Stable instance updates use the same writer. There is no Wasm runtime or
shared transferable output buffer.

## Integrated production measurement

`profile-chunk-matrices.mjs` compares two separately built production subjects.
The allocating reference must differ only in the writer body: iterate instances
and call the unchanged single-matrix API for each callback. Keep profiling,
dependencies, fixtures and all other Game source identical. Commit both local
subjects and build with their exact `NEXT_PUBLIC_GAME_PROFILE_SOURCE_COMMIT`,
`NEXT_PUBLIC_GAME_PROFILE_SOURCE_DIRTY=false` and comparison contract version 6.
Do not point this experiment at a deployed site.

The subject JSON is an ordered array (reference, candidate) containing `label`,
`url`, `sourceCommit` and `writerSourceSha` (SHA-256 of the complete authored
`chunkedMeshGeometry.ts`). Start each production server on its own local port.

```bash
pnpm --filter garden profile:game:matrices --subjects /path/to/subjects.json \
  --out-dir .game-profile-results/matrices-preflight --preflight-only
pnpm --filter garden profile:game:matrices --subjects /path/to/subjects.json \
  --out-dir .game-profile-results/matrices-primary
pnpm --filter garden exec node scripts/summarize-chunk-matrices.mjs \
  .game-profile-results/matrices-primary/latest.json \
  .game-profile-results/matrices-primary/summary.json
```

Use a fresh output directory per attempt. A zero-command preflight verifies
actual loaded JS/source maps, the writer hash, camera, source commit, resolved
quality, DPR, shadows, fixed date, compiler readiness and heap-sampling protocol.
Pass dates as `YYYY-MM-DD`; the old rejected ISO-timestamp route input is not
accepted. Fixture query positions are plain data, not renderer Vector3 objects.
Authenticated garden queries stay disabled; unexpected response/page errors
fail the capture rather than receiving a blanket authentication exception.

The primary method fixes four alternating AB/BA rounds, five commands per pass
per subject, and all five resolved canonical quality profiles. Cases are a
complete 8×8 spatial chunk, a 64×64 rebuild distributed across real 8-unit chunks,
and the existing high-target/fauna-heavy garden switch. Edit fixtures contain
ground plus mixed rigid wooden props with shared materials so both stable instance writes and actual
multi-source Float64 compiler preparation are exercised. An immutable local
query-cache edit changes only selected top-block rotations; it never writes
garden or account data. The command is enabled only for the explicit matrix
debug fixture and isolated local sandbox namespace.
Each pass receives four unmeasured warmup commands before a fresh capture and
collection boundary. `--smoke-only` runs a one-round High-quality diagnostic;
the summarizer rejects smoke/setup reports as primary acceptance.

Three separate passes prevent profiler costs from being called application
improvements:

- **Stages:** opt-in bounded observations separate writer/full-hook preparation,
  packing, transfer submission, worker execution, synchronous execution and
  unpacking. Browser wrappers time WebGL buffer upload **submission**, not GPU
  execution or upload completion. Unpacking is not reported as GPU upload.
- **Latency:** observers and upload wrappers are off. The endpoint is a settled
  compiled scene plus a fresh post-render receipt, fenced by restoring the
  unchanged camera pose. A one-shot receipt request bypasses the ordinary 500 ms
  statistics reporting throttle without changing rendering or the normal
  reporting interval. It is renderer edit/switch latency, not network,
  physical display latency, or FPS. Twenty samples retain absolute p50/p95 and
  full ranges. Prospectively, p50 and p95 must be no more than reference ×1.05
  plus 1 ms; a faster kernel cannot waive an end-to-end regression.
- **Allocation/GC:** V8 sampled heap profiles include collected objects and retain
  original call trees/source maps. Allocation attributed to a transform ancestor
  is an estimate, not exact bytes or external Float64 backing-store accounting.
  Natural renderer GC traces remain raw; nested GC categories are not summed,
  and no historical pause cause is inferred. Forced collection occurs only
  between passes, before sampling/tracing, never inside the measured window.

The existing matrix/geometry, ownership, cancellation, fallback and placement
tests remain required, together with Game and consumer typechecks, real WebGL
component coverage and unchanged canonical production profiling gates. Native
desktop measurements and browser hardware overrides do not establish phone
thermal behavior or an FPS gain.
