import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import {
    autumnLeafSummerColor,
    autumnPaletteSeeds,
    getAutumnLeafColor,
} from './autumnPalette';
import { autumnCanopyStops } from './seasonalRoles';

function hue(color: Color) {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return hsl.h;
}

test('canopies pass the bright seasonal roles and keep a warm mix into winter', () => {
    const base = new Color(autumnLeafSummerColor);
    const amberHue = hue(new Color(autumnCanopyStops[1]));
    const redHue = hue(new Color(autumnCanopyStops[3]));
    const ends = autumnPaletteSeeds.map((seed) =>
        getAutumnLeafColor(base, 1, seed),
    );
    // The latest palette ends on autumn red; the others keep amber, orange
    // and orange-red leaves, so winter canopies are not all the same red.
    assert.equal(
        ends[ends.length - 1].getHexString(),
        new Color(autumnCanopyStops[3]).getHexString(),
    );
    for (let index = 1; index < ends.length; index++)
        assert.ok(hue(ends[index]) < hue(ends[index - 1]));
    for (const end of ends) {
        assert.ok(hue(end) <= amberHue + 1e-6);
        assert.ok(hue(end) >= redHue - 1e-6);
    }
    for (const seed of autumnPaletteSeeds)
        assert.equal(
            getAutumnLeafColor(base, 0, seed).getHexString(),
            base.getHexString(),
        );
});

test('loose leaves end between amber and red, not all on one colour', () => {
    const base = new Color(autumnLeafSummerColor);
    const amberHue = hue(new Color(autumnCanopyStops[1]));
    const redHue = hue(new Color(autumnCanopyStops[3]));
    const ends = Array.from({ length: 24 }, (_, index) =>
        getAutumnLeafColor(base, 1, `tree:${index}`),
    );
    for (const end of ends) {
        assert.ok(hue(end) <= amberHue + 1e-6);
        assert.ok(hue(end) >= redHue - 1e-6);
    }
    assert.ok(new Set(ends.map((end) => end.getHexString())).size > 12);
});

test('palette seeds show different autumn hues side by side mid-season', () => {
    const base = new Color(autumnLeafSummerColor);
    const hues = autumnPaletteSeeds.map((seed) => {
        const hsl = { h: 0, s: 0, l: 0 };
        getAutumnLeafColor(base, 0.5, seed).getHSL(hsl);
        return hsl.h;
    });
    // Gold lags and russet leads, so hue falls from gold toward red.
    for (let index = 1; index < hues.length; index++)
        assert.ok(hues[index] < hues[index - 1]);
    assert.ok(hues[0] - hues[hues.length - 1] > 0.03);
});

test('a canopy never turns back toward green as autumn advances', () => {
    const base = new Color(autumnLeafSummerColor);
    for (const seed of autumnPaletteSeeds) {
        let previous = Number.POSITIVE_INFINITY;
        for (let step = 1; step <= 20; step++) {
            const hsl = { h: 0, s: 0, l: 0 };
            getAutumnLeafColor(base, step / 20, seed).getHSL(hsl);
            assert.ok(hsl.h <= previous + 1e-6);
            previous = hsl.h;
        }
    }
});
