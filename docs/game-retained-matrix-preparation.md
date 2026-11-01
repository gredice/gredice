# Retained matrix preparation

Issue #5067's scratch writer was delivered in #5115. `writeMeshInstanceMatrices`
owns its scratch objects per invocation, composes the shared local transform
once, and lends one matrix to a synchronous callback. `createChunkMatrices`
still allocates an independent Float64 buffer for every compiler request.
`createMeshInstanceMatrix` still returns an independently owned matrix.
Stable instance updates use the same writer. There is no Wasm runtime or
shared transferable output buffer.

Real-scene parity also exposed cached shadows that could be captured before
asynchronous packet replacement finished. Compilation now owns a lease in its
Canvas runtime until the resulting geometry commits, or cancellation/fallback
settles it. The shadow controller coalesces committed geometry revisions with
the existing deferred placement refresh and waits for pending geometry before
capturing the final map. Unchanged scenes retain their cached shadow map.
Post-render receipts report the committed and applied shadow revisions so a
profiling command can verify that the displayed result includes fresh shadows.

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
quality, DPR, shadows, fixed date, compiler readiness and heap-sampling protocol
across all five canonical profiles. Setup requests a fresh receipt so a fully
idle Low scene cannot retain stale statistics from before compilation committed.
The camera is fixed during setup. For the natural edit endpoint, Low preflight
also enables the passive probe without a command and requires zero additional
receipts or renderer frames.
Pass dates as `YYYY-MM-DD`; the old rejected ISO-timestamp route input is not
accepted. Fixture query positions are plain data, not renderer Vector3 objects.
Authenticated garden queries stay disabled; unexpected response/page errors
fail the capture rather than receiving a blanket authentication exception.

The primary method fixes four alternating AB/BA rounds, five commands per pass
per subject, and all five resolved canonical quality profiles. Cases are a
complete 8×8 spatial chunk, a 64×64 rebuild distributed across real 8-unit chunks,
and the existing high-target/fauna-heavy garden switch. Edit fixtures contain
ground plus rigid instanced `GardenBox`/`Stool` props with compatible planks so both stable instance writes and actual
multi-source Float64 compiler preparation are exercised. An immutable local
query-cache edit changes only selected top-block rotations; it never writes
garden or account data. The command is enabled only for the explicit matrix
debug fixture and isolated local sandbox namespace.
Each edit waits for its revision to commit in the displayed Canvas tree, not
only the incoming query, and must prepare exactly 128 or 8,192 matrices: one
ground and one prop transform per cell. The selected edits change 64 or 4,096
top blocks; retained chunk invalidation rebuilds both layers.
Each pass receives four unmeasured warmup commands before a fresh capture and
collection boundary. `--smoke-only` runs a one-round High-quality diagnostic;
the summarizer rejects smoke/setup reports as primary acceptance.

For a complete confirmation with finer tail resolution, add
`--latency-samples-per-round 20 --vary-latency-dispatch`. This keeps all four
rounds, all fifteen cases, and the same acceptance limits, with eighty latency
samples per subject/case. Stage/allocation passes retain twenty samples.
Dispatch is delayed deterministically by 0–36 ms after an animation frame,
outside the measured window; each receipt retains dispatch/frame/submission
timestamps. Preserve preceding failed captures alongside any confirmation.
The append-only journal retains full evidence; the final index streams heavy
heap/trace windows into checksum-verified sidecars rather than retaining the
whole capture in the collector's heap. Only complete cohorts can be summarized.

Three separate passes prevent profiler costs from being called application
improvements:

- **Stages:** opt-in bounded observations separate writer/full-hook preparation,
  packing, transfer submission, worker execution, synchronous execution and
  unpacking. Browser wrappers time WebGL buffer upload **submission**, not GPU
  execution or upload completion. Unpacking is not reported as GPU upload.
- **Latency:** writer observations and upload wrappers are off. By default,
  edits retain the first naturally submitted frame matching their displayed
  Canvas epoch, with compilation, shadows and owned rotation springs settled.
  A passive probe publishes each naturally scheduled frame during the command;
  it requests no render or camera work. Its immutable first matching receipt
  cannot be replaced by a later frame if polling resumes late. The camera was
  fixed before timing (position −100/100/−100, target 0/0/0, zoom 100).
  Garden switches retain the existing endpoint: CSS transition and compilation
  settle, followed by a fresh receipt at the restored comparison camera.
  `--edit-endpoint fenced` retains that earlier camera/render fence for edits
  as well. The ordinary 500 ms statistics interval is unchanged outside a probe.
  These are renderer submission endpoints, not network, physical display
  latency or FPS. Twenty samples (or eighty with the explicit confirmation
  option) retain absolute p50/p95 and full ranges. Prospectively, p50 and p95
  must be no more than reference ×1.05 plus 1 ms; a faster kernel cannot waive
  an end-to-end regression.
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

Two complete fenced-endpoint captures remain unsuccessful acceptance cohorts:
the twenty-sample cohort missed two latency gates and the eighty-sample cohort
missed four. Both improved larger-rebuild preparation and sampled allocation,
and all visual pairs passed. Those observations do not override the failed
latency gates. Source review showed that the fence explicitly requests render
and camera work after readiness; it measures beyond the first matching natural
frame. That does not establish the cause of any tail difference. The passive
edit endpoint is a separately declared method, with the same numerical limits;
it cannot relabel either earlier capture as a pass.

The dedicated High-target placement diagnostic exposed a stale content pin:
both allocating and scratch production builds reported thirteen grounding
shadows (five birds/mammals and eight insects), while its old guard expected
five. All six runs already produced exactly one final placement flush and one
primary shadow refresh. The content pin now requires thirteen; the unit rejects
the obsolete count. Frame, memory, draw, placement and latency limits are unchanged.
