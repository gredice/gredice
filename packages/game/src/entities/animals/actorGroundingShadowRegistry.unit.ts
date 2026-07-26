import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    ActorGroundingShadowRegistry,
    type ActorGroundingShadowState,
    actorGroundingShadowProfiles,
    actorGroundingShadowSnowLift,
    resolveActorGroundingShadow,
} from './actorGroundingShadowRegistry';

const groundedState: ActorGroundingShadowState = {
    actorY: 0.2,
    receiverY: 0.2,
    visible: true,
    x: 3,
    yaw: 0.4,
    z: -2,
};

describe('actor grounding-shadow projection', () => {
    it('keeps grounded actors at their species footprint and opacity', () => {
        const resolved = resolveActorGroundingShadow({
            snowCoverage: 0,
            species: 'cat',
            state: groundedState,
        });
        const profile = actorGroundingShadowProfiles.cat;

        assert.equal(resolved.visible, true);
        assert.equal(resolved.halfLength, profile.baseHalfLength);
        assert.equal(resolved.halfWidth, profile.baseHalfWidth);
        assert.equal(resolved.opacity, profile.baseOpacity);
        assert.equal(resolved.x, groundedState.x);
        assert.equal(resolved.z, groundedState.z);
    });

    it('grows and quadratically fades a flying actor footprint', () => {
        const profile = actorGroundingShadowProfiles.bird;
        const resolved = resolveActorGroundingShadow({
            snowCoverage: 0,
            species: 'bird',
            state: {
                ...groundedState,
                actorY: groundedState.receiverY + profile.cutoffHeight / 2,
            },
        });
        const expectedScale = 1 + (profile.maxFootprintScale - 1) / 2;

        assert.equal(resolved.visible, true);
        assert.equal(
            resolved.halfLength,
            profile.baseHalfLength * expectedScale,
        );
        assert.equal(resolved.halfWidth, profile.baseHalfWidth * expectedScale);
        assert.equal(resolved.opacity, profile.baseOpacity * 0.25);
    });

    it('cuts the projection off at the species flight height', () => {
        const profile = actorGroundingShadowProfiles.bee;
        const resolved = resolveActorGroundingShadow({
            snowCoverage: 0,
            species: 'bee',
            state: {
                ...groundedState,
                actorY: groundedState.receiverY + profile.cutoffHeight,
            },
        });

        assert.equal(resolved.visible, false);
        assert.equal(resolved.opacity, 0);
    });

    it('lifts the receiver plane slightly as snow accumulates', () => {
        const clear = resolveActorGroundingShadow({
            snowCoverage: 0,
            species: 'dog',
            state: groundedState,
        });
        const snow = resolveActorGroundingShadow({
            snowCoverage: 1,
            species: 'dog',
            state: groundedState,
        });

        assert.ok(
            Math.abs(snow.y - clear.y - actorGroundingShadowSnowLift) <
                Number.EPSILON,
        );
    });

    it('returns finite hidden values for invalid transforms and snow', () => {
        const resolved = resolveActorGroundingShadow({
            snowCoverage: Number.POSITIVE_INFINITY,
            species: 'cat',
            state: {
                actorY: Number.NaN,
                receiverY: Number.NEGATIVE_INFINITY,
                visible: true,
                x: Number.POSITIVE_INFINITY,
                yaw: Number.NaN,
                z: Number.NEGATIVE_INFINITY,
            },
        });

        assert.equal(resolved.visible, false);
        for (const value of Object.values(resolved)) {
            if (typeof value === 'number') {
                assert.equal(Number.isFinite(value), true);
            }
        }
    });
});

describe('ActorGroundingShadowRegistry', () => {
    it('keeps live slots stable and reuses a released slot', () => {
        const registry = new ActorGroundingShadowRegistry(3);
        const cat = registry.register({
            id: 'cat:a',
            primaryCasterCount: 7,
            species: 'cat',
        });
        const dog = registry.register({
            id: 'dog:b',
            primaryCasterCount: 9,
            species: 'dog',
        });

        assert.equal(cat.slot, 0);
        assert.equal(dog.slot, 1);
        registry.update('dog:b', groundedState);
        assert.equal(
            registry.getEntries().find((entry) => entry.id === 'dog:b')?.slot,
            1,
        );

        cat.unregister();
        const bird = registry.register({
            id: 'bird:c',
            primaryCasterCount: 4,
            species: 'bird',
        });

        assert.equal(bird.slot, 0);
        assert.equal(
            registry.getEntries().find((entry) => entry.id === 'dog:b')?.slot,
            1,
        );
        assert.deepEqual(registry.getStats(), {
            capacity: 3,
            droppedCount: 0,
            primaryCasterCount: 13,
            registeredCount: 2,
            updateCount: 1,
        });
    });

    it('does not dirty the batch for equivalent or unknown updates', () => {
        const registry = new ActorGroundingShadowRegistry(1);
        registry.register({
            id: 'cat:a',
            primaryCasterCount: 0,
            species: 'cat',
        });
        const registeredVersion = registry.getVersion();

        assert.equal(registry.update('cat:a', groundedState), true);
        assert.equal(registry.getVersion(), registeredVersion + 1);
        assert.equal(registry.update('cat:a', { ...groundedState }), false);
        assert.equal(registry.update('missing', groundedState), false);
        assert.equal(registry.getVersion(), registeredVersion + 1);
        assert.equal(registry.getStats().updateCount, 1);
    });

    it('drops overflow registrations without crashing the scene', () => {
        const registry = new ActorGroundingShadowRegistry(1);
        const cat = registry.register({
            id: 'cat:a',
            primaryCasterCount: 0,
            species: 'cat',
        });
        const dog = registry.register({
            id: 'dog:b',
            primaryCasterCount: 0,
            species: 'dog',
        });

        assert.equal(cat.slot, 0);
        assert.equal(dog.slot, null);
        assert.equal(registry.update('dog:b', groundedState), false);
        assert.deepEqual(registry.getStats(), {
            capacity: 1,
            droppedCount: 1,
            primaryCasterCount: 0,
            registeredCount: 1,
            updateCount: 0,
        });

        dog.unregister();
        cat.unregister();
        assert.deepEqual(registry.getStats(), {
            capacity: 1,
            droppedCount: 0,
            primaryCasterCount: 0,
            registeredCount: 0,
            updateCount: 0,
        });
    });
});
