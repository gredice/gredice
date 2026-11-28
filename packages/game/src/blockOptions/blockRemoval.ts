import type { BlockData } from '@gredice/client';
import { resolvePickupHudDropAction } from '../controls/pickupRemovalDropAction';
import { createPickupSelectionMovingSegments } from '../controls/pickupSelection';
import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import { findBlockEditingTarget } from './blockEditingTarget';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';

/** The part of the garden cache removal reads. */
export type BlockRemovalGarden = {
    isSandbox: boolean;
    stacks: GardenStack[];
    raisedBeds: {
        id: number;
        blockId: string | null;
        status: string;
    }[];
};

/**
 * What the remove confirmation can say about sunflowers coming back:
 * - `amount`: the exact total the server refunds (the price paid per block);
 * - `none`: every removed block was free, so nothing comes back;
 * - `unknown`: at least one block has no paid price on the client (legacy
 *   and pack blocks), so no number can be promised.
 */
export type BlockRemovalRefund =
    | { kind: 'amount'; amount: number }
    | { kind: 'none' }
    | { kind: 'unknown' };

export type BlockRemovalPlan = {
    /**
     * `recycle`: one block with nothing on it, removed with a stack patch
     * (`useBlockRecycle`, which also empties a new raised bed's cart items).
     * `delete`: the block and everything stacked on it, one DELETE each
     * (`useBlockDelete`); sandbox gardens always delete.
     */
    action: 'recycle' | 'delete';
    blockId: string;
    blockName: string;
    blockIndex: number;
    position: { x: number; z: number };
    /** The raised bed the block is, for the recycle request. */
    raisedBedId: number | null;
    /** Every block the confirmation removes, bottom first. */
    blockIds: string[];
    /** Blocks standing on the removed one, removed with it. */
    stackedCount: number;
    /** Cart items of the raised bed that recycling also removes. */
    cartItemCount: number;
    /** Null in sandbox gardens, which have no sunflowers. */
    refund: BlockRemovalRefund | null;
};

/** The blocks from `blockId` to the top of its stack. */
function getRemovalSegment(
    garden: Pick<BlockRemovalGarden, 'stacks'> | null | undefined,
    blockId: string,
) {
    const target = findBlockEditingTarget(garden, blockId);
    return target
        ? {
              target,
              blocks: target.stack.blocks.slice(target.blockIndex),
          }
        : null;
}

/**
 * Why removing `blockId` (with everything stacked on it) is not possible,
 * or null when it is. Mirrors what the server refuses: garden boxes (they
 * may hold stored blocks) and raised beds past the `new` status. The local
 * sandbox never asks the server, so only the raised-bed rule applies there.
 */
export function getBlockRemovalBlocker({
    blockId,
    garden,
    isLocalSandbox,
}: {
    blockId: string;
    garden: BlockRemovalGarden | null | undefined;
    isLocalSandbox: boolean;
}): string | null {
    const segment = getRemovalSegment(garden, blockId);
    if (!garden || !segment) {
        return blockOptionsToolbarCopy.disabledReasons.notRemovable;
    }

    for (const block of segment.blocks) {
        if (!isLocalSandbox && block.name === 'GardenBox') {
            return blockOptionsToolbarCopy.disabledReasons.notRemovable;
        }

        const raisedBed = findRaisedBedByBlockId(garden, block.id);
        if (raisedBed && raisedBed.status !== 'new') {
            return blockOptionsToolbarCopy.disabledReasons.activeRaisedBed;
        }
    }

    return null;
}

function isKnownPaidPrice(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

/**
 * The refund the server gives for `blocks`: the price paid per block,
 * summed. Any block without a paid price makes the total unknown.
 */
export function resolveBlockRemovalRefund(
    blocks: readonly Pick<Block, 'paidSunflowers'>[],
): BlockRemovalRefund {
    let amount = 0;
    for (const block of blocks) {
        if (!isKnownPaidPrice(block.paidSunflowers)) {
            return { kind: 'unknown' };
        }
        amount += block.paidSunflowers;
    }

    return amount > 0 ? { kind: 'amount', amount } : { kind: 'none' };
}

/**
 * What the remove confirmation does for `blockId`, with the same rules as
 * dropping a lifted block on the HUD recycler (`finishPickup`): a block with
 * nothing on it is recycled with a stack patch unless it is an active raised
 * bed; otherwise it is deleted together with everything stacked on it.
 * Sandbox gardens always delete. Null when the block is gone.
 */
export function planBlockRemoval({
    blockData,
    blockId,
    cartItems,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    blockId: string;
    cartItems: readonly { raisedBedId?: number | null }[] | null | undefined;
    garden: BlockRemovalGarden | null | undefined;
}): BlockRemovalPlan | null {
    const segment = getRemovalSegment(garden, blockId);
    if (!garden || !segment) {
        return null;
    }

    const { target } = segment;
    const raisedBed = findRaisedBedByBlockId(garden, blockId);
    const canRecyclePrimarySegment =
        (raisedBed?.status ?? 'new') === 'new' && segment.blocks.length === 1;
    const movingSegments = createPickupSelectionMovingSegments({
        blockData,
        canRecyclePrimarySegment,
        primaryTarget: target.target,
        selectedTargets: [target.target],
        stacks: garden.stacks,
    });
    const action = resolvePickupHudDropAction({
        forceDelete: garden.isSandbox,
        movingSegments,
    });
    if (!action) {
        return null;
    }

    const blockIds =
        action.type === 'delete' ? action.blockIds : [target.block.id];
    const removedBlocks = segment.blocks.filter((block) =>
        blockIds.includes(block.id),
    );
    const cartItemCount =
        action.type === 'recycle' && raisedBed
            ? (cartItems ?? []).filter(
                  (item) => item.raisedBedId === raisedBed.id,
              ).length
            : 0;

    return {
        action: action.type,
        blockId: target.block.id,
        blockName: target.block.name,
        blockIndex: target.blockIndex,
        position: {
            x: target.stack.position.x,
            z: target.stack.position.z,
        },
        raisedBedId: raisedBed?.id ?? null,
        blockIds,
        stackedCount: Math.max(0, blockIds.length - 1),
        cartItemCount,
        refund: garden.isSandbox
            ? null
            : resolveBlockRemovalRefund(removedBlocks),
    };
}
