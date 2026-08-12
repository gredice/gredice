import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateStackPlacement } from './stacksPatchValidation';

const blockDataByName = new Map([
    ['Block_Grass', { attributes: { stackable: true, height: 1 } }],
    [
        'Block_Water',
        {
            attributes: {
                stackable: true,
                height: 1,
                placeableOnWater: true,
            },
        },
    ],
    [
        'SmallWoodenBridge',
        {
            attributes: {
                stackable: false,
                height: 0.38,
                placeableOnWater: true,
            },
        },
    ],
    [
        'FishingBoat',
        {
            attributes: {
                stackable: false,
                height: 0.62,
                placeableOnWater: true,
            },
        },
    ],
    ['Tree', { attributes: { stackable: true, height: 1 } }],
    ['HazelLightArch', { attributes: { stackable: false, height: 1.65 } }],
    ['StoneWalkway', { attributes: { stackable: false, height: 0.1 } }],
    ['WoodenWalkway', { attributes: { stackable: false, height: 0.1 } }],
]);

describe('validateStackPlacement', () => {
    it('blocks non-water blocks directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'tree-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['tree-a', 'Tree'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, {
            valid: false,
            error: 'Invalid stack placement: block water-a cannot support block tree-a',
        });
    });

    it('allows water blocks directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'water-b'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['water-b', 'Block_Water'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, { valid: true });
    });

    it('allows the small wooden bridge directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'bridge-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['bridge-a', 'SmallWoodenBridge'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, { valid: true });
    });

    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        it(`allows HazelLightArch directly above ${walkwayName}`, () => {
            const validation = validateStackPlacement({
                blockIds: ['walkway-a', 'arch-a'],
                blockNameById: new Map([
                    ['walkway-a', walkwayName],
                    ['arch-a', 'HazelLightArch'],
                ]),
                blockDataByName,
            });

            assert.deepEqual(validation, { valid: true });
        });
    }

    it('requires the fishing boat to have water or swamp support', () => {
        const unsupported = validateStackPlacement({
            blockIds: ['boat-a'],
            blockNameById: new Map([['boat-a', 'FishingBoat']]),
            blockDataByName,
        });
        const onLand = validateStackPlacement({
            blockIds: ['grass-a', 'boat-a'],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['boat-a', 'FishingBoat'],
            ]),
            blockDataByName,
        });
        const onWater = validateStackPlacement({
            blockIds: ['water-a', 'boat-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['boat-a', 'FishingBoat'],
            ]),
            blockDataByName,
        });

        assert.equal(unsupported.valid, false);
        assert.equal(onLand.valid, false);
        assert.deepEqual(onWater, { valid: true });
    });
});
