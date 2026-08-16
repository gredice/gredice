import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canStackBlockOnBlock } from '@gredice/js/gardenBlocks';

describe('garden surface cover placement', () => {
    it('allows decorations on every mulch and wooden-path surface', () => {
        for (const belowBlockName of [
            'MulchCoconut',
            'MulchHey',
            'MulchWood',
            'StoneWalkway',
            'WoodenWalkway',
        ]) {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: { attributes: { stackable: false } },
                    aboveBlockName: 'IceCreamCart',
                    belowBlockData: { attributes: { stackable: false } },
                    belowBlockName,
                }),
                true,
            );
        }
    });

    it('keeps unrelated non-stackable decorations blocked', () => {
        assert.equal(
            canStackBlockOnBlock({
                aboveBlockData: { attributes: { stackable: false } },
                aboveBlockName: 'IceCreamCart',
                belowBlockData: { attributes: { stackable: false } },
                belowBlockName: 'WaterWell',
            }),
            false,
        );
    });
});
