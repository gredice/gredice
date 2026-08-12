import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import {
    canStackBlockOnBlock,
    type GardenBlockDataLike,
    isBlockPlaceableOnWater,
    isWaterBlockName,
} from './index';

const nonStackable: GardenBlockDataLike = {
    attributes: { stackable: false },
};

test('recognizes standard and swamp water as water terrain', () => {
    assert.equal(isWaterBlockName('Block_Water'), true);
    assert.equal(isWaterBlockName('Block_Swamp_Water'), true);
    assert.equal(isWaterBlockName('Block_Swamp_Ground'), false);
});

test('lets both water styles stack on water without catalog fallbacks', () => {
    const stackableWater = { attributes: { stackable: true } };

    for (const belowBlockName of ['Block_Water', 'Block_Swamp_Water']) {
        for (const aboveBlockName of ['Block_Water', 'Block_Swamp_Water']) {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: undefined,
                    aboveBlockName,
                    belowBlockData: stackableWater,
                    belowBlockName,
                }),
                true,
            );
        }
    }
});

test('treats swamp water as placeable on water by default', () => {
    assert.equal(
        isBlockPlaceableOnWater({
            blockData: undefined,
            blockName: 'Block_Swamp_Water',
        }),
        true,
    );
});

describe('canStackBlockOnBlock', () => {
    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        it(`allows HazelLightArch on ${walkwayName}`, () => {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: nonStackable,
                    aboveBlockName: 'HazelLightArch',
                    belowBlockData: nonStackable,
                    belowBlockName: walkwayName,
                }),
                true,
            );
        });
    }

    it('keeps other decorations blocked on walkways', () => {
        assert.equal(
            canStackBlockOnBlock({
                aboveBlockData: nonStackable,
                aboveBlockName: 'EnamelGardenLamp',
                belowBlockData: nonStackable,
                belowBlockName: 'StoneWalkway',
            }),
            false,
        );
    });

    it('keeps HazelLightArch blocked on unrelated non-stackable blocks', () => {
        assert.equal(
            canStackBlockOnBlock({
                aboveBlockData: nonStackable,
                aboveBlockName: 'HazelLightArch',
                belowBlockData: nonStackable,
                belowBlockName: 'WaterWell',
            }),
            false,
        );
    });

    for (const swampGroundName of [
        'Block_Swamp_Ground',
        'Block_Swamp_Ground_Angle',
    ]) {
        it(`keeps ordinary decorations stackable on ${swampGroundName}`, () => {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: nonStackable,
                    aboveBlockName: 'EnamelGardenLamp',
                    belowBlockData: { attributes: { stackable: true } },
                    belowBlockName: swampGroundName,
                }),
                true,
            );
        });
    }
});
