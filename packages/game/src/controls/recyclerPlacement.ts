import type { BlockData } from '@gredice/client';

type GridPosition = {
    x: number;
    z: number;
};

export function isRecyclerPlacementTarget({
    canRecycle,
    sourcePosition,
    destination,
    blockUnderData,
}: {
    canRecycle: boolean;
    sourcePosition: GridPosition;
    destination: GridPosition;
    blockUnderData: Pick<BlockData, 'functions'> | null | undefined;
}) {
    if (!canRecycle) {
        return false;
    }

    if (
        sourcePosition.x === destination.x &&
        sourcePosition.z === destination.z
    ) {
        return false;
    }

    return blockUnderData?.functions?.recycler ?? false;
}
