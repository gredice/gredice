import type {
    BlockEditingMode,
    BlockEditingState,
} from '../blockOptions/blockEditingState';

/**
 * Where a pickup session started: a hold on the block (`hold`) or Pomakni in
 * the block options pop-up (`menu`).
 */
export type PickupSessionOrigin = 'hold' | 'menu';

/**
 * What letting go of a lifted block does:
 * - `drop`: the existing drop (move, garden box, recycle, or settle on the
 *   source cell when the snapped cell did not change);
 * - `options`: settle on the source cell and open the block options pop-up;
 * - `settle`: settle on the source cell, with no request and no pop-up;
 * - `carry`: keep the block lifted and wait for a tap on its destination.
 */
export type PickupReleaseIntent = 'drop' | 'options' | 'settle' | 'carry';

/**
 * Decides what a release does from what the pointer did, never from where
 * the snapped preview ended up: a few pixels of jitter plus the lift can
 * re-resolve to a neighbouring cell, which must not move the block (D1).
 */
export function resolvePickupReleaseIntent(input: {
    origin: PickupSessionOrigin;
    hasDraggedAfterPickup: boolean;
    hudDropRequested: boolean;
    /** `pickupSelectionTargets.length` (shift multi-select). */
    selectionCount: number;
    /** See `arePickupReleaseOptionsEnabled`. */
    optionsEnabled: boolean;
}): PickupReleaseIntent {
    if (input.hudDropRequested || input.hasDraggedAfterPickup) {
        return 'drop';
    }
    if (input.origin === 'menu') {
        return 'carry';
    }
    if (input.selectionCount > 1 || !input.optionsEnabled) {
        return 'settle';
    }

    return 'options';
}

/**
 * Whether a hold-release may open the pop-up: the pop-up can be shown (its
 * UI is mounted, which it is not while the HUD is hidden), the garden and
 * block data are loaded, and no Expand, move or carry is running (an open
 * pop-up for this or another block may be replaced).
 */
export function arePickupReleaseOptionsEnabled({
    editingMode,
    hasBlockData,
    hasGarden,
    hasOptionsUi,
}: {
    editingMode: BlockEditingMode | null | undefined;
    hasBlockData: boolean;
    hasGarden: boolean;
    /** `isBlockOptionsUiMounted()` from the store. */
    hasOptionsUi: boolean;
}) {
    return (
        hasOptionsUi &&
        hasGarden &&
        hasBlockData &&
        (editingMode === null ||
            editingMode === undefined ||
            editingMode === 'menu')
    );
}

/**
 * The block whose pop-up, remove dialog or Expand is open, so it keeps its
 * outline while the player decides (D19); null in the other modes, where
 * the pickup itself outlines the lifted block.
 */
export function getBlockEditingHighlightBlockId(
    editing: Pick<BlockEditingState, 'blockId' | 'mode'> | null | undefined,
) {
    return editing?.mode === 'menu' ||
        editing?.mode === 'confirm-remove' ||
        editing?.mode === 'expand'
        ? editing.blockId
        : null;
}
