import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getVisualDaylightAmount,
    getVisualNightAmount,
} from './visualDayNight';

function round(value: number) {
    return Number(value.toFixed(6));
}

test('keeps visual daylight through sunset', () => {
    assert.equal(round(getVisualDaylightAmount(0.79)), 1);
    assert.equal(round(getVisualDaylightAmount(0.8)), 1);
    assert.equal(round(getVisualNightAmount(0.8)), 0);
});

test('fades to night after sunset', () => {
    const twilightDaylight = getVisualDaylightAmount(0.84);
    const twilightNight = getVisualNightAmount(0.85);

    assert.ok(twilightDaylight > 0);
    assert.ok(twilightDaylight < 1);
    assert.ok(twilightNight > 0);
    assert.ok(twilightNight < 1);
    assert.equal(round(getVisualDaylightAmount(0.88)), 0);
    assert.equal(round(getVisualNightAmount(0.88)), 1);
});

test('brings in dawn light before sunrise', () => {
    assert.equal(round(getVisualNightAmount(0.14)), 1);
    assert.ok(getVisualDaylightAmount(0.2) > 0.2);
    assert.ok(getVisualNightAmount(0.2) < 0.5);
    assert.equal(round(getVisualNightAmount(0.24)), 0);
});
