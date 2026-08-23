import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRotatePlacedBlock } from './blockRotation';

test('keeps the fishing boat footprint locked after placement', () => {
    assert.equal(canRotatePlacedBlock('FishingBoat'), false);
    assert.equal(canRotatePlacedBlock('WoodenBench'), true);
});
