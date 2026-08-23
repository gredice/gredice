import assert from 'node:assert/strict';
import test from 'node:test';
import { rainFragmentShader } from './rainShaders';

test('uses one analytic rain streak without fragment loops', () => {
    assert.doesNotMatch(rainFragmentShader, /\b(?:for|while)\s*\(/);
    assert.doesNotMatch(rainFragmentShader, /sdUnevenCapsule|\bblur\s*\(/);
    assert.match(rainFragmentShader, /rainStreakMask\(vUv\)/);
});

test('preserves precipitation and field fades around the analytic streak', () => {
    assert.match(rainFragmentShader, /uRainProgress/);
    assert.match(rainFragmentShader, /fieldFade/);
    assert.match(rainFragmentShader, /verticalFade/);
    assert.match(rainFragmentShader, /vRainAlpha/);
    assert.match(rainFragmentShader, /alpha < 0\.002/);
});
