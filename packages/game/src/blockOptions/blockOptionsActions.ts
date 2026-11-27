import type { BlockData } from '@gredice/client';
import { getGardenBlockExpansionEligibility } from '@gredice/js/gardenBlockExpansion';
import { canRotatePlacedBlock } from '../controls/blockRotation';
import { isInternalSceneBlockData } from '../internalSceneBlockData';
import { findBlockEditingTarget, isUnsavedBlockId } from './blockEditingTarget';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';
import {
    type BlockRemovalGarden,
    getBlockRemovalBlocker,
} from './blockRemoval';

export type BlockOptionsActionId = 'expand' | 'rotate' | 'remove' | 'move';

export type BlockOptionsAction = {
    id: BlockOptionsActionId;
    label: string;
    /** Why the action cannot run now; null when it can. */
    disabledReason: string | null;
};

/** The order of the pop-up's tiles. */
export const blockOptionsActionIds: readonly BlockOptionsActionId[] = [
    'expand',
    'rotate',
    'remove',
    'move',
];

function findExactBlockData(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    return blockData?.find(
        (candidate) => candidate.information.name === blockName,
    );
}

/** The directory's display label of a block, or its name as a fallback. */
export function getBlockOptionsBlockLabel(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    return (
        findExactBlockData(blockData, blockName)?.information.label || blockName
    );
}

function getExpandBlocker(
    blockData: BlockData[] | null | undefined,
    block: { name: string; rotation: number },
) {
    const data = findExactBlockData(blockData, block.name);
    if (data && isInternalSceneBlockData(data)) {
        return blockOptionsToolbarCopy.disabledReasons.notExpandable;
    }

    // Price, night-only and balance do not disable Proširi: the Expand bar
    // explains them.
    return getGardenBlockExpansionEligibility({
        blockName: block.name,
        blockData: data,
        rotation: block.rotation,
    }).eligible
        ? null
        : blockOptionsToolbarCopy.disabledReasons.notExpandable;
}

/**
 * The four pop-up actions for a placed block, each with the reason it is
 * unavailable (spec §3.4). Unsaved blocks and a pending Expand batch disable
 * every action first. Null when the block is not in the garden.
 */
export function getBlockOptionsActions({
    batchPending,
    blockData,
    blockId,
    garden,
    isLocalSandbox,
    rotatePending,
}: {
    batchPending: boolean;
    blockData: BlockData[] | null | undefined;
    blockId: string;
    garden: BlockRemovalGarden | null | undefined;
    isLocalSandbox: boolean;
    rotatePending: boolean;
}): BlockOptionsAction[] | null {
    const target = findBlockEditingTarget(garden, blockId);
    if (!garden || !target) {
        return null;
    }

    const { actions, disabledReasons } = blockOptionsToolbarCopy;
    const globalBlocker = isUnsavedBlockId(blockId)
        ? disabledReasons.unsaved
        : batchPending
          ? disabledReasons.expandPending
          : null;
    const rotateBlocker = !canRotatePlacedBlock(target.block.name)
        ? disabledReasons.notRotatable
        : rotatePending
          ? disabledReasons.rotatePending
          : null;
    const blockers: Record<BlockOptionsActionId, string | null> = {
        expand: getExpandBlocker(blockData, target.block),
        rotate: rotateBlocker,
        remove: getBlockRemovalBlocker({ blockId, garden, isLocalSandbox }),
        move: null,
    };
    const labels: Record<BlockOptionsActionId, string> = {
        expand: actions.expand,
        rotate: actions.rotate,
        remove: garden.isSandbox ? actions.delete : actions.recycle,
        move: actions.move,
    };

    return blockOptionsActionIds.map((id) => ({
        id,
        label: labels[id],
        disabledReason: globalBlocker ?? blockers[id],
    }));
}
