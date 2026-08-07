import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';

const maxDurationSamples = 256;
const durationSamples: number[] = [];
let placementChunkLogicalTouchedCount = 0;
let placementChunkLogicalUpdateCount = 0;
let placementChunkPhysicalRebuildCount = 0;
let placementChunkPhysicalRebuildDurationMaxMs = 0;
let placementChunkPhysicalTransformedInstanceCount = 0;

function durationPercentile95() {
    if (durationSamples.length === 0) {
        return 0;
    }

    const sortedSamples = [...durationSamples].sort(
        (left, right) => left - right,
    );
    const index = Math.max(0, Math.ceil(sortedSamples.length * 0.95) - 1);

    return sortedSamples[index] ?? 0;
}

export function placementAnimationProfileNow() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function shouldRecordPlacementAnimationChunkRebuild({
    currentInstances,
    currentPlacementSignature,
    previousInstances,
    previousPlacementSignature,
}: {
    currentInstances: readonly unknown[];
    currentPlacementSignature: string;
    previousInstances: readonly unknown[] | undefined;
    previousPlacementSignature: string | undefined;
}) {
    return (
        previousInstances !== undefined &&
        previousInstances !== currentInstances &&
        (previousPlacementSignature !== '' || currentPlacementSignature !== '')
    );
}

export function readPlacementAnimationProfileMetrics() {
    return {
        placementChunkLogicalTouchedCount,
        placementChunkLogicalUpdateCount,
        placementChunkPhysicalRebuildCount,
        placementChunkPhysicalRebuildDurationMaxMs,
        placementChunkPhysicalRebuildDurationP95Ms: durationPercentile95(),
        placementChunkPhysicalTransformedInstanceCount,
    };
}

function publishPlacementAnimationProfileMetrics() {
    updateGameProfileMetadata(readPlacementAnimationProfileMetrics());
}

export function resetPlacementAnimationProfileMetrics() {
    durationSamples.length = 0;
    placementChunkLogicalTouchedCount = 0;
    placementChunkLogicalUpdateCount = 0;
    placementChunkPhysicalRebuildCount = 0;
    placementChunkPhysicalRebuildDurationMaxMs = 0;
    placementChunkPhysicalTransformedInstanceCount = 0;
    publishPlacementAnimationProfileMetrics();
}

export function recordPlacementAnimationChunkUpdate({
    touchedChunkCount,
}: {
    touchedChunkCount: number;
}) {
    placementChunkLogicalTouchedCount += Math.max(0, touchedChunkCount);
    placementChunkLogicalUpdateCount += 1;
    publishPlacementAnimationProfileMetrics();
}

export function recordPlacementAnimationChunkRebuild({
    durationMs,
    transformedInstanceCount,
}: {
    durationMs: number;
    transformedInstanceCount: number;
}) {
    const safeDurationMs =
        Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;

    placementChunkPhysicalRebuildCount += 1;
    placementChunkPhysicalTransformedInstanceCount += Math.max(
        0,
        transformedInstanceCount,
    );
    placementChunkPhysicalRebuildDurationMaxMs = Math.max(
        placementChunkPhysicalRebuildDurationMaxMs,
        safeDurationMs,
    );
    durationSamples.push(safeDurationMs);
    if (durationSamples.length > maxDurationSamples) {
        durationSamples.shift();
    }

    publishPlacementAnimationProfileMetrics();
}
