import assert from 'node:assert/strict';
import test from 'node:test';
import { getMoonVisualPhase, moonBrightLimbScreenAngle } from './moonPhase';

function radiansToDegrees(radians: number) {
    return (radians * 180) / Math.PI;
}

function round(value: number) {
    return Number(value.toFixed(3));
}

test('converts the observer-relative bright limb angle to screen coordinates', () => {
    const angle = moonBrightLimbScreenAngle({
        illuminationAngle: 30,
        parallacticAngle: -15,
    });

    assert.equal(round(radiansToDegrees(angle)), 135);
});

test('keeps lunar phase date-based but tilts the crescent by observer position', () => {
    const date = new Date('2026-07-03T21:00:00.000Z');
    const zagreb = getMoonVisualPhase(date, { lat: 45.739, lon: 16.572 });
    const sydney = getMoonVisualPhase(date, {
        lat: -33.8688,
        lon: 151.2093,
    });

    assert.equal(round(zagreb.phase), round(sydney.phase));
    assert.equal(round(radiansToDegrees(zagreb.brightLimbAngle)), 203.087);
    assert.equal(round(radiansToDegrees(sydney.brightLimbAngle)), 39.287);
});
