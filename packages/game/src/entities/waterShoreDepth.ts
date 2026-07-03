import type { Vector4 } from 'three';
import type { WaterBlockDepthSamples } from './waterBlockDepth';

export type WaterShoreDepthInstance = {
    foamEdges: Vector4;
    position: [number, number, number];
    waterHeight: number;
};

const waterRangeOverlapEpsilon = 1e-6;
const waterBlockHalfSize = 0.5;
const shoreDepthDirections = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
] as const;
const waterShoreDepthSamplePositions = [
    [-waterBlockHalfSize, -waterBlockHalfSize],
    [-waterBlockHalfSize, waterBlockHalfSize],
    [waterBlockHalfSize, waterBlockHalfSize],
    [waterBlockHalfSize, -waterBlockHalfSize],
] as const;
const emptyWaterShoreDepthSamples: WaterBlockDepthSamples = [0, 0, 0, 0];

type ShoreSegment = {
    endX: number;
    endZ: number;
    startX: number;
    startZ: number;
};

function stackPositionKey(x: number, z: number) {
    return `${x}|${z}`;
}

function waterRange(instance: WaterShoreDepthInstance) {
    const [, y] = instance.position;
    const halfHeight = instance.waterHeight / 2;

    return {
        min: y - halfHeight,
        max: y + halfHeight,
    };
}

function waterRangesOverlap(
    left: WaterShoreDepthInstance,
    right: WaterShoreDepthInstance,
) {
    const leftRange = waterRange(left);
    const rightRange = waterRange(right);

    return (
        Math.min(leftRange.max, rightRange.max) -
            Math.max(leftRange.min, rightRange.min) >
        waterRangeOverlapEpsilon
    );
}

function hasShoreEdge({ foamEdges }: WaterShoreDepthInstance) {
    return (
        foamEdges.x > 0.5 ||
        foamEdges.y > 0.5 ||
        foamEdges.z > 0.5 ||
        foamEdges.w > 0.5
    );
}

function groupInstancesByPosition(instances: WaterShoreDepthInstance[]) {
    const groups = new Map<string, WaterShoreDepthInstance[]>();

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

function getConnectedWaterNeighbors({
    instance,
    instancesByPosition,
}: {
    instance: WaterShoreDepthInstance;
    instancesByPosition: Map<string, WaterShoreDepthInstance[]>;
}) {
    const [x, , z] = instance.position;
    const neighbors: WaterShoreDepthInstance[] = [];

    for (const [xOffset, zOffset] of shoreDepthDirections) {
        const candidates =
            instancesByPosition.get(
                stackPositionKey(x + xOffset, z + zOffset),
            ) ?? [];

        for (const candidate of candidates) {
            if (waterRangesOverlap(instance, candidate)) {
                neighbors.push(candidate);
            }
        }
    }

    return neighbors;
}

function resolveConnectedWaterComponents(instances: WaterShoreDepthInstance[]) {
    const instancesByPosition = groupInstancesByPosition(instances);
    const visited = new Set<WaterShoreDepthInstance>();
    const components: WaterShoreDepthInstance[][] = [];

    for (const instance of instances) {
        if (visited.has(instance)) {
            continue;
        }

        const component: WaterShoreDepthInstance[] = [];
        const queue = [instance];
        visited.add(instance);

        for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
            const current = queue[queueIndex];
            if (!current) {
                continue;
            }

            component.push(current);

            for (const neighbor of getConnectedWaterNeighbors({
                instance: current,
                instancesByPosition,
            })) {
                if (visited.has(neighbor)) {
                    continue;
                }

                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        components.push(component);
    }

    return components;
}

function collectShoreSegments(instance: WaterShoreDepthInstance) {
    const [x, , z] = instance.position;
    const segments: ShoreSegment[] = [];

    if (instance.foamEdges.x > 0.5) {
        segments.push({
            startX: x - waterBlockHalfSize,
            startZ: z - waterBlockHalfSize,
            endX: x - waterBlockHalfSize,
            endZ: z + waterBlockHalfSize,
        });
    }

    if (instance.foamEdges.y > 0.5) {
        segments.push({
            startX: x + waterBlockHalfSize,
            startZ: z - waterBlockHalfSize,
            endX: x + waterBlockHalfSize,
            endZ: z + waterBlockHalfSize,
        });
    }

    if (instance.foamEdges.z > 0.5) {
        segments.push({
            startX: x - waterBlockHalfSize,
            startZ: z - waterBlockHalfSize,
            endX: x + waterBlockHalfSize,
            endZ: z - waterBlockHalfSize,
        });
    }

    if (instance.foamEdges.w > 0.5) {
        segments.push({
            startX: x - waterBlockHalfSize,
            startZ: z + waterBlockHalfSize,
            endX: x + waterBlockHalfSize,
            endZ: z + waterBlockHalfSize,
        });
    }

    return segments;
}

function distanceToShoreSegment({
    segment,
    x,
    z,
}: {
    segment: ShoreSegment;
    x: number;
    z: number;
}) {
    const dx = segment.endX - segment.startX;
    const dz = segment.endZ - segment.startZ;
    const lengthSquared = dx * dx + dz * dz;
    const segmentOffset =
        lengthSquared > 0
            ? Math.min(
                  Math.max(
                      ((x - segment.startX) * dx + (z - segment.startZ) * dz) /
                          lengthSquared,
                      0,
                  ),
                  1,
              )
            : 0;
    const nearestX = segment.startX + dx * segmentOffset;
    const nearestZ = segment.startZ + dz * segmentOffset;

    return Math.hypot(x - nearestX, z - nearestZ);
}

function distanceToShoreSegments({
    segments,
    x,
    z,
}: {
    segments: ShoreSegment[];
    x: number;
    z: number;
}) {
    let distance = Number.POSITIVE_INFINITY;

    for (const segment of segments) {
        distance = Math.min(
            distance,
            distanceToShoreSegment({ segment, x, z }),
        );
    }

    return Number.isFinite(distance) ? distance : 0;
}

export function resolveWaterShoreDepths(instances: WaterShoreDepthInstance[]) {
    const instancesByPosition = groupInstancesByPosition(instances);
    const depths = new Map<WaterShoreDepthInstance, number>();
    const queue: WaterShoreDepthInstance[] = [];

    for (const instance of instances) {
        if (hasShoreEdge(instance)) {
            depths.set(instance, 0);
            queue.push(instance);
        }
    }

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const instance = queue[queueIndex];
        if (!instance) {
            continue;
        }

        const depth = depths.get(instance);
        if (depth === undefined) {
            continue;
        }

        for (const neighbor of getConnectedWaterNeighbors({
            instance,
            instancesByPosition,
        })) {
            const nextDepth = depth + 1;
            const currentDepth = depths.get(neighbor);

            if (currentDepth !== undefined && currentDepth <= nextDepth) {
                continue;
            }

            depths.set(neighbor, nextDepth);
            queue.push(neighbor);
        }
    }

    return instances.map((instance) => depths.get(instance) ?? 0);
}

export function resolveWaterShoreDepthSamples(
    instances: WaterShoreDepthInstance[],
): WaterBlockDepthSamples[] {
    const sampleMap = new Map<
        WaterShoreDepthInstance,
        WaterBlockDepthSamples
    >();

    for (const component of resolveConnectedWaterComponents(instances)) {
        const shoreSegments = component.flatMap(collectShoreSegments);

        for (const instance of component) {
            const [x, , z] = instance.position;
            const samples = waterShoreDepthSamplePositions.map(
                ([xOffset, zOffset]) =>
                    distanceToShoreSegments({
                        segments: shoreSegments,
                        x: x + xOffset,
                        z: z + zOffset,
                    }),
            ) as WaterBlockDepthSamples;

            sampleMap.set(instance, samples);
        }
    }

    return instances.map(
        (instance) => sampleMap.get(instance) ?? emptyWaterShoreDepthSamples,
    );
}
