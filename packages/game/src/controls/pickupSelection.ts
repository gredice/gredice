import type { BlockData } from '@gredice/client';
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
} from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';
import type { MovingSegment } from './PickupPlacementResolver';

export type AttachedPickupSegment = {
    sourceStack: Stack;
    sourceStartIndex: number;
    blocks: Block[];
    baseHeight: number;
};

type SelectedSegmentCandidate = {
    target: ActiveDragPreviewTarget;
    sourceStack: Stack;
    sourceStartIndex: number;
    block: Block;
};

function stackPositionMatches(stack: Stack, target: ActiveDragPreviewTarget) {
    return (
        stack.position.x === target.stackPosition.x &&
        stack.position.z === target.stackPosition.z
    );
}

function stackKey(stack: Stack) {
    return `${stack.position.x}|${stack.position.z}`;
}

function findSelectedSegmentCandidate(
    stacks: Stack[] | undefined,
    target: ActiveDragPreviewTarget,
): SelectedSegmentCandidate | null {
    const sourceStack = stacks?.find((stack) =>
        stackPositionMatches(stack, target),
    );
    if (!sourceStack) {
        return null;
    }

    const sourceStartIndex = sourceStack.blocks.findIndex(
        (candidate) => candidate.id === target.blockId,
    );
    const block = sourceStack.blocks[sourceStartIndex];
    if (sourceStartIndex < 0 || !block) {
        return null;
    }

    return {
        target,
        sourceStack,
        sourceStartIndex,
        block,
    };
}

function selectionTargetsInclude(
    targets: ActiveDragPreviewTarget[],
    target: ActiveDragPreviewTarget,
) {
    return targets.some((candidate) =>
        activeDragPreviewTargetMatches(candidate, target),
    );
}

function getSelectedSegmentCandidates({
    primaryTarget,
    selectedTargets,
    stacks,
}: {
    primaryTarget: ActiveDragPreviewTarget;
    selectedTargets: ActiveDragPreviewTarget[];
    stacks: Stack[] | undefined;
}) {
    const targets = selectionTargetsInclude(selectedTargets, primaryTarget)
        ? selectedTargets
        : [primaryTarget, ...selectedTargets];
    const candidateByStackKey = new Map<string, SelectedSegmentCandidate>();

    for (const target of targets) {
        const candidate = findSelectedSegmentCandidate(stacks, target);
        if (!candidate) {
            continue;
        }

        const key = stackKey(candidate.sourceStack);
        const existing = candidateByStackKey.get(key);
        if (
            !existing ||
            candidate.sourceStartIndex < existing.sourceStartIndex
        ) {
            candidateByStackKey.set(key, candidate);
        }
    }

    return Array.from(candidateByStackKey.values());
}

function attachedSegmentIsAlreadySelected(
    attachedSegment: AttachedPickupSegment,
    selectedCandidates: SelectedSegmentCandidate[],
) {
    return selectedCandidates.some(
        (candidate) =>
            candidate.sourceStack === attachedSegment.sourceStack &&
            candidate.sourceStartIndex <= attachedSegment.sourceStartIndex,
    );
}

export function createPickupSelectionMovingSegments({
    attachedSegment,
    blockData,
    canRecyclePrimarySegment,
    primaryTarget,
    selectedTargets,
    stacks,
}: {
    attachedSegment?: AttachedPickupSegment | null;
    blockData: BlockData[] | null | undefined;
    canRecyclePrimarySegment: boolean;
    primaryTarget: ActiveDragPreviewTarget;
    selectedTargets: ActiveDragPreviewTarget[];
    stacks: Stack[] | undefined;
}): MovingSegment[] {
    const selectedCandidates = getSelectedSegmentCandidates({
        primaryTarget,
        selectedTargets,
        stacks,
    });
    const hasExtraSelectedSegment = selectedCandidates.some(
        (candidate) =>
            !activeDragPreviewTargetMatches(candidate.target, primaryTarget),
    );
    const selectedSegments = selectedCandidates.map((candidate) => ({
        sourceStack: candidate.sourceStack,
        sourceStartIndex: candidate.sourceStartIndex,
        blocks: candidate.sourceStack.blocks.slice(candidate.sourceStartIndex),
        baseHeight: getStackHeight(
            blockData,
            candidate.sourceStack,
            candidate.block,
        ),
        canRecycle:
            canRecyclePrimarySegment &&
            !hasExtraSelectedSegment &&
            activeDragPreviewTargetMatches(candidate.target, primaryTarget),
    }));

    if (
        !attachedSegment ||
        attachedSegment.blocks.length === 0 ||
        attachedSegmentIsAlreadySelected(attachedSegment, selectedCandidates)
    ) {
        return selectedSegments;
    }

    return [
        ...selectedSegments,
        {
            ...attachedSegment,
            canRecycle: false,
        },
    ];
}
