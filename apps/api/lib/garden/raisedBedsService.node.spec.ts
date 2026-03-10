import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    calculateRaisedBedsOrientation,
    calculateRaisedBedsValidity,
} from './raisedBedsService';

describe('calculateRaisedBedsValidity', () => {
    it('ignores adjacent non-raised-bed blocks when validating a merged bed', () => {
        const blockNameById = new Map([
            ['grass-a', 'Block_Grass'],
            ['grass-b', 'Block_Grass'],
            ['grass-c', 'Block_Grass'],
            ['bed-a', 'Raised_Bed'],
            ['bed-b', 'Raised_Bed'],
            ['shade-a', 'Shade'],
        ]);
        const raisedBeds = [{ id: 1, blockId: 'bed-a' }];
        const stacks = [
            { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
            { positionX: 0, positionY: 1, blocks: ['grass-b', 'bed-b'] },
            { positionX: 1, positionY: 0, blocks: ['grass-c', 'shade-a'] },
        ];

        const validity = calculateRaisedBedsValidity(
            raisedBeds,
            stacks,
            blockNameById,
        );

        assert.strictEqual(validity.get(1), true);
    });
});

describe('calculateRaisedBedsOrientation', () => {
    it('derives orientation only from adjacent raised-bed blocks', () => {
        const blockNameById = new Map([
            ['grass-a', 'Block_Grass'],
            ['grass-b', 'Block_Grass'],
            ['grass-c', 'Block_Grass'],
            ['bed-a', 'Raised_Bed'],
            ['bed-b', 'Raised_Bed'],
            ['shade-a', 'Shade'],
        ]);
        const raisedBeds = [{ id: 1, blockId: 'bed-a' }];
        const stacks = [
            { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
            { positionX: 0, positionY: 1, blocks: ['grass-b', 'bed-b'] },
            { positionX: 1, positionY: 0, blocks: ['grass-c', 'shade-a'] },
        ];

        const orientations = calculateRaisedBedsOrientation(
            raisedBeds,
            stacks,
            blockNameById,
        );

        assert.strictEqual(orientations.get(1), 'horizontal');
    });
});
