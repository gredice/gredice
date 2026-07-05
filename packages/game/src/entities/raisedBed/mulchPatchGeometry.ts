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
    ne: boolean;
    nw: boolean;
    s: boolean;
    se: boolean;
    sw: boolean;
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

type MulchPatchBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export const mulchPatchConnectionMasks = Array.from(
    { length: 256 },
    (_, mask) => mask,
);

export const isolatedMulchPatchConnectionMask = 0;
export const fullMulchPatchConnectionMask = getMulchPatchConnectionMask({
    e: true,
    n: true,
    ne: true,
    nw: true,
    s: true,
    se: true,
    sw: true,
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
    connections: Pick<MulchPatchConnections, 'e' | 'n' | 's' | 'w'> &
        Partial<Pick<MulchPatchConnections, 'ne' | 'nw' | 'se' | 'sw'>>,
) {
    return (
        (connections.n ? 1 : 0) |
        (connections.e ? 2 : 0) |
        (connections.s ? 4 : 0) |
        (connections.w ? 8 : 0) |
        (connections.ne ? 16 : 0) |
        (connections.nw ? 32 : 0) |
        (connections.se ? 64 : 0) |
        (connections.sw ? 128 : 0)
    );
}

export function getMulchPatchConnectionsFromMask(
    mask: number,
): MulchPatchConnections {
    return {
        e: (mask & 2) !== 0,
        n: (mask & 1) !== 0,
        ne: (mask & 16) !== 0,
        nw: (mask & 32) !== 0,
        s: (mask & 4) !== 0,
        se: (mask & 64) !== 0,
        sw: (mask & 128) !== 0,
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
        ne: false,
        nw: false,
        s: false,
        se: false,
        sw: false,
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

        if (nearlyEqual(candidateX - x, xDistance)) {
            if (nearlyEqual(z - candidateZ, zDistance)) {
                connections.ne = true;
            } else if (nearlyEqual(candidateZ - z, zDistance)) {
                connections.nw = true;
            }
        } else if (nearlyEqual(x - candidateX, xDistance)) {
            if (nearlyEqual(z - candidateZ, zDistance)) {
                connections.se = true;
            } else if (nearlyEqual(candidateZ - z, zDistance)) {
                connections.sw = true;
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
    const outerCornerRadius = Math.min(
        0.15,
        (maxX - minX) / 3,
        (maxZ - minZ) / 3,
    );
    const innerCornerRadius = connectedHalfSize - isolatedHalfSize;

    function getCornerRadius({
        diagonal,
        xConnection,
        zConnection,
    }: {
        diagonal: boolean;
        xConnection: boolean;
        zConnection: boolean;
    }) {
        if (!xConnection && !zConnection) {
            return outerCornerRadius;
        }

        if (xConnection && zConnection && !diagonal) {
            return innerCornerRadius;
        }

        return 0;
    }

    const southEastCorner = getCornerRadius({
        diagonal: connections.se,
        xConnection: connections.s,
        zConnection: connections.e,
    });
    const northEastCorner = getCornerRadius({
        diagonal: connections.ne,
        xConnection: connections.n,
        zConnection: connections.e,
    });
    const northWestCorner = getCornerRadius({
        diagonal: connections.nw,
        xConnection: connections.n,
        zConnection: connections.w,
    });
    const southWestCorner = getCornerRadius({
        diagonal: connections.sw,
        xConnection: connections.s,
        zConnection: connections.w,
    });
    const perimeter: MulchPatchPoint[] = [];

    function addPoint(point: MulchPatchPoint) {
        const previous = perimeter[perimeter.length - 1];
        if (
            previous &&
            nearlyEqual(point.x, previous.x) &&
            nearlyEqual(point.z, previous.z)
        ) {
            return;
        }

        perimeter.push(point);
    }

    function addCornerArc({
        center,
        endAngle,
        radius,
        startAngle,
    }: {
        center: MulchPatchPoint;
        endAngle: number;
        radius: number;
        startAngle: number;
    }) {
        const segmentCount = 5;

        if (radius <= 0) {
            return;
        }

        for (let index = 1; index <= segmentCount; index += 1) {
            const progress = index / segmentCount;
            const angle = startAngle + (endAngle - startAngle) * progress;
            addPoint({
                x: center.x + Math.cos(angle) * radius,
                z: center.z + Math.sin(angle) * radius,
            });
        }
    }

    addPoint({ x: minX + southEastCorner, z: minZ });
    addPoint({ x: maxX - northEastCorner, z: minZ });
    addCornerArc({
        center: { x: maxX - northEastCorner, z: minZ + northEastCorner },
        endAngle: 0,
        radius: northEastCorner,
        startAngle: -Math.PI / 2,
    });
    addPoint({ x: maxX, z: maxZ - northWestCorner });
    addCornerArc({
        center: { x: maxX - northWestCorner, z: maxZ - northWestCorner },
        endAngle: Math.PI / 2,
        radius: northWestCorner,
        startAngle: 0,
    });
    addPoint({ x: minX + southWestCorner, z: maxZ });
    addCornerArc({
        center: { x: minX + southWestCorner, z: maxZ - southWestCorner },
        endAngle: Math.PI,
        radius: southWestCorner,
        startAngle: Math.PI / 2,
    });
    addPoint({ x: minX, z: minZ + southEastCorner });
    addCornerArc({
        center: { x: minX + southEastCorner, z: minZ + southEastCorner },
        endAngle: (Math.PI * 3) / 2,
        radius: southEastCorner,
        startAngle: Math.PI,
    });

    const last = perimeter[perimeter.length - 1];
    const first = perimeter[0];
    if (
        first &&
        last &&
        nearlyEqual(first.x, last.x) &&
        nearlyEqual(first.z, last.z)
    ) {
        perimeter.pop();
    }

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
    bounds: MulchPatchBounds;
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
    const edgeShades: number[] = [];
    const boundsAttributes: number[] = [];
    const exposedEdgeAttributes: number[] = [];
    const { bounds, perimeter } = getMulchPatchPerimeter(connections);
    const exposedEdges = [
        connections.n ? 0 : 1,
        connections.e ? 0 : 1,
        connections.s ? 0 : 1,
        connections.w ? 0 : 1,
    ];

    function addVertex(point: MulchPatchPoint, y: number, edgeShade: number) {
        positions.push(point.x, y, point.z);
        edgeShades.push(edgeShade);
        boundsAttributes.push(
            bounds.minX,
            bounds.maxX,
            bounds.minZ,
            bounds.maxZ,
        );
        exposedEdgeAttributes.push(...exposedEdges);
    }

    function addTriangle(
        first: MulchPatchPoint,
        firstY: number,
        firstEdgeShade: number,
        second: MulchPatchPoint,
        secondY: number,
        secondEdgeShade: number,
        third: MulchPatchPoint,
        thirdY: number,
        thirdEdgeShade: number,
    ) {
        addVertex(first, firstY, firstEdgeShade);
        addVertex(second, secondY, secondEdgeShade);
        addVertex(third, thirdY, thirdEdgeShade);
    }

    const center = { x: 0, z: 0 };
    for (const [index, current] of perimeter.entries()) {
        const next = perimeter[(index + 1) % perimeter.length];
        if (!next) {
            continue;
        }

        addTriangle(
            center,
            topCenterY,
            0,
            next,
            topEdgeY,
            0,
            current,
            topEdgeY,
            0,
        );

        if (
            shouldRenderMulchPatchSide({
                bounds,
                connections,
                current,
                next,
            })
        ) {
            addTriangle(
                current,
                topEdgeY,
                1,
                next,
                topEdgeY,
                1,
                next,
                bottomY,
                1,
            );
            addTriangle(
                current,
                topEdgeY,
                1,
                next,
                bottomY,
                1,
                current,
                bottomY,
                1,
            );
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute(
        'mulchEdge',
        new Float32BufferAttribute(edgeShades, 1),
    );
    geometry.setAttribute(
        'mulchBounds',
        new Float32BufferAttribute(boundsAttributes, 4),
    );
    geometry.setAttribute(
        'mulchExposedEdges',
        new Float32BufferAttribute(exposedEdgeAttributes, 4),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}
