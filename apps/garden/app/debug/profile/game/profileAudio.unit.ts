import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGameProfileLeafWind } from './profileAudio.ts';

test('leaf audio wind presets are explicit and unknown values keep existing weather', () => {
    assert.equal(resolveGameProfileLeafWind('calm'), 0);
    assert.equal(resolveGameProfileLeafWind('light'), 0.7);
    assert.equal(resolveGameProfileLeafWind('strong'), 2.4);
    assert.equal(resolveGameProfileLeafWind(undefined), undefined);
    assert.equal(resolveGameProfileLeafWind('invalid'), undefined);
});
