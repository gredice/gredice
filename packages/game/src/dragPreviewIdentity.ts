export type ActiveDragPreviewStackPosition = {
    x: number;
    z: number;
};

export type ActiveDragPreviewTarget = {
    blockId: string;
    blockIndex: number;
    stackPosition: ActiveDragPreviewStackPosition;
};

export function createActiveDragPreviewTarget({
    blockId,
    blockIndex,
    stackPosition,
}: {
    blockId: string;
    blockIndex: number;
    stackPosition: ActiveDragPreviewStackPosition;
}): ActiveDragPreviewTarget {
    return {
        blockId,
        blockIndex,
        stackPosition: {
            x: stackPosition.x,
            z: stackPosition.z,
        },
    };
}

export function activeDragPreviewTargetMatches(
    target: ActiveDragPreviewTarget | null | undefined,
    candidate: ActiveDragPreviewTarget,
) {
    if (!target) {
        return false;
    }

    return (
        target.blockId === candidate.blockId &&
        target.blockIndex === candidate.blockIndex &&
        target.stackPosition.x === candidate.stackPosition.x &&
        target.stackPosition.z === candidate.stackPosition.z
    );
}
