import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    calculateRaisedBedsOrientation,
    calculateRaisedBedsValidity,
} from './raisedBedsService';

describe('calculateRaisedBedsValidity', () => {
    it('requires one referenced raised-bed block to be placed', () => {
        const validity = calculateRaisedBedsValidity(
            [
                { id: 1, blockId: 'bed-a' },
                { id: 2, blockId: 'missing' },
            ],
            [{ positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] }],
            new Map([
                ['grass-a', 'Block_Grass'],
                ['bed-a', 'Raised_Bed'],
                ['missing', 'Raised_Bed'],
            ]),
        );

        assert.equal(validity.get(1), true);
        assert.equal(validity.get(2), false);
    });
});

describe('calculateRaisedBedsOrientation', () => {
    it('derives the field orientation from the single block rotation', () => {
        const orientations = calculateRaisedBedsOrientation(
            [
                { id: 1, blockId: 'horizontal' },
                { id: 2, blockId: 'vertical' },
            ],
            new Map([
                ['horizontal', 0],
                ['vertical', 1],
            ]),
        );

        assert.equal(orientations.get(1), 'horizontal');
        assert.equal(orientations.get(2), 'vertical');
    });
});
