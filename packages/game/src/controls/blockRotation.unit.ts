import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRotatePlacedBlock } from './blockRotation';

test('keeps multi-cell entity footprints locked after placement', () => {
    assert.equal(canRotatePlacedBlock('Cow'), false);
    assert.equal(canRotatePlacedBlock('FishingBoat'), false);
    assert.equal(canRotatePlacedBlock('Horse'), false);
    assert.equal(canRotatePlacedBlock('Raised_Bed'), false);
    assert.equal(canRotatePlacedBlock('WoodenBench'), true);
});
