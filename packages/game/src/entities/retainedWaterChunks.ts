import type { ChunkedMeshInstance } from './chunkedMeshGeometry';
import type { createMergedWaterSideGeometry } from './waterBlockGeometry';

type WaterSideInstance = Parameters<
    typeof createMergedWaterSideGeometry
>[0][number];

import type { WaterTopChunkInstance } from './waterChunkGeometry';

function numbersEqual(
    left: readonly number[] | undefined,
    right: readonly number[] | undefined,
) {
    return (
        left === right ||
        (left?.length === right?.length &&
            Boolean(left?.every((value, index) => value === right?.[index])))
    );
}

export function waterTopInstancesEqual(
    left: WaterTopChunkInstance,
    right: WaterTopChunkInstance,
) {
    return (
        numbersEqual(left.position, right.position) &&
        left.rotation === right.rotation &&
        left.waterHeight === right.waterHeight &&
        left.surfaceY === right.surfaceY &&
        left.shoreDepth === right.shoreDepth &&
        left.foamEdges.equals(right.foamEdges) &&
        left.foamCorners.equals(right.foamCorners) &&
        numbersEqual(left.depthSamples, right.depthSamples) &&
        numbersEqual(left.shoreDepthSamples, right.shoreDepthSamples)
    );
}

export function waterSideInstancesEqual(
    left: WaterSideInstance,
    right: WaterSideInstance,
) {
    return (
        numbersEqual(left.position, right.position) &&
        left.waterHeight === right.waterHeight &&
        left.surfaceY === right.surfaceY &&
        left.depth === right.depth &&
        numbersEqual(left.depthSamples, right.depthSamples) &&
        numbersEqual(left.shoreDepthSamples, right.shoreDepthSamples)
    );
}

/** Side occlusion examines only the same column and its four unit-grid neighbors.
 * Shore depth has already been resolved globally before this local geometry gate. */
export function waterSideNeighbors<T extends ChunkedMeshInstance>(
    instances: T[],
    all: T[],
) {
    const keys = new Set<string>();
    for (const {
        position: [x, , z],
    } of instances) {
        for (const [dx, dz] of [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ])
            keys.add(`${x + dx}|${z + dz}`);
    }
    return all.filter(({ position }) =>
        keys.has(`${position[0]}|${position[2]}`),
    );
}
