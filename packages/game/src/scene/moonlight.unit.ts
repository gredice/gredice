import assert from 'node:assert/strict';
import test from 'node:test';
import { getNightAmount, resolveMoonlitNightScales } from './moonlight';

function round(value: number) {
    return Number(value.toFixed(6));
}

test('moonlit night scales darken low-moon nights', () => {
    const moonless = resolveMoonlitNightScales({
        moonlight: 0,
        timeOfDay: 0,
    });
    const fullMoon = resolveMoonlitNightScales({
        moonlight: 1,
        timeOfDay: 0,
    });

    assert.ok(moonless.lightScale < fullMoon.lightScale);
    assert.ok(moonless.skyScale < fullMoon.skyScale);
    assert.equal(round(fullMoon.lightScale), 1);
    assert.equal(round(fullMoon.skyScale), 1);
});

test('moonlit night scales leave daylight unchanged', () => {
    const moonlessDay = resolveMoonlitNightScales({
        moonlight: 0,
        timeOfDay: 0.5,
    });
    const fullMoonDay = resolveMoonlitNightScales({
        moonlight: 1,
        timeOfDay: 0.5,
    });

    assert.equal(round(moonlessDay.lightScale), 1);
    assert.equal(round(moonlessDay.skyScale), 1);
    assert.equal(round(fullMoonDay.lightScale), 1);
    assert.equal(round(fullMoonDay.skyScale), 1);
});

test('night amount blends through dusk', () => {
    assert.equal(round(getNightAmount(0.75)), 0);
    assert.equal(round(getNightAmount(0.8)), 1);

    const twilight = getNightAmount(0.775);
    assert.ok(twilight > 0);
    assert.ok(twilight < 1);
});

test('moonlit night scales clamp moonlight input', () => {
    const belowRange = resolveMoonlitNightScales({
        moonlight: -1,
        timeOfDay: 0,
    });
    const zero = resolveMoonlitNightScales({
        moonlight: 0,
        timeOfDay: 0,
    });
    const aboveRange = resolveMoonlitNightScales({
        moonlight: 2,
        timeOfDay: 0,
    });
    const one = resolveMoonlitNightScales({
        moonlight: 1,
        timeOfDay: 0,
    });

    assert.equal(round(belowRange.lightScale), round(zero.lightScale));
    assert.equal(round(aboveRange.lightScale), round(one.lightScale));
});
