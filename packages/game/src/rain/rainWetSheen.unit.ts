import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { weatherRoleSets } from '../scene/weather/weatherRoles';
import {
    getRainWetSheenColorUniform,
    rainWetLook,
    resolveRainWetSheenColor,
    setRainWetSheenColor,
} from './rainWetSheen';

test('the wet look only lifts: saturation, lower roughness and a 7% sheen', () => {
    assert.deepEqual(rainWetLook, {
        saturation: 0.22,
        roughness: 0.26,
        sheen: 0.07,
    });
});

test('the sheen sits between the puddle roles and follows the time of day', () => {
    const night = resolveRainWetSheenColor(
        new Color(weatherRoleSets.night.puddleDeep),
        new Color(weatherRoleSets.night.puddleLight),
    );
    const midday = resolveRainWetSheenColor(
        new Color(weatherRoleSets.midday.puddleDeep),
        new Color(weatherRoleSets.midday.puddleLight),
    );
    // Calmer at night than the pale puddle light, so a dim garden is not
    // washed out.
    const light = new Color(weatherRoleSets.night.puddleLight);
    assert.ok(night.r < light.r && night.g < light.g);
    // Blue at midday, never white.
    assert.ok(midday.b > midday.r);
    assert.equal(getRainWetSheenColorUniform().value.equals(midday), true);
    assert.equal(setRainWetSheenColor(midday), false);
    assert.equal(setRainWetSheenColor(night), true);
    assert.equal(getRainWetSheenColorUniform().value.equals(night), true);
    setRainWetSheenColor(midday);
});
