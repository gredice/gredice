import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPointWithinClientRect } from './itemsHudDropTarget';

describe('isPointWithinClientRect', () => {
    const rect = {
        bottom: 80,
        left: 10,
        right: 110,
        top: 20,
    };

    it('accepts mouse or touch client coordinates inside the rect', () => {
        assert.equal(isPointWithinClientRect(rect, 10, 20), true);
        assert.equal(isPointWithinClientRect(rect, 60, 50), true);
        assert.equal(isPointWithinClientRect(rect, 110, 80), true);
    });

    it('rejects coordinates outside the rect', () => {
        assert.equal(isPointWithinClientRect(rect, 9, 50), false);
        assert.equal(isPointWithinClientRect(rect, 60, 19), false);
        assert.equal(isPointWithinClientRect(rect, 111, 50), false);
        assert.equal(isPointWithinClientRect(rect, 60, 81), false);
    });
});
