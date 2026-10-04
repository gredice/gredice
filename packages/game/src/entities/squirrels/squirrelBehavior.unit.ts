import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getSquirrelBehaviorWeights,
    getSquirrelDwellSeconds,
    getSquirrelMovementRange,
    pickSquirrelRoutineBehavior,
} from './squirrelBehavior';

describe('squirrel behavior selection', () => {
    it('deterministically reaches every authored routine state', () => {
        assert.deepEqual(
            [0, 0.3, 0.5, 0.7, 0.96].map((value) =>
                pickSquirrelRoutineBehavior(() => value),
            ),
            ['scamper', 'bound', 'sit', 'forage', 'pause'],
        );
        assert.equal(
            getSquirrelBehaviorWeights().reduce(
                (total, behavior) => total + behavior.weight,
                0,
            ),
            1,
        );
    });

    it('keeps cautious pauses short and feeding or upright sits readable', () => {
        assert.equal(
            getSquirrelDwellSeconds({ behavior: 'pause', random: () => 0 }),
            1.6,
        );
        assert.equal(
            getSquirrelDwellSeconds({ behavior: 'pause', random: () => 1 }),
            4.4,
        );
        assert.equal(
            getSquirrelDwellSeconds({ behavior: 'sit', random: () => 0 }),
            3,
        );
        assert.equal(
            getSquirrelDwellSeconds({ behavior: 'forage', random: () => 1 }),
            8,
        );
    });

    it('keeps bounds short while permitting wider scampering and flee routes', () => {
        assert.equal(getSquirrelMovementRange('bound'), 1.8);
        assert.equal(getSquirrelMovementRange('scamper'), 4);
        assert.equal(
            getSquirrelMovementRange('flee'),
            Number.POSITIVE_INFINITY,
        );
    });
});
