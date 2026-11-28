import { clampGardenBlockExpansionCorner } from '@gredice/js/gardenBlockExpansion';
import type { GardenBlockQuarterTurns } from '@gredice/js/gardenBlocks';
import type { ActiveDragPreviewStackPosition } from '../dragPreviewIdentity';

/** A block rotation as quarter turns (0–3), as copies are placed. */
export type BlockQuarterTurns = GardenBlockQuarterTurns;

/**
 * Mutation key of the Expand batch. TanStack matches filter keys as
 * prefixes, so `useBlockPlace`'s `['gardens', 'current', 'blockPlace']`
 * "last mutation refreshes" check also counts batches, while
 * `useIsMutating({ mutationKey: blockPlaceBatchMutationKey })` counts only
 * batches.
 */
export const blockPlaceBatchMutationKey = [
    'gardens',
    'current',
    'blockPlace',
    'batch',
] as const;

/** A garden cell in world axes (`z` is the garden's depth axis). */
export type BlockEditingCell = ActiveDragPreviewStackPosition;

/**
 * What the player is doing with one placed block. The block is identified by
 * `blockId` only: the live block, stack and index are looked up in the garden
 * cache whenever they are needed (`findBlockEditingTarget`), because stored
 * indices go stale as soon as the stack changes.
 *
 * `sequence` grows with every change of mode, so a new pop-up, Expand or
 * carry can be told apart from an update of the current one.
 */
export type BlockEditingState =
    | {
          mode: 'menu';
          blockId: string;
          blockName: string;
          pointerType: string;
          /** `performance.now()` when the pop-up opened (ghost-click guard). */
          openedAt: number;
          sequence: number;
      }
    | {
          /** Pomakni was pressed; the pop-up stays mounted but hidden. */
          mode: 'moving';
          blockId: string;
          blockName: string;
          sequence: number;
      }
    | {
          /** The block is lifted and waits for a tap on its destination. */
          mode: 'carry';
          blockId: string;
          blockName: string;
          pointerType: string;
          sequence: number;
      }
    | {
          mode: 'confirm-remove';
          blockId: string;
          blockName: string;
          /**
           * The removal request is in flight. The optimistic update has
           * already taken the block out of the garden cache, so the dialog
           * must not close because the block disappeared: it closes on
           * settle, or stays open with the error when the hooks restore it.
           */
          pending: boolean;
          sequence: number;
      }
    | {
          mode: 'expand';
          blockId: string;
          blockName: string;
          /** The source's rotation; every copy uses it. */
          rotation: BlockQuarterTurns;
          /** The source cell, frozen when Expand starts. */
          source: BlockEditingCell;
          /** The surface the source stands on (ghosts and the drag plane). */
          sourceBaseHeight: number;
          /** Client corner clamp per side (OPEN-1). */
          maxSide: number;
          /** The dragged corner; starts at `source`. */
          corner: BlockEditingCell;
          /** A confirmed batch is in flight: the corner is locked. */
          pending: boolean;
          sequence: number;
      };

export type BlockEditingMode = BlockEditingState['mode'];
export type BlockExpandEditingState = Extract<
    BlockEditingState,
    { mode: 'expand' }
>;
export type BlockRemoveEditingState = Extract<
    BlockEditingState,
    { mode: 'confirm-remove' }
>;

export type BlockMovePointer = {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
};

/**
 * Starts a move of `blockId` for the pointer that pressed Pomakni (or for the
 * keyboard when `pointer` is null). A receiver must start its pickup session,
 * `window` listeners included, synchronously and return true, or return
 * false when the block is not its own or cannot move.
 */
export type BlockMoveReceiver = (input: {
    blockId: string;
    pointer: BlockMovePointer | null;
}) => boolean;

/** A HUD rectangle in client (viewport) coordinates. */
export type HudObstacleRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type BlockExpandStartInput = {
    rotation: BlockQuarterTurns;
    source: BlockEditingCell;
    sourceBaseHeight: number;
    maxSide: number;
};

export type BlockEditingSlice = {
    blockEditing: BlockEditingState | null;
    /** Opens the pop-up for a block, from no editing or another pop-up. */
    openBlockOptions: (input: {
        blockId: string;
        blockName: string;
        pointerType: string;
    }) => void;
    /** Pop-up → Expand, with the corner on the source cell. */
    startBlockExpand: (input: BlockExpandStartInput) => void;
    /** Clamps to `maxSide`; no-op when unchanged or pending. */
    setBlockExpandCorner: (corner: BlockEditingCell) => void;
    setBlockExpandPending: (pending: boolean) => void;
    /** Pop-up → remove confirmation. */
    requestBlockRemove: () => void;
    /**
     * Marks the confirmed removal as in flight (true) or settled (false).
     * While pending, the block leaving the garden cache does not close the
     * dialog; a garden change still does.
     */
    setBlockRemovePending: (pending: boolean) => void;
    /** Adds a move receiver; the returned function removes it. */
    registerBlockMoveReceiver: (receiver: BlockMoveReceiver) => () => void;
    /**
     * Marks the block options UI (`BlockOptionsScene`: the pop-up and its
     * auto-close) as mounted until the returned function runs. A game with
     * its HUD hidden does not mount it, so a hold-release there settles
     * instead of opening a pop-up nothing shows or closes.
     */
    registerBlockOptionsUi: () => () => void;
    /** Whether `registerBlockOptionsUi` has a live registration. */
    isBlockOptionsUiMounted: () => boolean;
    /**
     * Pop-up → moving, then asks each receiver, synchronously and outside
     * any store update, to start the move. When none claims it, editing
     * closes.
     */
    requestBlockMove: (
        pointer: BlockMovePointer | null,
    ) => 'claimed' | 'unclaimed';
    /** Moving → carry; null ends a move or carry. */
    setBlockEditingCarry: (input: { pointerType: string } | null) => void;
    closeBlockEditing: () => void;
    /** Follows a block whose id changed (optimistic id → saved id). */
    remapBlockEditingBlockIds: (
        pairs: Iterable<readonly [from: string, to: string]>,
    ) => void;
    /** Visible HUD rectangles the pop-up should avoid, in client coordinates. */
    blockOptionsHudObstacles: readonly HudObstacleRect[];
    setBlockOptionsHudObstacles: (rects: readonly HudObstacleRect[]) => void;
    /**
     * The open Expand's bar in client coordinates, so the corner knob can
     * be kept clear of it; null while no Expand bar is shown.
     */
    blockExpandBarRect: HudObstacleRect | null;
    setBlockExpandBarRect: (rect: HudObstacleRect | null) => void;
};

const emptyHudObstacles: readonly HudObstacleRect[] = Object.freeze([]);

function isPositiveFinite(value: number) {
    return Number.isFinite(value) && value > 0;
}

export function openBlockEditingMenu(
    current: BlockEditingState | null,
    input: { blockId: string; blockName: string; pointerType: string },
    entry: { openedAt: number; sequence: number },
): BlockEditingState | null {
    if (current && current.mode !== 'menu') {
        return current;
    }

    return {
        mode: 'menu',
        blockId: input.blockId,
        blockName: input.blockName,
        pointerType: input.pointerType,
        openedAt: entry.openedAt,
        sequence: entry.sequence,
    };
}

export function startBlockEditingExpand(
    current: BlockEditingState | null,
    input: BlockExpandStartInput,
    sequence: number,
): BlockEditingState | null {
    if (
        current?.mode !== 'menu' ||
        !Number.isFinite(input.source.x) ||
        !Number.isFinite(input.source.z) ||
        !Number.isFinite(input.sourceBaseHeight) ||
        !isPositiveFinite(input.maxSide)
    ) {
        return current;
    }

    return {
        mode: 'expand',
        blockId: current.blockId,
        blockName: current.blockName,
        rotation: input.rotation,
        source: { x: input.source.x, z: input.source.z },
        sourceBaseHeight: input.sourceBaseHeight,
        maxSide: Math.floor(input.maxSide),
        corner: { x: input.source.x, z: input.source.z },
        pending: false,
        sequence,
    };
}

export function setBlockEditingExpandCorner(
    current: BlockEditingState | null,
    corner: BlockEditingCell,
): BlockEditingState | null {
    if (current?.mode !== 'expand' || current.pending) {
        return current;
    }

    const clamped = clampGardenBlockExpansionCorner(
        { x: current.source.x, y: current.source.z },
        { x: corner.x, y: corner.z },
        current.maxSide,
    );
    if (clamped.x === current.corner.x && clamped.y === current.corner.z) {
        return current;
    }

    return { ...current, corner: { x: clamped.x, z: clamped.y } };
}

export function setBlockEditingExpandPending(
    current: BlockEditingState | null,
    pending: boolean,
): BlockEditingState | null {
    if (current?.mode !== 'expand' || current.pending === pending) {
        return current;
    }

    return { ...current, pending };
}

export function requestBlockEditingRemove(
    current: BlockEditingState | null,
    sequence: number,
): BlockEditingState | null {
    if (current?.mode !== 'menu') {
        return current;
    }

    return {
        mode: 'confirm-remove',
        blockId: current.blockId,
        blockName: current.blockName,
        pending: false,
        sequence,
    };
}

export function setBlockEditingRemovePending(
    current: BlockEditingState | null,
    pending: boolean,
): BlockEditingState | null {
    if (current?.mode !== 'confirm-remove' || current.pending === pending) {
        return current;
    }

    return { ...current, pending };
}

export function beginBlockEditingMove(
    current: BlockEditingState | null,
    sequence: number,
): BlockEditingState | null {
    if (current?.mode !== 'menu') {
        return current;
    }

    return {
        mode: 'moving',
        blockId: current.blockId,
        blockName: current.blockName,
        sequence,
    };
}

export function setBlockEditingCarryMode(
    current: BlockEditingState | null,
    input: { pointerType: string } | null,
    sequence: number,
): BlockEditingState | null {
    if (input === null) {
        return current?.mode === 'moving' || current?.mode === 'carry'
            ? null
            : current;
    }

    if (current?.mode === 'moving') {
        return {
            mode: 'carry',
            blockId: current.blockId,
            blockName: current.blockName,
            pointerType: input.pointerType,
            sequence,
        };
    }

    if (
        current?.mode === 'carry' &&
        current.pointerType !== input.pointerType
    ) {
        return { ...current, pointerType: input.pointerType };
    }

    return current;
}

export function remapBlockEditingBlockId(
    current: BlockEditingState | null,
    pairs: Iterable<readonly [from: string, to: string]>,
): BlockEditingState | null {
    if (!current) {
        return current;
    }

    for (const [from, to] of pairs) {
        if (from === current.blockId) {
            return from === to ? current : { ...current, blockId: to };
        }
    }

    return current;
}

export function hudObstacleRectsEqual(
    left: readonly HudObstacleRect[],
    right: readonly HudObstacleRect[],
) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }

    return left.every((rect, index) => {
        const other = right[index];
        return (
            other !== undefined &&
            rect.left === other.left &&
            rect.top === other.top &&
            rect.right === other.right &&
            rect.bottom === other.bottom
        );
    });
}

/**
 * The block-editing part of the game state. `useGameState` spreads it into
 * its store; it only needs the store's `set` and `get`. Move receivers live
 * in this closure, outside the reactive state.
 */
export function createBlockEditingSlice(
    set: (partial: Partial<BlockEditingSlice>) => void,
    get: () => BlockEditingSlice,
    options: { now?: () => number } = {},
): BlockEditingSlice {
    const now = options.now ?? (() => performance.now());
    const moveReceivers = new Set<{ receiver: BlockMoveReceiver }>();
    let optionsUiMounts = 0;
    let sequence = 0;

    function commit(next: BlockEditingState | null) {
        if (next === get().blockEditing) {
            return;
        }

        if (next) {
            sequence = Math.max(sequence, next.sequence);
        }
        set({ blockEditing: next });
    }

    return {
        blockEditing: null,
        openBlockOptions: (input) =>
            commit(
                openBlockEditingMenu(get().blockEditing, input, {
                    openedAt: now(),
                    sequence: sequence + 1,
                }),
            ),
        startBlockExpand: (input) =>
            commit(
                startBlockEditingExpand(
                    get().blockEditing,
                    input,
                    sequence + 1,
                ),
            ),
        setBlockExpandCorner: (corner) =>
            commit(setBlockEditingExpandCorner(get().blockEditing, corner)),
        setBlockExpandPending: (pending) =>
            commit(setBlockEditingExpandPending(get().blockEditing, pending)),
        requestBlockRemove: () =>
            commit(requestBlockEditingRemove(get().blockEditing, sequence + 1)),
        setBlockRemovePending: (pending) =>
            commit(setBlockEditingRemovePending(get().blockEditing, pending)),
        registerBlockMoveReceiver: (receiver) => {
            const entry = { receiver };
            moveReceivers.add(entry);
            return () => {
                moveReceivers.delete(entry);
            };
        },
        registerBlockOptionsUi: () => {
            optionsUiMounts += 1;
            let registered = true;
            return () => {
                if (registered) {
                    registered = false;
                    optionsUiMounts -= 1;
                }
            };
        },
        isBlockOptionsUiMounted: () => optionsUiMounts > 0,
        requestBlockMove: (pointer) => {
            const current = get().blockEditing;
            const moving = beginBlockEditingMove(current, sequence + 1);
            if (!moving || moving === current) {
                return 'unclaimed';
            }

            commit(moving);
            // Receivers run after the update above and outside any `set`
            // callback, so they can update the store while starting the
            // session (the pickup, the carry mode).
            for (const { receiver } of Array.from(moveReceivers)) {
                let claimed = false;
                try {
                    claimed = receiver({ blockId: moving.blockId, pointer });
                } catch (error) {
                    console.error('Block move receiver failed', error);
                }
                if (claimed) {
                    return 'claimed';
                }
            }

            if (get().blockEditing === moving) {
                commit(null);
            }
            return 'unclaimed';
        },
        setBlockEditingCarry: (input) =>
            commit(
                setBlockEditingCarryMode(
                    get().blockEditing,
                    input,
                    sequence + 1,
                ),
            ),
        closeBlockEditing: () => commit(null),
        remapBlockEditingBlockIds: (pairs) =>
            commit(remapBlockEditingBlockId(get().blockEditing, pairs)),
        blockOptionsHudObstacles: emptyHudObstacles,
        setBlockOptionsHudObstacles: (rects) => {
            if (hudObstacleRectsEqual(get().blockOptionsHudObstacles, rects)) {
                return;
            }

            set({
                blockOptionsHudObstacles:
                    rects.length === 0
                        ? emptyHudObstacles
                        : rects.map((rect) => ({
                              left: rect.left,
                              top: rect.top,
                              right: rect.right,
                              bottom: rect.bottom,
                          })),
            });
        },
        blockExpandBarRect: null,
        setBlockExpandBarRect: (rect) => {
            const current = get().blockExpandBarRect;
            if (
                current === rect ||
                (current !== null &&
                    rect !== null &&
                    hudObstacleRectsEqual([current], [rect]))
            ) {
                return;
            }

            set({
                blockExpandBarRect: rect
                    ? {
                          left: rect.left,
                          top: rect.top,
                          right: rect.right,
                          bottom: rect.bottom,
                      }
                    : null,
            });
        },
    };
}
