import { BufferGeometry, Float32BufferAttribute } from 'three';

export type MulchBlockName = 'MulchCoconut' | 'MulchHey' | 'MulchWood';

export const mulchBlockNames: MulchBlockName[] = [
    'MulchHey',
    'MulchCoconut',
    'MulchWood',
];

const mulchBlockNameLookup: Record<MulchBlockName, true> = {
    MulchCoconut: true,
    MulchHey: true,
    MulchWood: true,
};

export type MulchPatchConnections = {
    e: boolean;
    n: boolean;
    s: boolean;
    w: boolean;
};

export type MulchPatchTarget = {
    position: readonly [number, number, number];
    size: readonly [number, number];
};

type MulchPatchPoint = {
    x: number;
    z: number;
};

export const mulchPatchConnectionMasks = Array.from(
    { length: 16 },
    (_, mask) => mask,
);

export const isolatedMulchPatchConnectionMask = 0;
export const fullMulchPatchConnectionMask = getMulchPatchConnectionMask({
    e: true,
    n: true,
    s: true,
    w: true,
});

function nearlyEqual(left: number, right: number, tolerance = 0.0001) {
    return Math.abs(left - right) <= tolerance;
}

function getMulchPatchTargetDistance(leftSize: number, rightSize: number) {
    return (leftSize + rightSize) / 2;
}

export function isMulchBlockName(name: string): name is MulchBlockName {
    return name in mulchBlockNameLookup;
}

export function getMulchPatchConnectionMask(
    connections: MulchPatchConnections,
) {
    return (
        (connections.n ? 1 : 0) |
        (connections.e ? 2 : 0) |
        (connections.s ? 4 : 0) |
        (connections.w ? 8 : 0)
    );
}

export function getMulchPatchConnectionsFromMask(
    mask: number,
): MulchPatchConnections {
    return {
        e: (mask & 2) !== 0,
        n: (mask & 1) !== 0,
        s: (mask & 4) !== 0,
        w: (mask & 8) !== 0,
    };
}

export function resolveMulchPatchConnectionMask(
    target: MulchPatchTarget,
    targets: readonly MulchPatchTarget[],
) {
    const [x, y, z] = target.position;
    const [width, depth] = target.size;
    const connections: MulchPatchConnections = {
        e: false,
        n: false,
        s: false,
        w: false,
    };

    for (const candidate of targets) {
        if (candidate === target) {
            continue;
        }

        const [candidateX, candidateY, candidateZ] = candidate.position;
        if (!nearlyEqual(candidateY, y)) {
            continue;
        }

        const xDistance = getMulchPatchTargetDistance(width, candidate.size[0]);
        const zDistance = getMulchPatchTargetDistance(depth, candidate.size[1]);

        if (nearlyEqual(candidateZ, z)) {
            if (nearlyEqual(candidateX - x, xDistance)) {
                connections.n = true;
            } else if (nearlyEqual(x - candidateX, xDistance)) {
                connections.s = true;
            }
        }

        if (nearlyEqual(candidateX, x)) {
            if (nearlyEqual(z - candidateZ, zDistance)) {
                connections.e = true;
            } else if (nearlyEqual(candidateZ - z, zDistance)) {
                connections.w = true;
            }
        }
    }

    return getMulchPatchConnectionMask(connections);
}

function getMulchPatchPerimeter(connections: MulchPatchConnections) {
    const isolatedHalfSize = 0.39;
    const connectedHalfSize = 0.5;
    const minX = connections.s ? -connectedHalfSize : -isolatedHalfSize;
    const maxX = connections.n ? connectedHalfSize : isolatedHalfSize;
    const minZ = connections.e ? -connectedHalfSize : -isolatedHalfSize;
    const maxZ = connections.w ? connectedHalfSize : isolatedHalfSize;
    const cornerInset = Math.min(0.08, (maxX - minX) / 3, (maxZ - minZ) / 3);
    const southEastCorner = !connections.s && !connections.e ? cornerInset : 0;
    const northEastCorner = !connections.n && !connections.e ? cornerInset : 0;
    const northWestCorner = !connections.n && !connections.w ? cornerInset : 0;
    const southWestCorner = !connections.s && !connections.w ? cornerInset : 0;
    const points: MulchPatchPoint[] = [
        { x: minX + southEastCorner, z: minZ },
        { x: maxX - northEastCorner, z: minZ },
        { x: maxX, z: minZ + northEastCorner },
        { x: maxX, z: maxZ - northWestCorner },
        { x: maxX - northWestCorner, z: maxZ },
        { x: minX + southWestCorner, z: maxZ },
        { x: minX, z: maxZ - southWestCorner },
        { x: minX, z: minZ + southEastCorner },
    ];

    const perimeter = points.filter((point, index) => {
        const previous = points[index - 1];
        return (
            !previous ||
            !nearlyEqual(point.x, previous.x) ||
            !nearlyEqual(point.z, previous.z)
        );
    });

    return {
        bounds: {
            maxX,
            maxZ,
            minX,
            minZ,
        },
        perimeter,
    };
}

function shouldRenderMulchPatchSide(input: {
    bounds: ReturnType<typeof getMulchPatchPerimeter>['bounds'];
    connections: MulchPatchConnections;
    current: MulchPatchPoint;
    next: MulchPatchPoint;
}) {
    const { bounds, connections, current, next } = input;
    const onNorth =
        nearlyEqual(current.x, bounds.maxX) && nearlyEqual(next.x, bounds.maxX);
    const onSouth =
        nearlyEqual(current.x, bounds.minX) && nearlyEqual(next.x, bounds.minX);
    const onEast =
        nearlyEqual(current.z, bounds.minZ) && nearlyEqual(next.z, bounds.minZ);
    const onWest =
        nearlyEqual(current.z, bounds.maxZ) && nearlyEqual(next.z, bounds.maxZ);

    if (onNorth && connections.n) {
        return false;
    }
    if (onSouth && connections.s) {
        return false;
    }
    if (onEast && connections.e) {
        return false;
    }
    if (onWest && connections.w) {
        return false;
    }

    return true;
}

export function createMulchPatchGeometry({
    connections,
}: {
    connections: MulchPatchConnections;
}) {
    const topCenterY = 0.026;
    const topEdgeY = 0.018;
    const bottomY = 0;
    const positions: number[] = [];
    const { bounds, perimeter } = getMulchPatchPerimeter(connections);

    function addVertex(point: MulchPatchPoint, y: number) {
        positions.push(point.x, y, point.z);
    }

    function addTriangle(
        first: MulchPatchPoint,
        firstY: number,
        second: MulchPatchPoint,
        secondY: number,
        third: MulchPatchPoint,
        thirdY: number,
    ) {
        addVertex(first, firstY);
        addVertex(second, secondY);
        addVertex(third, thirdY);
    }

    const center = { x: 0, z: 0 };
    for (const [index, current] of perimeter.entries()) {
        const next = perimeter[(index + 1) % perimeter.length];
        if (!next) {
            continue;
        }

        addTriangle(center, topCenterY, next, topEdgeY, current, topEdgeY);

        if (
            shouldRenderMulchPatchSide({
                bounds,
                connections,
                current,
                next,
            })
        ) {
            addTriangle(current, topEdgeY, next, topEdgeY, next, bottomY);
            addTriangle(current, topEdgeY, next, bottomY, current, bottomY);
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}
