import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Group, Vector3 } from 'three';
import { readFaunaTrajectoryWorldScale } from '../../../tests/faunaTrajectoryState';

describe('actual fauna trajectory world-scale observation', () => {
    it('records authored zero scale before a newborn receives its first step', () => {
        const scope = new Group();
        const actor = new Group();
        scope.add(actor);
        actor.scale.setScalar(0);
        const observed = new Vector3();
        // Three r186's decomposition fallback cannot observe this scale.
        assert.deepEqual(actor.getWorldScale(observed).toArray(), [1, 1, 1]);
        assert.deepEqual(
            readFaunaTrajectoryWorldScale(actor, observed).toArray(),
            [0, 0, 0],
        );
    });

    it('retains ordinary rotated, scaled and reflected world-scale semantics', () => {
        const scope = new Group();
        const actor = new Group();
        scope.add(actor);
        scope.rotation.set(0.2, 0.8, -0.4);
        scope.scale.setScalar(2);
        actor.rotation.set(0.5, -0.6, 0.3);
        actor.scale.set(-0.2, 0.3, 0.4);
        const expected = actor.getWorldScale(new Vector3());
        const observed = readFaunaTrajectoryWorldScale(actor, new Vector3());
        assert.ok(observed.distanceTo(expected) < 1e-14);
    });
});
