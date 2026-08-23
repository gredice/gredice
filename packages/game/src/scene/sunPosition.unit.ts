import assert from 'node:assert/strict';
import test from 'node:test';
import { altAzToScenePosition, timeOfDayToDate } from './sunPosition';

function round(value: number) {
    return Number(value.toFixed(6));
}

test('maps the SunCalc v2 day arc upward before noon and downward after noon', () => {
    const sunrise = altAzToScenePosition(6.9, 63.9);
    const morning = altAzToScenePosition(26.8, 83.8);
    const noon = altAzToScenePosition(64.4, 147.8);
    const afternoon = altAzToScenePosition(46.9, 253.8);
    const sunset = altAzToScenePosition(6.3, 296.8);

    assert.ok(morning.y > sunrise.y);
    assert.ok(noon.y > morning.y);
    assert.ok(noon.y > afternoon.y);
    assert.ok(afternoon.y > sunset.y);
});

test('keeps south-facing sun above east and west horizon positions', () => {
    const east = altAzToScenePosition(0, 90);
    const south = altAzToScenePosition(60, 180);
    const west = altAzToScenePosition(0, 270);

    assert.ok(south.y > east.y);
    assert.ok(south.y > west.y);
    assert.equal(round(east.y), round(west.y));
});

test('creates a scene date on the same local day for the normalized game time', () => {
    const date = timeOfDayToDate(new Date(2026, 6, 3, 18, 49, 0), 0.75);

    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 6);
    assert.equal(date.getDate(), 3);
    assert.equal(date.getHours(), 18);
    assert.equal(date.getMinutes(), 0);
});
