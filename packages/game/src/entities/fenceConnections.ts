export type FenceConnectionShape =
    | 'Solo'
    | 'Single'
    | 'Middle'
    | 'Corner'
    | 'T'
    | 'Cross';

export const fenceConnectionShapes = [
    'Solo',
    'Single',
    'Middle',
    'Corner',
    'T',
    'Cross',
] satisfies readonly FenceConnectionShape[];

type CardinalNeighbors = {
    e: boolean;
    n: boolean;
    s: boolean;
    total: number;
    w: boolean;
};

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
