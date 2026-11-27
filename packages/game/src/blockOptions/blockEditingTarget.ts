import type { BlockData } from '@gredice/client';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import {
    type ActiveDragPreviewTarget,
    createActiveDragPreviewTarget,
} from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';
import {
    getBlockDataByName,
    getStackBlockHeight,
    getStackHeight,
} from '../utils/stackHeightCore';
import type { BlockEditingMode } from './blockEditingState';

/** Height of the pop-up anchor above the block's top surface. */
export const blockEditingAnchorOffsetY = 0.35;

const unsavedBlockIdPrefix = 'optimistic-';

/**
 * Whether a block has not been saved yet: optimistic placements
 * (`optimistic-block:…`, `optimistic-garden-box-block:…`) until the server
 * returns their id. Local sandbox ids (`local-block:…`) are saved.
 */
export function isUnsavedBlockId(blockId: string) {
    return blockId.startsWith(unsavedBlockIdPrefix);
}

export type BlockEditingTarget = {
    block: Block;
    blockIndex: number;
    stack: GardenStack;
    /** The same block in the shape pickup selection and drag previews use. */
    target: ActiveDragPreviewTarget;
};

/** Finds a placed block by id in the current garden. */
export function findBlockEditingTarget(
    garden: { stacks: GardenStack[] } | null | undefined,
    blockId: string | null | undefined,
): BlockEditingTarget | null {
    if (!garden || !blockId) {
        return null;
    }

    for (const stack of garden.stacks) {
        const blockIndex = stack.blocks.findIndex(
            (block) => block.id === blockId,
        );
        const block = stack.blocks[blockIndex];
        if (block) {
            return {
                block,
                blockIndex,
                stack,
                target: createActiveDragPreviewTarget({
                    blockId,
                    blockIndex,
                    stackPosition: {
                        x: stack.position.x,
                        z: stack.position.z,
                    },
                }),
            };
        }
    }

    return null;
}

/**
 * Whether block editing must close because its block left the garden. It
 * applies to the modes that show UI for the block (pop-up, Expand, remove
 * dialog), but not while the garden is loading (its blocks are unknown, not
 * gone) and not while a confirmed removal is pending: that removal's
 * optimistic update took the block out of the cache, and the dialog closes
 * on settle or shows the error once the cache is restored.
 */
export function isBlockEditingBlockGone({
    blockId,
    garden,
    mode,
    removePending,
}: {
    blockId: string | null;
    garden: { stacks: GardenStack[] } | null | undefined;
    mode: BlockEditingMode | null;
    removePending: boolean;
}) {
    if (
        (mode !== 'menu' && mode !== 'expand' && mode !== 'confirm-remove') ||
        (mode === 'confirm-remove' && removePending) ||
        garden === undefined
    ) {
        return false;
    }

    return findBlockEditingTarget(garden, blockId) === null;
}

/**
 * World position above a block for the pop-up and other overlays: the centre
 * of its rotated footprint, `blockEditingAnchorOffsetY` above its top.
 */
export function getBlockEditingAnchor(
    blockData: BlockData[] | null | undefined,
    target: Pick<BlockEditingTarget, 'block' | 'blockIndex' | 'stack'>,
): [x: number, y: number, z: number] {
    const { block, blockIndex, stack } = target;
    const offsets = getGardenBlockFootprintOffsets(
        blockData ? getBlockDataByName(blockData, block.name) : undefined,
        block.rotation,
    );
    let offsetX = 0;
    let offsetZ = 0;
    for (const offset of offsets) {
        offsetX += offset.x / offsets.length;
        offsetZ += offset.y / offsets.length;
    }

    const baseHeight = getStackHeight(blockData, stack, block);
    const blockHeight = blockData
        ? getStackBlockHeight(blockData, stack, block, blockIndex)
        : 0;

    return [
        stack.position.x + offsetX,
        baseHeight + blockHeight + blockEditingAnchorOffsetY,
        stack.position.z + offsetZ,
    ];
}
