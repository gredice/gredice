import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Group, Vector3 } from 'three';
import { initializeAnimalAtHome } from './animalRuntimeLifecycle';

describe('animal runtime lifecycle', () => {
    it('places an animal at home before its runtime starts', () => {
        const actor = new Group();
        actor.position.set(8, 4, -2);
        actor.rotation.y = 0.25;

        assert.equal(
            initializeAnimalAtHome({
                actor,
                home: {
                    facingYaw: 1.5,
                    position: new Vector3(2, 0.5, 3),
                },
                runtimeInitialized: false,
            }),
            true,
        );
        assert.deepEqual(actor.position.toArray(), [2, 0.5, 3]);
        assert.equal(actor.rotation.y, 1.5);
    });

    it('preserves an active animal when garden changes recreate its habitat', () => {
        const actor = new Group();
        actor.position.set(8, 0.5, -2);
        actor.rotation.y = 0.25;

        assert.equal(
            initializeAnimalAtHome({
                actor,
                home: {
                    facingYaw: 1.5,
                    position: new Vector3(2, 0.5, 3),
                },
                runtimeInitialized: true,
            }),
            false,
        );
        assert.deepEqual(actor.position.toArray(), [8, 0.5, -2]);
        assert.equal(actor.rotation.y, 0.25);
    });
});
