import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePlacementFootprintIndicatorPositions } from './PlacementFootprintIndicator';

describe('resolvePlacementFootprintIndicatorPositions', () => {
    it('covers every cell in a multi-cell block footprint', () => {
        assert.deepEqual(
            resolvePlacementFootprintIndicatorPositions({
                attributes: { spanDepth: 2, spanWidth: 1 },
            }),
            [
                [0, 0, 0],
                [0, 0, 1],
            ],
        );
    });

    it('rotates the indicator footprint with the block', () => {
        assert.deepEqual(
            resolvePlacementFootprintIndicatorPositions(
                { attributes: { spanDepth: 2, spanWidth: 1 } },
                1,
            ),
            [
                [0, 0, 0],
                [1, 0, 0],
            ],
        );
    });
});
