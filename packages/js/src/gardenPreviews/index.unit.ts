import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    gardenPreviewDefaultPhase,
    gardenPreviewPhases,
    isGardenPreviewPhase,
} from './index';

describe('garden preview phases', () => {
    it('keeps day as the compatible default and accepts only stored phases', () => {
        assert.equal(gardenPreviewDefaultPhase, 'day');
        assert.deepEqual(gardenPreviewPhases, ['day', 'night']);
        assert.equal(isGardenPreviewPhase('day'), true);
        assert.equal(isGardenPreviewPhase('night'), true);
        assert.equal(isGardenPreviewPhase('evening'), false);
        assert.equal(isGardenPreviewPhase(undefined), false);
    });
});
