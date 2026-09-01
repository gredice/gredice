import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { createActiveDragPreviewTarget } from './dragPreviewIdentity';
import {
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
} from './structures/editor';
import type { ActiveDragPreview } from './useGameState';
import {
    activeDragPreviewsEqual,
    createGameState,
    getBlockPlacementDropAnimationRenderIdForBlockId,
    resolveBlockPlacementDropAnimationRenderIdentity,
} from './useGameState';
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

function createStructureEditor(templateKey: 'barn' | 'house') {
    const created = createNewGardenStructureEditorState({
        draftId: `fixture-${templateKey}`,
        gardenId: 1,
        placement: { anchorX: -1, anchorY: -1, rotation: 0 },
        seed: createGardenStructureTemplateSeed(templateKey),
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
        throw new Error('Failed to create fixture editor');
    }
    const confirmed = confirmGardenStructureTemplatePlacement(created.value);
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) {
        throw new Error('Failed to confirm fixture editor');
    }
    return confirmed.value;
}

test('authenticated garden queries stay enabled by default and allow explicit isolation', () => {
    const defaultStore = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });
    const isolatedStore = createGameState({
        appBaseUrl: '',
        authenticatedGardenQueriesEnabled: false,
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        assert.equal(
            defaultStore.getState().authenticatedGardenQueriesEnabled,
            true,
        );
        assert.equal(
            isolatedStore.getState().authenticatedGardenQueriesEnabled,
            false,
        );
    } finally {
        defaultStore.getState().audio.dispose();
        isolatedStore.getState().audio.dispose();
    }
});

test('mock garden profile changes without recreating runtime resources', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
        mockGardenProfile: 'high-target',
    });
    const audio = store.getState().audio;

    try {
        store.getState().setMockGardenProfile('fauna-heavy');

        assert.equal(store.getState().mockGardenProfile, 'fauna-heavy');
        assert.equal(store.getState().audio, audio);
    } finally {
        store.getState().audio.dispose();
    }
});

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

test('HUD placement drag preserves an explicit appearance variant without selecting one', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().beginHudPlacementDrag({
            blockName: 'Horse',
            clientX: 10,
            clientY: 20,
            pointerId: 1,
            pointerType: 'mouse',
            variant: 5,
        });
        assert.equal(store.getState().hudPlacementDrag?.variant, 5);

        store.getState().updateHudPlacementDragPointer({
            clientX: 30,
            clientY: 40,
            pointerId: 1,
        });
        assert.equal(store.getState().hudPlacementDrag?.variant, 5);

        store.getState().beginHudPlacementDrag({
            blockName: 'Horse',
            clientX: 10,
            clientY: 20,
            pointerId: 2,
            pointerType: 'mouse',
        });
        assert.equal(store.getState().hudPlacementDrag?.variant, undefined);
    } finally {
        store.getState().audio.dispose();
    }
});

test('closeup camera stays active while the requested view returns to normal', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().setCloseupCameraActive(true);
        store.getState().setCloseupCameraSettled(true);
        store.getState().setView({ view: 'normal' });

        assert.equal(store.getState().view, 'normal');
        assert.equal(store.getState().closeupCameraActive, true);
        assert.equal(store.getState().closeupCameraSettled, true);

        store.getState().setCloseupCameraActive(false);
        store.getState().setCloseupCameraSettled(false);
        assert.equal(store.getState().closeupCameraActive, false);
        assert.equal(store.getState().closeupCameraSettled, false);
    } finally {
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

test('placement animation keeps render and completion identity through confirmed rekey', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('optimistic');
        const animation =
            store.getState().blockPlacementDropAnimations.optimistic;
        assert.ok(animation);
        const optimisticRenderIdentity =
            resolveBlockPlacementDropAnimationRenderIdentity(
                'optimistic',
                store.getState().blockPlacementDropAnimations,
            );
        const optimisticRenderId =
            getBlockPlacementDropAnimationRenderIdForBlockId(
                store.getState().blockPlacementDropAnimations,
                'optimistic',
            );

        store.getState().queueBlockPlacementDropAnimation('unrelated');
        assert.equal(
            getBlockPlacementDropAnimationRenderIdForBlockId(
                store.getState().blockPlacementDropAnimations,
                'optimistic',
            ),
            optimisticRenderId,
        );
        store.getState().cancelBlockPlacementDropAnimation('unrelated');

        store
            .getState()
            .markBlockPlacementDropVisualStarted(animation.renderId);
        store
            .getState()
            .confirmBlockPlacementDropAnimation('optimistic', 'persisted');

        assert.equal(
            store.getState().blockPlacementDropAnimations.optimistic,
            undefined,
        );
        assert.strictEqual(
            store.getState().blockPlacementDropAnimations.persisted?.renderId,
            animation.renderId,
        );
        assert.equal(
            store.getState().blockPlacementDropAnimations.persisted
                ?.mutationConfirmed,
            true,
        );
        assert.equal(
            resolveBlockPlacementDropAnimationRenderIdentity(
                'optimistic',
                store.getState().blockPlacementDropAnimations,
            ),
            optimisticRenderIdentity,
        );
        assert.equal(
            resolveBlockPlacementDropAnimationRenderIdentity(
                'persisted',
                store.getState().blockPlacementDropAnimations,
            ),
            optimisticRenderIdentity,
        );

        assert.equal(
            store
                .getState()
                .markBlockPlacementDropParticlesSpawned(animation.renderId),
            true,
        );
        assert.equal(
            store.getState().blockPlacementDropAnimations.persisted
                ?.particlesSpawned,
            true,
        );
        assert.equal(
            store
                .getState()
                .markBlockPlacementDropParticlesSpawned(animation.renderId),
            false,
        );

        store
            .getState()
            .markBlockPlacementDropVisualComplete(animation.renderId);
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
        assert.equal(
            resolveBlockPlacementDropAnimationRenderIdentity(
                'persisted',
                store.getState().blockPlacementDropAnimations,
            ),
            'block:persisted',
        );
    } finally {
        store.getState().audio.dispose();
    }
});

test('renderer-free state does not retain visual placement effects', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
        visualPlacementEffectsEnabled: false,
    });

    try {
        store.getState().queuePlacedBlockEffect('optimistic', {
            kind: 'sunflowers',
            amount: 25,
        });
        store.getState().queueBlockPlacementDropAnimation('optimistic');

        assert.deepEqual(store.getState().placedBlockEffects, {});
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('placement animation waits for mutation confirmation after visual completion', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('optimistic');
        const animation =
            store.getState().blockPlacementDropAnimations.optimistic;
        assert.ok(animation);

        store
            .getState()
            .markBlockPlacementDropVisualStarted(animation.renderId);
        store
            .getState()
            .markBlockPlacementDropVisualComplete(animation.renderId);
        assert.equal(
            store.getState().blockPlacementDropAnimations.optimistic
                ?.visualComplete,
            true,
        );

        store
            .getState()
            .confirmBlockPlacementDropAnimation('optimistic', 'persisted');
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('pre-confirmed synthetic placement releases after its visual completion', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('profile-block', {
            mutationConfirmed: true,
        });
        const animation =
            store.getState().blockPlacementDropAnimations['profile-block'];
        assert.ok(animation);
        assert.equal(
            store.getState().blockPlacementDropAnimations['profile-block']
                ?.mutationConfirmed,
            true,
        );

        store
            .getState()
            .markBlockPlacementDropVisualStarted(animation.renderId);
        store
            .getState()
            .markBlockPlacementDropVisualComplete(animation.renderId);
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('confirmed placement without a committed visual renderer finalizes immediately', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('suspended');
        store
            .getState()
            .confirmBlockPlacementDropAnimation('suspended', 'persisted');

        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('placement animation cancellation resolves the optimistic source after confirmed rekey', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('optimistic');
        const animation =
            store.getState().blockPlacementDropAnimations.optimistic;
        assert.ok(animation);
        store
            .getState()
            .markBlockPlacementDropVisualStarted(animation.renderId);
        store
            .getState()
            .confirmBlockPlacementDropAnimation('optimistic', 'persisted');
        store.getState().cancelBlockPlacementDropAnimation('optimistic');

        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
        store.getState().cancelBlockPlacementDropAnimation('missing');
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('placement animation remains cancellable after its visual completes before a late mutation error', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('optimistic');
        const animation =
            store.getState().blockPlacementDropAnimations.optimistic;
        assert.ok(animation);

        store
            .getState()
            .markBlockPlacementDropVisualStarted(animation.renderId);
        store
            .getState()
            .markBlockPlacementDropVisualComplete(animation.renderId);
        assert.equal(
            Object.keys(store.getState().blockPlacementDropAnimations).length,
            1,
        );

        store.getState().cancelBlockPlacementDropAnimation('optimistic');
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
    } finally {
        store.getState().audio.dispose();
    }
});

test('overlapping placement animations complete independently after confirmed rekey', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().queueBlockPlacementDropAnimation('first');
        store.getState().queueBlockPlacementDropAnimation('second');
        const first = store.getState().blockPlacementDropAnimations.first;
        const second = store.getState().blockPlacementDropAnimations.second;
        assert.ok(first);
        assert.ok(second);
        assert.equal(
            Object.keys(store.getState().blockPlacementDropAnimations).length,
            2,
        );

        store.getState().markBlockPlacementDropVisualStarted(first.renderId);
        store
            .getState()
            .confirmBlockPlacementDropAnimation('first', 'first-persisted');
        store.getState().markBlockPlacementDropVisualComplete(first.renderId);
        assert.equal(
            Object.keys(store.getState().blockPlacementDropAnimations).length,
            1,
        );
        assert.strictEqual(
            store.getState().blockPlacementDropAnimations.second,
            second,
        );

        store.getState().cancelBlockPlacementDropAnimation('second');
        assert.deepEqual(store.getState().blockPlacementDropAnimations, {});
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

test('garden avatar view enters play mode and resets controls on exit', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().setGardenAvatarView('third-person');
        store.getState().setGardenAvatarMoveInput({ forward: 1, right: -1 });
        store.getState().setGardenAvatarSprintInput(true);
        store.getState().setGardenAvatarCrouchInput(true);
        store.getState().scaleGardenAvatarCameraZoom(1.15);
        store.getState().requestGardenAvatarJump();

        assert.equal(store.getState().gardenAvatarView, 'third-person');
        assert.deepEqual(store.getState().gardenAvatarMoveInput, {
            forward: 1,
            right: -1,
        });
        assert.equal(store.getState().gardenAvatarJumpRequest, 1);
        assert.equal(store.getState().gardenAvatarSprintInput, true);
        assert.equal(store.getState().gardenAvatarCrouchInput, true);
        assert.equal(store.getState().gardenAvatarCameraZoom, 1.15);
        assert.equal(store.getState().gardenAvatarCollisionDebugVisible, false);

        store.getState().setGardenAvatarAimedBoatId('boat-a');
        store.getState().setGardenAvatarBoatId('boat-a');
        assert.equal(store.getState().gardenAvatarBoatId, 'boat-a');
        assert.equal(store.getState().gardenAvatarAimedBoatId, null);
        assert.equal(store.getState().gardenAvatarSprintInput, false);
        assert.equal(store.getState().gardenAvatarCrouchInput, false);

        store.getState().setGardenAvatarSeatId('bench-a');
        assert.equal(store.getState().gardenAvatarSeatId, 'bench-a');
        assert.equal(store.getState().gardenAvatarBoatId, null);
        store.getState().setGardenAvatarBoatId('boat-a');
        assert.equal(store.getState().gardenAvatarSeatId, null);

        store.getState().setGardenAvatarPresence({
            position: { x: 1, y: 0, z: -2 },
            updatedAt: 4,
            yaw: 0.5,
        });
        store.getState().petGardenAvatarAnimal({
            species: 'Cat',
            targetId: 'cat-a',
        });
        store.getState().petGardenAvatarAnimal({
            species: 'Dog',
            targetId: 'dog-a',
        });
        store.getState().kickGardenAvatarBeachBall({
            direction: { x: 0, z: -1 },
            targetId: 'ball-a',
        });
        assert.equal(store.getState().gardenAvatarPresence?.position.x, 1);
        assert.equal(
            store.getState().gardenAvatarAnimalPetRequest?.sequence,
            2,
        );
        assert.equal(
            store.getState().gardenAvatarAnimalPetRequest?.targetId,
            'dog-a',
        );
        assert.equal(
            store.getState().gardenAvatarBeachBallKickRequest?.targetId,
            'ball-a',
        );

        store.getState().setGardenAvatarCollisionDebugVisible(true);
        assert.equal(store.getState().gardenAvatarCollisionDebugVisible, true);

        store.getState().setGardenAvatarView('overview');
        assert.equal(store.getState().gardenAvatarView, 'overview');
        assert.deepEqual(store.getState().gardenAvatarMoveInput, {
            forward: 0,
            right: 0,
        });
        assert.equal(store.getState().gardenAvatarSprintInput, false);
        assert.equal(store.getState().gardenAvatarCrouchInput, false);
        assert.equal(store.getState().gardenAvatarCameraZoom, 1);
        assert.equal(store.getState().gardenAvatarBoatId, null);
        assert.equal(store.getState().gardenAvatarAimedBoatId, null);
        assert.equal(store.getState().gardenAvatarSeatId, null);
        assert.equal(store.getState().gardenAvatarPresence, null);
    } finally {
        store.getState().audio.dispose();
    }
});

test('structure build mode is one discriminated session and excludes avatar and closeup modes', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        store.getState().setGardenAvatarView('third-person');
        store.getState().setPickupBlock({
            id: 'dragged-block',
            name: 'Block_Grass',
            rotation: 0,
        });
        store.getState().setActiveDragPreview(createPreview());
        store.getState().beginHudPlacementDrag({
            blockName: 'Block_Grass',
            clientX: 10,
            clientY: 20,
            pointerId: 4,
            pointerType: 'touch',
        });
        store.getState().addPickupSelectionTarget({
            blockId: 'dragged-block',
            blockIndex: 0,
            stackPosition: { x: 0, z: 0 },
        });
        store.getState().setStationaryPickupOutlineTarget({
            blockId: 'dragged-block',
            blockIndex: 0,
            stackPosition: { x: 0, z: 0 },
        });
        store.getState().setItemsHudDropTargetActive(true);
        store.getState().setIsDragging(true);
        store.getState().setStructureBuildSession({
            editor: createStructureEditor('house'),
            persistence: 'fixture',
            category: 'structure',
            roofCutaway: false,
            selectedPartId: null,
        });

        assert.equal(store.getState().gardenAvatarView, 'overview');
        assert.equal(store.getState().view, 'normal');
        assert.equal(
            store.getState().structureBuildSession?.editor.workflow.kind,
            'editing',
        );
        assert.equal(store.getState().pickupBlock, null);
        assert.equal(store.getState().activeDragPreview, null);
        assert.equal(store.getState().hudPlacementDrag, null);
        assert.deepEqual(store.getState().pickupSelectionTargets, []);
        assert.equal(store.getState().stationaryPickupOutlineTarget, null);
        assert.equal(store.getState().itemsHudDropTargetActive, false);
        assert.equal(store.getState().isDragging, false);

        store.getState().setGardenAvatarView('first-person');
        assert.equal(store.getState().structureBuildSession, null);

        store.getState().setStructureBuildSession({
            editor: createStructureEditor('barn'),
            persistence: 'fixture',
            category: 'roof',
            roofCutaway: true,
            selectedPartId: null,
        });
        store.getState().setView({
            view: 'closeup',
            block: { id: 'bed', name: 'Raised_Bed', rotation: 0 },
        });
        assert.equal(store.getState().structureBuildSession, null);
    } finally {
        store.getState().audio.dispose();
    }
});

test('environment can publish blended rain intensity for surface effects', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        assert.equal(store.getState().rainSurfaceIntensity, 0);
        store.getState().setRainSurfaceIntensity(0.72);
        assert.equal(store.getState().rainSurfaceIntensity, 0.72);
    } finally {
        store.getState().audio.dispose();
    }
});

test('garden target highlights can be replaced and cleared', () => {
    const store = createGameState({
        appBaseUrl: '',
        freezeTime: new Date('2026-01-01T12:00:00.000Z'),
        isMock: true,
    });

    try {
        const highlight = {
            fieldId: 27,
            gardenId: 8,
            label: 'Polje 3',
            message: 'Prikazana je završena radnja.',
            positionIndex: 2,
            raisedBedId: 17,
            raisedBedName: 'Sjever',
        };

        store.getState().setGardenTargetHighlight(highlight);
        const firstHighlight = store.getState().gardenTargetHighlight;
        assert.ok(firstHighlight);
        assert.deepEqual(
            {
                fieldId: firstHighlight.fieldId,
                gardenId: firstHighlight.gardenId,
                label: firstHighlight.label,
                message: firstHighlight.message,
                positionIndex: firstHighlight.positionIndex,
                raisedBedId: firstHighlight.raisedBedId,
                raisedBedName: firstHighlight.raisedBedName,
                sequence: firstHighlight.sequence,
            },
            { ...highlight, sequence: 1 },
        );
        assert.equal(typeof firstHighlight.createdAt, 'number');

        store.getState().setGardenTargetHighlight(highlight);
        assert.equal(store.getState().gardenTargetHighlight?.sequence, 2);

        store.getState().clearGardenTargetHighlight();
        assert.equal(store.getState().gardenTargetHighlight, null);
    } finally {
        store.getState().audio.dispose();
    }
});
