export type ActiveDragPreviewStackPosition = {
    x: number;
    z: number;
};

export type ActiveDragPreviewTarget = {
    blockId: string;
    blockIndex: number;
    stackPosition: ActiveDragPreviewStackPosition;
};

export type ActiveDragPreviewTargetOffset = ActiveDragPreviewTarget & {
    hoverHeight: number;
};

export type ActiveDragPreviewTransform = {
    relative: {
        x: number;
        z: number;
    };
    targets: ActiveDragPreviewTargetOffset[] | null | undefined;
};

export const activeDragPreviewLift = 0.1;

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

export function findActiveDragPreviewTargetOffset(
    targets: ActiveDragPreviewTargetOffset[] | null | undefined,
    candidate: ActiveDragPreviewTarget,
) {
    return targets?.find((target) =>
        activeDragPreviewTargetMatches(target, candidate),
    );
}

export function getActiveDragPreviewTargetPositionOffset(
    target: ActiveDragPreviewTarget,
    activeDragPreview: ActiveDragPreviewTransform | null | undefined,
    lift = activeDragPreviewLift,
) {
    if (!activeDragPreview) {
        return null;
    }

    const targetOffset = findActiveDragPreviewTargetOffset(
        activeDragPreview.targets,
        target,
    );
    if (!targetOffset) {
        return null;
    }

    return {
        x: activeDragPreview.relative.x,
        y: targetOffset.hoverHeight + lift,
        z: activeDragPreview.relative.z,
    };
}
