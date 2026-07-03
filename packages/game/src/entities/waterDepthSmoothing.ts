import type { WaterBlockDepthSamples } from './waterBlockDepth';
import { defaultWaterBlockVisualHeight } from './waterBlockGeometry';
import type { WaterTopChunkInstance } from './waterChunkGeometry';

const waterBlockHalfSize = 0.5;
const waterTopDepthSmoothingRadius = 0.95;
const maxSurfaceDelta = defaultWaterBlockVisualHeight * 3.25;

const waterDepthSamplePositions: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
] = [
    [-waterBlockHalfSize, -waterBlockHalfSize],
    [-waterBlockHalfSize, waterBlockHalfSize],
    [waterBlockHalfSize, waterBlockHalfSize],
    [waterBlockHalfSize, -waterBlockHalfSize],
];

function stackPositionKey(x: number, z: number) {
    return `${x}|${z}`;
}

function groupInstancesByPosition(instances: WaterTopChunkInstance[]) {
    const groups = new Map<string, WaterTopChunkInstance[]>();

    for (const instance of instances) {
        const [x, , z] = instance.position;
        const key = stackPositionKey(x, z);
        const group = groups.get(key);

        if (group) {
            group.push(instance);
        } else {
            groups.set(key, [instance]);
        }
    }

    return groups;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number) {
    return clamp(value, 0, 1);
}

function lerp(start: number, end: number, value: number) {
    return start + (end - start) * value;
}

function sampleDepthAtLocalPosition({
    depthSamples,
    localX,
    localZ,
}: {
    depthSamples: WaterBlockDepthSamples;
    localX: number;
    localZ: number;
}) {
    const u = clamp01(localX + waterBlockHalfSize);
    const v = clamp01(localZ + waterBlockHalfSize);
    const negativeZ = lerp(depthSamples[0], depthSamples[3], u);
    const positiveZ = lerp(depthSamples[1], depthSamples[2], u);

    return lerp(negativeZ, positiveZ, v);
}

function sampleDepthAtWorldPosition({
    instance,
    x,
    z,
}: {
    instance: WaterTopChunkInstance;
    x: number;
    z: number;
}) {
    return sampleDepthAtLocalPosition({
        depthSamples: instance.depthSamples,
        localX: x - instance.position[0],
        localZ: z - instance.position[2],
    });
}

function distanceToInstanceFootprint({
    instance,
    x,
    z,
}: {
    instance: WaterTopChunkInstance;
    x: number;
    z: number;
}) {
    const [instanceX, , instanceZ] = instance.position;
    const nearestX = clamp(
        x,
        instanceX - waterBlockHalfSize,
        instanceX + waterBlockHalfSize,
    );
    const nearestZ = clamp(
        z,
        instanceZ - waterBlockHalfSize,
        instanceZ + waterBlockHalfSize,
    );

    return Math.hypot(x - nearestX, z - nearestZ);
}

function getSmoothingCandidates({
    instancesByPosition,
    x,
    z,
}: {
    instancesByPosition: Map<string, WaterTopChunkInstance[]>;
    x: number;
    z: number;
}) {
    const candidates: WaterTopChunkInstance[] = [];
    const searchMinX = Math.floor(
        x - waterBlockHalfSize - waterTopDepthSmoothingRadius,
    );
    const searchMaxX = Math.ceil(
        x + waterBlockHalfSize + waterTopDepthSmoothingRadius,
    );
    const searchMinZ = Math.floor(
        z - waterBlockHalfSize - waterTopDepthSmoothingRadius,
    );
    const searchMaxZ = Math.ceil(
        z + waterBlockHalfSize + waterTopDepthSmoothingRadius,
    );

    for (
        let candidateX = searchMinX;
        candidateX <= searchMaxX;
        candidateX += 1
    ) {
        for (
            let candidateZ = searchMinZ;
            candidateZ <= searchMaxZ;
            candidateZ += 1
        ) {
            candidates.push(
                ...(instancesByPosition.get(
                    stackPositionKey(candidateX, candidateZ),
                ) ?? []),
            );
        }
    }

    return candidates;
}

function depthSmoothingWeight({
    candidate,
    distance,
    instance,
}: {
    candidate: WaterTopChunkInstance;
    distance: number;
    instance: WaterTopChunkInstance;
}) {
    if (distance > waterTopDepthSmoothingRadius) {
        return 0;
    }

    const surfaceDelta = Math.abs(candidate.surfaceY - instance.surfaceY);
    if (surfaceDelta > maxSurfaceDelta) {
        return 0;
    }

    const distanceFactor = 1 - distance / waterTopDepthSmoothingRadius;
    const verticalFactor =
        1 - Math.min(surfaceDelta / maxSurfaceDelta, 1) * 0.35;

    return distanceFactor * distanceFactor * verticalFactor;
}

function smoothValueAtWorldPosition({
    instancesByPosition,
    instance,
    sampleValue,
    x,
    z,
}: {
    instancesByPosition: Map<string, WaterTopChunkInstance[]>;
    instance: WaterTopChunkInstance;
    sampleValue: (input: {
        instance: WaterTopChunkInstance;
        x: number;
        z: number;
    }) => number;
    x: number;
    z: number;
}) {
    let weightedValue = 0;
    let totalWeight = 0;

    for (const candidate of getSmoothingCandidates({
        instancesByPosition,
        x,
        z,
    })) {
        const distance = distanceToInstanceFootprint({
            instance: candidate,
            x,
            z,
        });
        const weight = depthSmoothingWeight({
            candidate,
            distance,
            instance,
        });

        if (weight <= 0) {
            continue;
        }

        weightedValue +=
            sampleValue({
                instance: candidate,
                x,
                z,
            }) * weight;
        totalWeight += weight;
    }

    if (totalWeight <= 0) {
        return sampleValue({ instance, x, z });
    }

    return weightedValue / totalWeight;
}

function smoothSamplesForInstance({
    instancesByPosition,
    instance,
    sampleValue,
}: {
    instancesByPosition: Map<string, WaterTopChunkInstance[]>;
    instance: WaterTopChunkInstance;
    sampleValue: (input: {
        instance: WaterTopChunkInstance;
        x: number;
        z: number;
    }) => number;
}): WaterBlockDepthSamples {
    const [x, , z] = instance.position;

    return [
        smoothValueAtWorldPosition({
            instancesByPosition,
            instance,
            sampleValue,
            x: x + waterDepthSamplePositions[0][0],
            z: z + waterDepthSamplePositions[0][1],
        }),
        smoothValueAtWorldPosition({
            instancesByPosition,
            instance,
            sampleValue,
            x: x + waterDepthSamplePositions[1][0],
            z: z + waterDepthSamplePositions[1][1],
        }),
        smoothValueAtWorldPosition({
            instancesByPosition,
            instance,
            sampleValue,
            x: x + waterDepthSamplePositions[2][0],
            z: z + waterDepthSamplePositions[2][1],
        }),
        smoothValueAtWorldPosition({
            instancesByPosition,
            instance,
            sampleValue,
            x: x + waterDepthSamplePositions[3][0],
            z: z + waterDepthSamplePositions[3][1],
        }),
    ];
}

export function smoothWaterTopDepthSamples(instances: WaterTopChunkInstance[]) {
    const instancesByPosition = groupInstancesByPosition(instances);

    return instances.map((instance) => ({
        ...instance,
        depthSamples: smoothSamplesForInstance({
            instancesByPosition,
            instance,
            sampleValue: sampleDepthAtWorldPosition,
        }),
    }));
}
