import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getWaterBlockStyle,
    isWaterBlockName,
    waterBlockNames,
} from './waterBlockNames';

describe('water block names', () => {
    it('classifies standard and swamp water as water', () => {
        assert.deepEqual(waterBlockNames, ['Block_Water', 'Block_Swamp_Water']);
        assert.equal(isWaterBlockName('Block_Water'), true);
        assert.equal(isWaterBlockName('Block_Swamp_Water'), true);
        assert.equal(isWaterBlockName('Block_Grass'), false);
    });

    it('keeps the two water palettes in separate styles', () => {
        assert.equal(getWaterBlockStyle('Block_Water'), 'standard');
        assert.equal(getWaterBlockStyle('Block_Swamp_Water'), 'swamp');
        assert.equal(getWaterBlockStyle('Block_Grass'), null);
    });
});
