import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canStackBlockOnBlock,
    isBlockPlaceableOnWater,
    isWaterBlockName,
} from './index';

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
