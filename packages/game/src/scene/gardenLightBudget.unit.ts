import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    resolveGardenLightBudget,
    selectActiveGardenLightKeys,
} from './gardenLightBudget';

describe('resolveGardenLightBudget', () => {
    it('keeps bounded light counts across quality tiers', () => {
        assert.equal(resolveGardenLightBudget('low'), 2);
        assert.equal(resolveGardenLightBudget('auto-constrained'), 2);
        assert.equal(resolveGardenLightBudget('medium'), 4);
        assert.equal(resolveGardenLightBudget('custom'), 4);
        assert.equal(resolveGardenLightBudget('high'), 6);
    });
});

describe('selectActiveGardenLightKeys', () => {
    it('selects the lights closest to the projected viewport center', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        { key: 'edge', x: 0.9, y: 0.8, z: 0 },
                        { key: 'center', x: 0.05, y: 0.05, z: 0 },
                        { key: 'middle', x: 0.4, y: 0.2, z: 0 },
                    ],
                    2,
                ),
            ],
            ['center', 'middle'],
        );
    });

    it('excludes offscreen and clipped lights from the physical budget', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        { key: 'onscreen', x: 0, y: 0, z: 0 },
                        { key: 'offscreen', x: 1.21, y: 0, z: 0 },
                        { key: 'behind', x: 0, y: 0, z: 1.01 },
                    ],
                    3,
                ),
            ],
            ['onscreen'],
        );
    });

    it('uses stable keys to break equal projected-distance ties', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        { key: 'z-light', x: 0.25, y: 0.25, z: 0 },
                        { key: 'a-light', x: -0.25, y: -0.25, z: 0 },
                    ],
                    1,
                ),
            ],
            ['a-light'],
        );
    });
});
