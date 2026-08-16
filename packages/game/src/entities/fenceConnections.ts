export type FenceConnectionShape =
    | 'Solo'
    | 'Single'
    | 'Middle'
    | 'Corner'
    | 'T'
    | 'Cross';

export const fenceBlockNames = [
    'Fence',
    'WhiteFence',
    'StoneFence',
    'PolishedStoneFence',
] as const;

export type FenceBlockName = (typeof fenceBlockNames)[number];

const fenceBlockNameSet: ReadonlySet<string> = new Set(fenceBlockNames);
const fenceSpanPriority = new Map(
    fenceBlockNames.map((name, index) => [name, index]),
);

export function isFenceBlockName(name: string): name is FenceBlockName {
    return fenceBlockNameSet.has(name);
}

export function doesFenceOwnSpan(sourceName: string, neighborName: string) {
    if (!isFenceBlockName(sourceName) || !isFenceBlockName(neighborName)) {
        return false;
    }
    if (sourceName === neighborName) {
        return true;
    }
    return (
        (fenceSpanPriority.get(sourceName) ?? Number.POSITIVE_INFINITY) <
        (fenceSpanPriority.get(neighborName) ?? Number.POSITIVE_INFINITY)
    );
}

export function doesFenceOwnMixedSpan(
    sourceName: string,
    neighborName: string,
) {
    return (
        sourceName !== neighborName &&
        doesFenceOwnSpan(sourceName, neighborName)
    );
}

export const fenceConnectionShapes = [
    'Solo',
    'Single',
    'Middle',
    'Corner',
    'T',
    'Cross',
] satisfies readonly FenceConnectionShape[];

export type CardinalNeighbors = {
    e: boolean;
    n: boolean;
    s: boolean;
    total: number;
    w: boolean;
};

export function getFenceExtensionRotations(neighbors: CardinalNeighbors) {
    const rotations: number[] = [];
    if (neighbors.e) rotations.push(0);
    if (neighbors.s) rotations.push(1);
    if (neighbors.w) rotations.push(2);
    if (neighbors.n) rotations.push(3);
    return rotations;
}

export function resolveFenceConnection(
    neighbors: CardinalNeighbors,
    fallbackRotation: number,
): { rotation: number; shape: FenceConnectionShape } {
    let shape: FenceConnectionShape = 'Solo';
    let rotation = fallbackRotation % 4;

    if (neighbors.total === 1) {
        shape = 'Single';
        rotation = neighbors.n ? 3 : neighbors.s ? 1 : neighbors.e ? 0 : 2;
    } else if (neighbors.total === 2) {
        if (neighbors.n && neighbors.s) {
            shape = 'Middle';
            rotation = 1;
        } else if (neighbors.e && neighbors.w) {
            shape = 'Middle';
            rotation = 0;
        } else {
            shape = 'Corner';
            if (neighbors.n && neighbors.e) {
                rotation = 0;
            } else if (neighbors.e && neighbors.s) {
                rotation = 1;
            } else if (neighbors.s && neighbors.w) {
                rotation = 2;
            } else if (neighbors.w && neighbors.n) {
                rotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        shape = 'T';
        if (neighbors.n && neighbors.e && neighbors.s) {
            rotation = 0;
        } else if (neighbors.e && neighbors.s && neighbors.w) {
            rotation = 1;
        } else if (neighbors.s && neighbors.w && neighbors.n) {
            rotation = 2;
        } else if (neighbors.w && neighbors.n && neighbors.e) {
            rotation = 3;
        }
    } else if (neighbors.total === 4) {
        shape = 'Cross';
    }

    return { rotation, shape };
}
