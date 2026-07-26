import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import {
    buildDirectionalShadowDepthSignature,
    buildGardenShadowGeometrySignature,
    consumeDeferredShadowRefresh,
    createDeferredShadowRefreshState,
    requestPrimaryShadowMapRefresh,
    transitionDeferredShadowRefresh,
} from './shadowMapScheduling';

const baseShadowDepth = {
    lightPosition: { x: 10, y: 20, z: 30 },
    shadowCameraSize: 40,
    shadowMapSize: 2048,
    shadows: true,
};

describe('buildDirectionalShadowDepthSignature', () => {
    it('is stable when all depth inputs are unchanged', () => {
        const daylightLight = {
            color: '#ffffff',
            intensity: 2,
            position: baseShadowDepth.lightPosition,
        };
        const stormLight = {
            color: '#8090a0',
            intensity: 0.2,
            position: { ...baseShadowDepth.lightPosition },
        };

        const daylightSignature = buildDirectionalShadowDepthSignature({
            ...baseShadowDepth,
            lightPosition: daylightLight.position,
        });
        const stormSignature = buildDirectionalShadowDepthSignature({
            ...baseShadowDepth,
            lightPosition: stormLight.position,
        });

        assert.equal(daylightSignature, stormSignature);
    });

    it('changes for enabled, map, camera, and light-position changes', () => {
        const signature = buildDirectionalShadowDepthSignature(baseShadowDepth);
        const changedInputs = [
            { ...baseShadowDepth, shadows: false },
            { ...baseShadowDepth, shadowMapSize: 4096 },
            { ...baseShadowDepth, shadowCameraSize: 42 },
            {
                ...baseShadowDepth,
                lightPosition: { ...baseShadowDepth.lightPosition, x: 11 },
            },
        ];

        for (const input of changedInputs) {
            assert.notEqual(
                buildDirectionalShadowDepthSignature(input),
                signature,
            );
        }
    });
});

describe('primary shadow refresh accounting', () => {
    it('marks and counts an enabled primary shadow refresh', () => {
        const shadowMap = { enabled: false, needsUpdate: false };

        assert.equal(requestPrimaryShadowMapRefresh(shadowMap, true, 4), 5);
        assert.deepEqual(shadowMap, {
            enabled: true,
            needsUpdate: true,
        });
    });

    it('does not touch or count the primary map while shadows are disabled', () => {
        const shadowMap = { enabled: false, needsUpdate: false };

        assert.equal(requestPrimaryShadowMapRefresh(shadowMap, false, 4), 4);
        assert.deepEqual(shadowMap, {
            enabled: false,
            needsUpdate: false,
        });
    });
});

function createStack({
    blockId = 'optimistic',
    blockName = 'Tree',
    rotation = 1,
    variant = 2,
    x = 4,
}: {
    blockId?: string;
    blockName?: string;
    rotation?: number;
    variant?: number | null;
    x?: number;
} = {}): Stack {
    return {
        blocks: [
            {
                id: blockId,
                name: blockName,
                rotation,
                variant,
            },
        ],
        position: new Vector3(x, 0, -3),
    };
}

describe('buildGardenShadowGeometrySignature', () => {
    it('ignores optimistic-to-persisted id replacement and stack order', () => {
        const optimistic = createStack();
        const persisted = createStack({ blockId: 'persisted' });
        const other = createStack({ blockId: 'other', x: 8 });

        assert.equal(
            buildGardenShadowGeometrySignature([optimistic, other]),
            buildGardenShadowGeometrySignature([other, persisted]),
        );
    });

    it('changes for geometry-affecting stack and block changes', () => {
        const signature = buildGardenShadowGeometrySignature([createStack()]);
        const changes = [
            createStack({ x: 5 }),
            createStack({ blockName: 'Pine' }),
            createStack({ rotation: 2 }),
            createStack({ variant: 3 }),
        ];

        for (const changedStack of changes) {
            assert.notEqual(
                buildGardenShadowGeometrySignature([changedStack]),
                signature,
            );
        }
        assert.notEqual(
            buildGardenShadowGeometrySignature([
                {
                    ...createStack(),
                    blocks: [
                        ...createStack().blocks,
                        {
                            id: 'second',
                            name: 'StoneSmall',
                            rotation: 0,
                        },
                    ],
                },
            ]),
            signature,
        );
    });
});

describe('deferred placement shadow refresh scheduling', () => {
    it('defers simultaneous garden-bounds invalidation and geometry changes until completion', () => {
        let state = createDeferredShadowRefreshState();
        const placementStarted = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 1,
            forceDirty: true,
            geometryChanged: true,
        });
        state = placementStarted.state;

        assert.equal(placementStarted.shouldInvalidate, false);
        assert.equal(consumeDeferredShadowRefresh(state).shouldRefresh, false);

        const placementCompleted = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 0,
        });
        const consumption = consumeDeferredShadowRefresh(
            placementCompleted.state,
        );

        assert.equal(placementCompleted.shouldInvalidate, true);
        assert.equal(consumption.shouldRefresh, true);
        assert.equal(consumption.placementFlush, true);
        assert.equal(
            consumeDeferredShadowRefresh(consumption.state).shouldRefresh,
            false,
        );
    });

    it('coalesces overlapping placements into one final flush', () => {
        let state = createDeferredShadowRefreshState();
        let invalidationCount = 0;
        let deferredChangeCount = 0;

        for (const activePlacementCount of [1, 2, 1, 0]) {
            const transition = transitionDeferredShadowRefresh(state, {
                activePlacementCount,
                geometryChanged: activePlacementCount === 2,
            });
            state = transition.state;
            invalidationCount += Number(transition.shouldInvalidate);
            deferredChangeCount += transition.deferredChangeCountDelta;

            const consumption = consumeDeferredShadowRefresh(state);
            if (activePlacementCount > 0) {
                assert.equal(consumption.shouldRefresh, false);
            } else {
                assert.equal(consumption.shouldRefresh, true);
                assert.equal(consumption.placementFlush, true);
                state = consumption.state;
            }
        }

        assert.equal(invalidationCount, 1);
        assert.equal(deferredChangeCount, 2);
        assert.equal(consumeDeferredShadowRefresh(state).shouldRefresh, false);
    });

    it('keeps a queued flush deferred if a new placement starts first', () => {
        let state = createDeferredShadowRefreshState(1);
        const completion = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 0,
        });
        assert.equal(completion.shouldInvalidate, true);
        state = completion.state;

        const restarted = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 1,
        });
        assert.equal(restarted.shouldInvalidate, false);
        assert.equal(
            consumeDeferredShadowRefresh(restarted.state).shouldRefresh,
            false,
        );

        const finalCompletion = transitionDeferredShadowRefresh(
            restarted.state,
            { activePlacementCount: 0 },
        );
        const consumption = consumeDeferredShadowRefresh(finalCompletion.state);
        assert.equal(consumption.shouldRefresh, true);
        assert.equal(consumption.placementFlush, true);
    });

    it('coalesces cancellation rollback geometry before the frame', () => {
        let state = createDeferredShadowRefreshState(1);
        const cancelled = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 0,
        });
        state = cancelled.state;
        const rolledBack = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 0,
            geometryChanged: true,
        });

        assert.equal(cancelled.shouldInvalidate, true);
        assert.equal(rolledBack.shouldInvalidate, true);
        const consumption = consumeDeferredShadowRefresh(rolledBack.state);
        assert.equal(consumption.shouldRefresh, true);
        assert.equal(consumption.placementFlush, true);
        assert.equal(
            consumeDeferredShadowRefresh(consumption.state).shouldRefresh,
            false,
        );
    });

    it('keeps a visually completed placement active until a late rollback joins its final flush', () => {
        let state = createDeferredShadowRefreshState();
        state = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 1,
            geometryChanged: true,
        }).state;

        const visualCompletion = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 1,
        });
        state = visualCompletion.state;
        assert.equal(visualCompletion.shouldInvalidate, false);
        assert.equal(consumeDeferredShadowRefresh(state).shouldRefresh, false);

        const rollback = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 1,
            geometryChanged: true,
        });
        state = rollback.state;
        assert.equal(rollback.shouldInvalidate, false);
        assert.equal(consumeDeferredShadowRefresh(state).shouldRefresh, false);

        const cancellation = transitionDeferredShadowRefresh(state, {
            activePlacementCount: 0,
        });
        const consumption = consumeDeferredShadowRefresh(cancellation.state);

        assert.equal(cancellation.shouldInvalidate, true);
        assert.equal(consumption.shouldRefresh, true);
        assert.equal(consumption.placementFlush, true);
        assert.equal(
            consumeDeferredShadowRefresh(consumption.state).shouldRefresh,
            false,
        );
    });

    it('supports an ordinary coalesced scene refresh without a placement', () => {
        const transitioned = transitionDeferredShadowRefresh(
            createDeferredShadowRefreshState(),
            {
                activePlacementCount: 0,
                forceDirty: true,
            },
        );
        const consumption = consumeDeferredShadowRefresh(transitioned.state);

        assert.equal(transitioned.shouldInvalidate, true);
        assert.equal(consumption.shouldRefresh, true);
        assert.equal(consumption.placementFlush, false);
    });

    it('normalizes invalid active counts', () => {
        assert.deepEqual(createDeferredShadowRefreshState(Number.NaN), {
            activePlacementCount: 0,
            dirty: false,
            placementCyclePending: false,
        });
        assert.deepEqual(createDeferredShadowRefreshState(-2), {
            activePlacementCount: 0,
            dirty: false,
            placementCyclePending: false,
        });
    });
});
