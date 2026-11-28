import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createStore } from 'zustand';
import { createGameState } from '../useGameState';
import {
    type BlockEditingSlice,
    type BlockEditingState,
    type BlockMoveReceiver,
    beginBlockEditingMove,
    blockPlaceBatchMutationKey,
    createBlockEditingSlice,
    hudObstacleRectsEqual,
    openBlockEditingMenu,
    remapBlockEditingBlockId,
    requestBlockEditingRemove,
    setBlockEditingCarryMode,
    setBlockEditingExpandCorner,
    setBlockEditingExpandPending,
    setBlockEditingRemovePending,
    startBlockEditingExpand,
} from './blockEditingState';

const menu: BlockEditingState = {
    mode: 'menu',
    blockId: 'block-1',
    blockName: 'Block_Grass',
    pointerType: 'mouse',
    openedAt: 100,
    sequence: 1,
};

const expandStart = {
    rotation: 1,
    source: { x: 2, z: -3 },
    sourceBaseHeight: 0.4,
    maxSide: 5,
} as const;

function createExpand(): BlockEditingState {
    const expand = startBlockEditingExpand(menu, expandStart, 2);
    assert.ok(expand?.mode === 'expand');
    return expand;
}

function createSliceStore(now = () => 1000) {
    let setDepth = 0;
    let setCalls = 0;
    const store = createStore<BlockEditingSlice>((set, get) =>
        createBlockEditingSlice(
            (partial) => {
                setDepth += 1;
                setCalls += 1;
                try {
                    set(partial);
                } finally {
                    setDepth -= 1;
                }
            },
            get,
            { now },
        ),
    );

    return {
        store,
        get setDepth() {
            return setDepth;
        },
        get setCalls() {
            return setCalls;
        },
    };
}

function openMenu(store: ReturnType<typeof createSliceStore>['store']) {
    store.getState().openBlockOptions({
        blockId: 'block-1',
        blockName: 'BeachBall',
        pointerType: 'touch',
    });
}

describe('blockPlaceBatchMutationKey', () => {
    it('extends the single placement key so prefix filters count batches', () => {
        assert.deepEqual(blockPlaceBatchMutationKey.slice(0, 3), [
            'gardens',
            'current',
            'blockPlace',
        ]);
        assert.equal(blockPlaceBatchMutationKey[3], 'batch');
    });
});

describe('block editing transitions', () => {
    it('opens the pop-up from nothing or from another pop-up', () => {
        const opened = openBlockEditingMenu(
            null,
            { blockId: 'a', blockName: 'Bush', pointerType: 'mouse' },
            { openedAt: 5, sequence: 3 },
        );
        assert.deepEqual(opened, {
            mode: 'menu',
            blockId: 'a',
            blockName: 'Bush',
            pointerType: 'mouse',
            openedAt: 5,
            sequence: 3,
        });

        const reopened = openBlockEditingMenu(
            menu,
            { blockId: 'b', blockName: 'Tulip', pointerType: 'pen' },
            { openedAt: 9, sequence: 4 },
        );
        assert.equal(reopened?.blockId, 'b');
        assert.equal(reopened?.sequence, 4);
    });

    it('does not open the pop-up over Expand, a move or the remove dialog', () => {
        const expand = createExpand();
        const moving = beginBlockEditingMove(menu, 2);
        const confirm = requestBlockEditingRemove(menu, 2);
        for (const current of [expand, moving, confirm]) {
            assert.equal(
                openBlockEditingMenu(
                    current,
                    { blockId: 'x', blockName: 'Bush', pointerType: 'mouse' },
                    { openedAt: 1, sequence: 9 },
                ),
                current,
            );
        }
    });

    it('starts Expand from the pop-up with the corner on the source', () => {
        assert.deepEqual(createExpand(), {
            mode: 'expand',
            blockId: 'block-1',
            blockName: 'Block_Grass',
            rotation: 1,
            source: { x: 2, z: -3 },
            sourceBaseHeight: 0.4,
            maxSide: 5,
            corner: { x: 2, z: -3 },
            pending: false,
            sequence: 2,
        });
        assert.equal(startBlockEditingExpand(null, expandStart, 2), null);
        assert.equal(
            startBlockEditingExpand(menu, { ...expandStart, maxSide: 0 }, 2),
            menu,
        );
        assert.equal(
            startBlockEditingExpand(
                menu,
                { ...expandStart, sourceBaseHeight: Number.NaN },
                2,
            ),
            menu,
        );
    });

    it('moves the corner, clamped to maxSide, and ignores unchanged cells', () => {
        const expand = createExpand();
        const moved = setBlockEditingExpandCorner(expand, { x: 5, z: -1 });
        assert.equal(moved?.mode, 'expand');
        assert.deepEqual(moved?.mode === 'expand' && moved.corner, {
            x: 5,
            z: -1,
        });
        assert.equal(moved?.sequence, expand.sequence);

        const clamped = setBlockEditingExpandCorner(expand, {
            x: 40,
            z: -40,
        });
        assert.deepEqual(clamped?.mode === 'expand' && clamped.corner, {
            x: 6,
            z: -7,
        });

        assert.equal(
            setBlockEditingExpandCorner(moved, { x: 5, z: -1 }),
            moved,
        );
        assert.equal(setBlockEditingExpandCorner(menu, { x: 1, z: 1 }), menu);
    });

    it('locks the corner while the batch is pending', () => {
        const pending = setBlockEditingExpandPending(createExpand(), true);
        assert.equal(pending?.mode === 'expand' && pending.pending, true);
        assert.equal(setBlockEditingExpandPending(pending, true), pending);
        assert.equal(
            setBlockEditingExpandCorner(pending, { x: 9, z: 9 }),
            pending,
        );

        const released = setBlockEditingExpandPending(pending, false);
        const moved = setBlockEditingExpandCorner(released, { x: 3, z: -3 });
        assert.deepEqual(moved?.mode === 'expand' && moved.corner, {
            x: 3,
            z: -3,
        });
        assert.equal(setBlockEditingExpandPending(menu, true), menu);
    });

    it('asks to confirm removal only from the pop-up', () => {
        assert.deepEqual(requestBlockEditingRemove(menu, 7), {
            mode: 'confirm-remove',
            blockId: 'block-1',
            blockName: 'Block_Grass',
            pending: false,
            sequence: 7,
        });
        const expand = createExpand();
        assert.equal(requestBlockEditingRemove(expand, 7), expand);
        assert.equal(requestBlockEditingRemove(null, 7), null);
    });

    it('marks a confirmed removal pending and settled, in the dialog only', () => {
        const confirm = requestBlockEditingRemove(menu, 7);
        const pending = setBlockEditingRemovePending(confirm, true);
        assert.deepEqual(pending, {
            mode: 'confirm-remove',
            blockId: 'block-1',
            blockName: 'Block_Grass',
            pending: true,
            sequence: 7,
        });
        assert.equal(setBlockEditingRemovePending(pending, true), pending);
        assert.deepEqual(setBlockEditingRemovePending(pending, false), confirm);
        assert.equal(setBlockEditingRemovePending(confirm, false), confirm);

        // Other modes ignore it; Expand has its own pending flag.
        const expand = createExpand();
        assert.equal(setBlockEditingRemovePending(expand, true), expand);
        assert.equal(setBlockEditingRemovePending(menu, true), menu);
        assert.equal(setBlockEditingRemovePending(null, true), null);
        assert.equal(setBlockEditingExpandPending(confirm, true), confirm);
    });

    it('moves from the pop-up to moving, then to carry, and ends both', () => {
        const moving = beginBlockEditingMove(menu, 2);
        assert.deepEqual(moving, {
            mode: 'moving',
            blockId: 'block-1',
            blockName: 'Block_Grass',
            sequence: 2,
        });
        assert.equal(beginBlockEditingMove(moving, 3), moving);

        const carry = setBlockEditingCarryMode(
            moving,
            { pointerType: 'touch' },
            3,
        );
        assert.deepEqual(carry, {
            mode: 'carry',
            blockId: 'block-1',
            blockName: 'Block_Grass',
            pointerType: 'touch',
            sequence: 3,
        });
        assert.equal(
            setBlockEditingCarryMode(carry, { pointerType: 'touch' }, 4),
            carry,
        );
        assert.equal(
            setBlockEditingCarryMode(carry, { pointerType: 'mouse' }, 4)
                ?.sequence,
            3,
        );
        assert.equal(setBlockEditingCarryMode(carry, null, 4), null);
        assert.equal(setBlockEditingCarryMode(moving, null, 4), null);

        // Carry starts only from a running move; null leaves other modes.
        assert.equal(
            setBlockEditingCarryMode(menu, { pointerType: 'mouse' }, 4),
            menu,
        );
        assert.equal(setBlockEditingCarryMode(menu, null, 4), menu);
        const expand = createExpand();
        assert.equal(setBlockEditingCarryMode(expand, null, 4), expand);
    });

    it('remaps the block id and keeps everything else', () => {
        const expand = createExpand();
        const remapped = remapBlockEditingBlockId(expand, [
            ['other', 'x'],
            ['block-1', 'saved-1'],
        ]);
        assert.deepEqual(remapped, { ...expand, blockId: 'saved-1' });
        assert.equal(
            remapBlockEditingBlockId(expand, [['other', 'x']]),
            expand,
        );
        assert.equal(
            remapBlockEditingBlockId(expand, [['block-1', 'block-1']]),
            expand,
        );
        assert.equal(remapBlockEditingBlockId(null, [['a', 'b']]), null);
        assert.equal(
            remapBlockEditingBlockId(menu, new Map([['block-1', 'saved-1']]))
                ?.blockId,
            'saved-1',
        );
    });

    it('compares HUD obstacle lists by value', () => {
        const rect = { left: 1, top: 2, right: 3, bottom: 4 };
        assert.equal(hudObstacleRectsEqual([rect], [{ ...rect }]), true);
        assert.equal(hudObstacleRectsEqual([], []), true);
        assert.equal(hudObstacleRectsEqual([rect], []), false);
        assert.equal(
            hudObstacleRectsEqual([rect], [{ ...rect, bottom: 5 }]),
            false,
        );
    });
});

describe('block editing store slice', () => {
    it('numbers every new mode, also after closing', () => {
        const { store } = createSliceStore(() => 42);
        openMenu(store);
        const first = store.getState().blockEditing;
        assert.equal(first?.mode, 'menu');
        assert.equal(first?.mode === 'menu' && first.openedAt, 42);

        store.getState().startBlockExpand(expandStart);
        const expand = store.getState().blockEditing;
        store.getState().setBlockExpandCorner({ x: 3, z: -3 });
        const moved = store.getState().blockEditing;
        store.getState().closeBlockEditing();
        assert.equal(store.getState().blockEditing, null);
        openMenu(store);
        const reopened = store.getState().blockEditing;

        assert.ok(first && expand && moved && reopened);
        assert.ok(expand.sequence > first.sequence);
        // A corner change updates the same Expand.
        assert.equal(moved.sequence, expand.sequence);
        assert.ok(reopened.sequence > expand.sequence);
    });

    it('does not notify listeners for no-op updates', () => {
        const harness = createSliceStore();
        const { store } = harness;
        openMenu(store);
        store.getState().startBlockExpand(expandStart);
        store.getState().setBlockExpandPending(true);
        const before = harness.setCalls;

        store.getState().setBlockExpandCorner({ x: 4, z: -3 });
        store.getState().setBlockExpandPending(true);
        store.getState().requestBlockRemove();
        store.getState().setBlockEditingCarry(null);
        store.getState().remapBlockEditingBlockIds([['missing', 'x']]);
        assert.equal(harness.setCalls, before);
        assert.deepEqual(
            store.getState().blockEditing?.mode === 'expand' &&
                store.getState().blockEditing,
            {
                ...expandStart,
                mode: 'expand',
                blockId: 'block-1',
                blockName: 'BeachBall',
                corner: expandStart.source,
                pending: true,
                sequence: 2,
            },
        );
    });

    it('keeps a pending removal on the same dialog and lets it close', () => {
        const harness = createSliceStore();
        const { store } = harness;
        openMenu(store);
        store.getState().requestBlockRemove();
        const confirm = store.getState().blockEditing;
        assert.equal(confirm?.mode, 'confirm-remove');

        store.getState().setBlockRemovePending(true);
        const pending = store.getState().blockEditing;
        assert.equal(
            pending?.mode === 'confirm-remove' && pending.pending,
            true,
        );
        assert.equal(pending?.sequence, confirm?.sequence);

        const calls = harness.setCalls;
        store.getState().setBlockRemovePending(true);
        store.getState().setBlockExpandPending(false);
        store.getState().openBlockOptions({
            blockId: 'other',
            blockName: 'Bush',
            pointerType: 'mouse',
        });
        assert.equal(harness.setCalls, calls);
        assert.equal(store.getState().blockEditing, pending);

        // An error settles it and the dialog stays for the message.
        store.getState().setBlockRemovePending(false);
        const settled = store.getState().blockEditing;
        assert.equal(
            settled?.mode === 'confirm-remove' && settled.pending,
            false,
        );

        store.getState().setBlockRemovePending(true);
        store.getState().closeBlockEditing();
        assert.equal(store.getState().blockEditing, null);
        store.getState().setBlockRemovePending(false);
        assert.equal(store.getState().blockEditing, null);
    });

    it('stores HUD obstacles only when they change', () => {
        const harness = createSliceStore();
        const { store } = harness;
        const rects = [{ left: 0, top: 0, right: 10, bottom: 20 }];
        assert.deepEqual(store.getState().blockOptionsHudObstacles, []);

        store.getState().setBlockOptionsHudObstacles(rects);
        const stored = store.getState().blockOptionsHudObstacles;
        assert.deepEqual(stored, rects);
        assert.notEqual(stored, rects);

        const calls = harness.setCalls;
        store.getState().setBlockOptionsHudObstacles([{ ...rects[0] }]);
        assert.equal(harness.setCalls, calls);
        assert.equal(store.getState().blockOptionsHudObstacles, stored);

        store.getState().setBlockOptionsHudObstacles([]);
        assert.deepEqual(store.getState().blockOptionsHudObstacles, []);
    });

    it('returns unclaimed and changes nothing outside the pop-up', () => {
        const { store } = createSliceStore();
        const receiver = mock.fn<BlockMoveReceiver>(() => true);
        store.getState().registerBlockMoveReceiver(receiver);

        assert.equal(store.getState().requestBlockMove(null), 'unclaimed');
        assert.equal(store.getState().blockEditing, null);

        openMenu(store);
        store.getState().startBlockExpand(expandStart);
        const expand = store.getState().blockEditing;
        assert.equal(store.getState().requestBlockMove(null), 'unclaimed');
        assert.equal(store.getState().blockEditing, expand);
        assert.equal(receiver.mock.callCount(), 0);
    });

    it('closes editing when no receiver claims the move', () => {
        const { store } = createSliceStore();
        openMenu(store);
        assert.equal(store.getState().requestBlockMove(null), 'unclaimed');
        assert.equal(store.getState().blockEditing, null);

        openMenu(store);
        const declines = mock.fn<BlockMoveReceiver>(() => false);
        store.getState().registerBlockMoveReceiver(declines);
        assert.equal(store.getState().requestBlockMove(null), 'unclaimed');
        assert.equal(declines.mock.callCount(), 1);
        assert.equal(store.getState().blockEditing, null);
    });

    it('asks receivers in order, outside any store update, until one claims', () => {
        const harness = createSliceStore();
        const { store } = harness;
        const pointer = {
            pointerId: 7,
            pointerType: 'touch',
            clientX: 120,
            clientY: 340,
        };
        const seen: string[] = [];
        const first = mock.fn<BlockMoveReceiver>((input) => {
            seen.push(`first:${input.blockId}`);
            assert.equal(harness.setDepth, 0);
            assert.equal(store.getState().blockEditing?.mode, 'moving');
            return false;
        });
        const second = mock.fn<BlockMoveReceiver>((input) => {
            seen.push(`second:${input.blockId}`);
            assert.equal(harness.setDepth, 0);
            assert.deepEqual(input.pointer, pointer);
            return true;
        });
        const third = mock.fn<BlockMoveReceiver>(() => true);
        store.getState().registerBlockMoveReceiver(first);
        store.getState().registerBlockMoveReceiver(second);
        store.getState().registerBlockMoveReceiver(third);

        openMenu(store);
        assert.equal(store.getState().requestBlockMove(pointer), 'claimed');
        assert.deepEqual(seen, ['first:block-1', 'second:block-1']);
        assert.equal(third.mock.callCount(), 0);
        assert.equal(store.getState().blockEditing?.mode, 'moving');
    });

    it('lets a receiver switch to carry while it claims the move', () => {
        const { store } = createSliceStore();
        store.getState().registerBlockMoveReceiver(({ pointer }) => {
            if (pointer === null) {
                store.getState().setBlockEditingCarry({ pointerType: 'mouse' });
            }
            return true;
        });

        openMenu(store);
        assert.equal(store.getState().requestBlockMove(null), 'claimed');
        const carry = store.getState().blockEditing;
        assert.equal(carry?.mode, 'carry');
        assert.equal(carry?.mode === 'carry' && carry.pointerType, 'mouse');

        store.getState().setBlockEditingCarry(null);
        assert.equal(store.getState().blockEditing, null);
    });

    it('skips a failing receiver and stops asking removed ones', () => {
        const { store } = createSliceStore();
        const consoleError = mock.method(console, 'error', () => {});
        try {
            const failing = mock.fn<BlockMoveReceiver>(() => {
                throw new Error('session failed');
            });
            const removed = mock.fn<BlockMoveReceiver>(() => true);
            const claiming = mock.fn<BlockMoveReceiver>(() => true);
            store.getState().registerBlockMoveReceiver(failing);
            const unregister = store
                .getState()
                .registerBlockMoveReceiver(removed);
            store.getState().registerBlockMoveReceiver(claiming);
            unregister();

            openMenu(store);
            assert.equal(store.getState().requestBlockMove(null), 'claimed');
            assert.equal(failing.mock.callCount(), 1);
            assert.equal(removed.mock.callCount(), 0);
            assert.equal(claiming.mock.callCount(), 1);
            assert.equal(consoleError.mock.callCount(), 1);
        } finally {
            consoleError.mock.restore();
        }
    });

    it('keeps the same receiver registered twice until both are removed', () => {
        const { store } = createSliceStore();
        const receiver = mock.fn<BlockMoveReceiver>(() => false);
        const unregisterFirst = store
            .getState()
            .registerBlockMoveReceiver(receiver);
        store.getState().registerBlockMoveReceiver(receiver);
        unregisterFirst();

        openMenu(store);
        store.getState().requestBlockMove(null);
        assert.equal(receiver.mock.callCount(), 1);
    });

    it('counts mounted block options UIs until each is removed once', () => {
        const slice = createSliceStore();
        const { store } = slice;
        assert.equal(store.getState().isBlockOptionsUiMounted(), false);

        const unregisterFirst = store.getState().registerBlockOptionsUi();
        const unregisterSecond = store.getState().registerBlockOptionsUi();
        assert.equal(store.getState().isBlockOptionsUiMounted(), true);

        unregisterFirst();
        // A repeated cleanup must not remove the other registration.
        unregisterFirst();
        assert.equal(store.getState().isBlockOptionsUiMounted(), true);

        unregisterSecond();
        assert.equal(store.getState().isBlockOptionsUiMounted(), false);
        // Registrations are not reactive state: nothing re-renders.
        assert.equal(slice.setCalls, 0);
    });
});

describe('game state wiring', () => {
    it('follows a saved placement from its optimistic id', () => {
        const store = createGameState({
            appBaseUrl: '',
            freezeTime: new Date('2026-01-01T12:00:00.000Z'),
            isMock: true,
        });
        store.getState().openBlockOptions({
            blockId: 'optimistic-block:Bush:abc',
            blockName: 'Bush',
            pointerType: 'mouse',
        });

        store
            .getState()
            .confirmBlockPlacementDropAnimation(
                'optimistic-block:Bush:abc',
                'saved-7',
            );
        assert.equal(store.getState().blockEditing?.blockId, 'saved-7');

        store.getState().confirmBlockPlacementDropAnimation('other', 'x');
        assert.equal(store.getState().blockEditing?.blockId, 'saved-7');
    });

    it('starts with no editing and no HUD obstacles', () => {
        const state = createGameState({
            appBaseUrl: '',
            freezeTime: new Date('2026-01-01T12:00:00.000Z'),
            isMock: true,
        }).getState();
        assert.equal(state.blockEditing, null);
        assert.deepEqual(state.blockOptionsHudObstacles, []);
    });
});
