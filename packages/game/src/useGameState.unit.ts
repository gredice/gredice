import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActiveDragPreview } from './useGameState';
import { activeDragPreviewsEqual, createGameState } from './useGameState';

function createPreview(): ActiveDragPreview {
    return {
        source: {
            blockId: 'source',
            blockIndex: 0,
            stackPosition: { x: 0, z: 0 },
        },
        targets: [
            {
                blockId: 'source',
                blockIndex: 0,
                stackPosition: { x: 0, z: 0 },
                hoverHeight: 0,
            },
        ],
        hoveredGardenBoxBlockId: null,
        relative: { x: 0, z: 0 },
        isBlocked: false,
        isOverRecycler: false,
    };
}

test('activeDragPreviewsEqual matches equivalent preview values', () => {
    const preview = createPreview();

    assert.equal(
        activeDragPreviewsEqual(preview, {
            ...preview,
            source: {
                blockId: 'source',
                blockIndex: 0,
                stackPosition: { x: 0, z: 0 },
            },
            targets: [
                {
                    blockId: 'source',
                    blockIndex: 0,
                    stackPosition: { x: 0, z: 0 },
                    hoverHeight: 0,
                },
            ],
            relative: { x: 0, z: 0 },
        }),
        true,
    );
});

test('setActiveDragPreview skips equivalent drag preview updates', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });
    let updateCount = 0;
    const unsubscribe = store.subscribe(() => {
        updateCount += 1;
    });
    const preview = createPreview();

    try {
        store.getState().setActiveDragPreview(preview);
        assert.equal(updateCount, 1);

        store.getState().setActiveDragPreview({
            ...preview,
            source: {
                blockId: 'source',
                blockIndex: 0,
                stackPosition: { x: 0, z: 0 },
            },
            targets: [
                {
                    blockId: 'source',
                    blockIndex: 0,
                    stackPosition: { x: 0, z: 0 },
                    hoverHeight: 0,
                },
            ],
            relative: { x: 0, z: 0 },
        });
        assert.equal(updateCount, 1);

        store.getState().setActiveDragPreview({
            ...preview,
            relative: { x: 1, z: 0 },
        });
        assert.equal(updateCount, 2);
    } finally {
        unsubscribe();
        store.getState().audio.dispose();
    }
});
