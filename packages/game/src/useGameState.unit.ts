import assert from 'node:assert/strict';
import test from 'node:test';
import { createActiveDragPreviewTarget } from './dragPreviewIdentity';
import type { ActiveDragPreview } from './useGameState';
import { activeDragPreviewsEqual, createGameState } from './useGameState';
import { getGameSunriseSunset, getGameTimeOfDay } from './utils/timeOfDay';

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

test('addPickupSelectionTarget appends new targets and prevents duplicates', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });
    const primaryTarget = createActiveDragPreviewTarget({
        blockId: 'primary',
        blockIndex: 0,
        stackPosition: { x: 0, z: 0 },
    });
    const extraTarget = createActiveDragPreviewTarget({
        blockId: 'extra',
        blockIndex: 0,
        stackPosition: { x: 1, z: 0 },
    });

    try {
        assert.equal(
            store.getState().addPickupSelectionTarget(primaryTarget),
            true,
        );
        assert.equal(
            store.getState().addPickupSelectionTarget(primaryTarget),
            false,
        );
        assert.equal(
            store.getState().addPickupSelectionTarget(extraTarget),
            true,
        );
        assert.deepEqual(store.getState().pickupSelectionTargets, [
            primaryTarget,
            extraTarget,
        ]);
    } finally {
        store.getState().audio.dispose();
    }
});

test('clearPickupSelectionTargets resets every active pickup target', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().setPickupSelectionTargets([
            createActiveDragPreviewTarget({
                blockId: 'primary',
                blockIndex: 0,
                stackPosition: { x: 0, z: 0 },
            }),
            createActiveDragPreviewTarget({
                blockId: 'extra',
                blockIndex: 0,
                stackPosition: { x: 1, z: 0 },
            }),
        ]);

        store.getState().clearPickupSelectionTargets();

        assert.deepEqual(store.getState().pickupSelectionTargets, []);
    } finally {
        store.getState().audio.dispose();
    }
});

test('createGameState resolves time of day from the provided location', () => {
    const referenceTime = new Date('2026-07-04T20:15:00.000Z');
    const timeLocation = { lat: 64.1466, lon: -21.9426 };
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: referenceTime,
        isMock: true,
        timeLocation,
    });

    try {
        const { sunrise, sunset } = getGameSunriseSunset(
            timeLocation,
            referenceTime,
        );

        assert.equal(
            store.getState().timeOfDay,
            getGameTimeOfDay(timeLocation, referenceTime),
        );
        assert.equal(
            store.getState().sunriseTime?.getTime(),
            sunrise.getTime(),
        );
        assert.equal(store.getState().sunsetTime?.getTime(), sunset.getTime());
    } finally {
        store.getState().audio.dispose();
    }
});

test('syncTimeOfDay refreshes time of day for a new garden location', () => {
    const referenceTime = new Date('2026-07-04T20:15:00.000Z');
    const timeLocation = { lat: 45.9, lon: 16.84 };
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: null,
        isMock: true,
    });

    try {
        const { sunrise, sunset } = getGameSunriseSunset(
            timeLocation,
            referenceTime,
        );

        store.getState().syncTimeOfDay(timeLocation, referenceTime);

        assert.deepEqual(store.getState().timeLocation, timeLocation);
        assert.equal(
            store.getState().timeOfDay,
            getGameTimeOfDay(timeLocation, referenceTime),
        );
        assert.equal(
            store.getState().sunriseTime?.getTime(),
            sunrise.getTime(),
        );
        assert.equal(store.getState().sunsetTime?.getTime(), sunset.getTime());
    } finally {
        store.getState().audio.dispose();
    }
});
