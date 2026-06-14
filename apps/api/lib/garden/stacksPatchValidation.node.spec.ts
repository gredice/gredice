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
    ['Tree', { attributes: { stackable: true, height: 1 } }],
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
});
