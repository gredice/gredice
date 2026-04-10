import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveGardenBlockPlacement } from './blockPlacementService';

const blockDataByName = new Map([
    ['Block_Grass', { attributes: { stackable: true, height: 1 } }],
    ['Raised_Bed', { attributes: { stackable: true, height: 1 } }],
    ['Shade', { attributes: { stackable: false, height: 1 } }],
]);

describe('resolveGardenBlockPlacement', () => {
    it('skips invalid raised-bed positions near origin and finds the first valid slot', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
                { positionX: 1, positionY: 0, blocks: ['grass-b', 'bed-b'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['bed-a', 'Raised_Bed'],
                ['bed-b', 'Raised_Bed'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: -1,
                y: 1,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('rejects explicitly requested raised-bed positions that the backend would not allow', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            requestedPosition: { x: 0, y: -1 },
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
                { positionX: 1, positionY: 0, blocks: ['grass-b', 'bed-b'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['bed-a', 'Raised_Bed'],
                ['bed-b', 'Raised_Bed'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid raised bed placement: cannot place next to an already attached raised bed',
        });
    });

    it('rejects placing ground blocks on non-empty stacks', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Block_Grass',
            requestedPosition: { x: 0, y: 0 },
            stacks: [{ positionX: 0, positionY: 0, blocks: ['shade-a'] }],
            blockNameById: new Map([['shade-a', 'Shade']]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: ground blocks can only be placed on empty stacks',
        });
    });
});
