import assert from 'node:assert/strict';
import test from 'node:test';
import * as SunCalc from 'suncalc';
import {
    getSolarEclipseState,
    getSolarEclipseVisualScales,
} from './solarEclipse';

const zagreb = { lat: 45.815, lon: 15.9819 };

function eclipseAt(isoDate: string) {
    return getSolarEclipseState(new Date(isoDate), zagreb);
}

function assertClose(actual: number, expected: number, tolerance = 0.000_001) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual.toString()} to be within ${tolerance.toString()} of ${expected.toString()}`,
    );
}

test('resolves the 2026 Zagreb eclipse from first contact until local sunset', () => {
    const beforeContact = eclipseAt('2026-08-12T17:25:00.000Z');
    const firstContact = eclipseAt('2026-08-12T17:26:30.000Z');
    const latePartial = eclipseAt('2026-08-12T17:55:00.000Z');

    assert.equal(beforeContact.obscuration, 0);
    assert.ok(firstContact.obscuration > 0);
    assert.ok(firstContact.obscuration < 0.01);
    assert.ok(latePartial.obscuration > 0.45);
    assert.ok(latePartial.obscuration < 0.51);
    assert.ok(latePartial.angularSeparation > 0);
    assert.ok(Number.isFinite(latePartial.moonPosition.altitude));
    assert.ok(Number.isFinite(latePartial.sunPosition.azimuth));
    assertClose(latePartial.sunAngularRadius, 0.004_653_048);
    assert.ok(latePartial.moonAngularRadius > latePartial.sunAngularRadius);

    const sunset = SunCalc.getTimes(
        new Date('2026-08-12T12:00:00.000Z'),
        zagreb.lat,
        zagreb.lon,
    ).sunset;
    assert.ok(sunset);

    const atSunset = getSolarEclipseState(sunset, zagreb);
    const afterSunset = getSolarEclipseState(
        new Date(sunset.getTime() + 1),
        zagreb,
    );

    assert.ok(atSunset.obscuration > 0.75);
    assert.ok(atSunset.obscuration < 0.8);
    assert.equal(afterSunset.obscuration, 0);
});

test('predicts later partial eclipses in Zagreb without a hard-coded event list', () => {
    const eclipse2027 = eclipseAt('2027-08-02T09:19:00.000Z');
    const eclipse2034 = eclipseAt('2034-03-20T10:40:00.000Z');

    assertClose(eclipse2027.obscuration, 0.544, 0.02);
    assert.ok(
        eclipse2027.obscuration >
            eclipseAt('2027-08-02T08:19:00.000Z').obscuration,
    );
    assert.ok(
        eclipse2027.obscuration >
            eclipseAt('2027-08-02T10:19:00.000Z').obscuration,
    );

    assertClose(eclipse2034.obscuration, 0.129, 0.02);
    assert.ok(
        eclipse2034.obscuration >
            eclipseAt('2034-03-20T10:10:00.000Z').obscuration,
    );
    assert.ok(
        eclipse2034.obscuration >
            eclipseAt('2034-03-20T11:10:00.000Z').obscuration,
    );
});

test('resolves a future total eclipse at the observer location', () => {
    const luxor = getSolarEclipseState(new Date('2027-08-02T10:04:00.000Z'), {
        lat: 25.6872,
        lon: 32.6396,
    });

    assert.ok(luxor.obscuration > 0.99);
    assert.ok(luxor.moonAngularRadius > luxor.sunAngularRadius);
    assert.ok(luxor.angularSeparation < luxor.moonAngularRadius);
});

test('returns no visible obscuration for unrelated dates and locations', () => {
    assert.equal(eclipseAt('2026-07-12T17:55:00.000Z').obscuration, 0);
    assert.equal(
        getSolarEclipseState(new Date('2026-08-12T17:55:00.000Z'), {
            lat: -33.8688,
            lon: 151.2093,
        }).obscuration,
        0,
    );
});

test('maps obscuration to clamped visual scales', () => {
    assert.deepEqual(getSolarEclipseVisualScales(0), {
        direct: 1,
        ambient: 1,
        sky: 1,
        sunGlow: 1,
    });
    assert.deepEqual(getSolarEclipseVisualScales(-1), {
        direct: 1,
        ambient: 1,
        sky: 1,
        sunGlow: 1,
    });

    const total = getSolarEclipseVisualScales(1);
    const aboveRange = getSolarEclipseVisualScales(2);
    assertClose(total.direct, 0.03);
    assertClose(total.ambient, 0.18);
    assertClose(total.sky, 0.28);
    assertClose(total.sunGlow, 0.08);
    assert.deepEqual(aboveRange, total);
});

test('darkens every visual scale monotonically as obscuration increases', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map(getSolarEclipseVisualScales);

    for (const key of ['direct', 'ambient', 'sky', 'sunGlow'] as const) {
        for (let index = 1; index < samples.length; index += 1) {
            const previous = samples[index - 1]?.[key];
            const current = samples[index]?.[key];
            assert.ok(previous !== undefined);
            assert.ok(current !== undefined);
            assert.ok(current < previous);
            assert.ok(current >= 0 && current <= 1);
        }
    }
});
