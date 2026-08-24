import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createMoonIlluminationPath,
    getPublicEnvironmentMinutes,
    parsePublicEnvironmentWeather,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from './publicEnvironment';

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
};

test('resolves real sun positions into the visible Zagreb sky', () => {
    const noon = resolvePublicEnvironmentSnapshot({
        date: new Date('2026-06-21T12:00:00+02:00'),
        weather: clearWeather,
    });
    const midnight = resolvePublicEnvironmentSnapshot({
        date: new Date('2026-06-21T00:00:00+02:00'),
        weather: clearWeather,
    });

    assert.equal(noon.sun.visible, true);
    assert.ok(noon.sun.top < 35);
    assert.equal(noon.dark, false);
    assert.equal(midnight.sun.visible, false);
    assert.equal(midnight.dark, true);
    assert.ok(midnight.nightAmount > 0.9);
});

test('uses Zagreb civil time independently of the viewer time zone', () => {
    const instant = new Date('2026-08-24T17:00:00Z');
    const originalTimeZone = process.env.TZ;

    try {
        process.env.TZ = 'America/Los_Angeles';
        const westOfZagreb = resolvePublicEnvironmentSnapshot({
            date: instant,
            weather: clearWeather,
        });

        process.env.TZ = 'Asia/Dubai';
        const eastOfZagreb = resolvePublicEnvironmentSnapshot({
            date: instant,
            weather: clearWeather,
        });

        assert.equal(getPublicEnvironmentMinutes(instant), 19 * 60);
        assert.equal(westOfZagreb.horizon, eastOfZagreb.horizon);
        assert.equal(westOfZagreb.themeHue, eastOfZagreb.themeHue);
        assert.equal(westOfZagreb.zenith, eastOfZagreb.zenith);
    } finally {
        if (originalTimeZone === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = originalTimeZone;
        }
    }
});

test('constructs debug instants from Zagreb clock minutes', () => {
    const debugDate = resolvePublicEnvironmentDateAtMinutes(
        new Date('2026-08-24T17:00:00Z'),
        6 * 60 + 30,
    );

    assert.equal(debugDate.toISOString(), '2026-08-24T04:30:00.000Z');
    assert.equal(getPublicEnvironmentMinutes(debugDate), 6 * 60 + 30);
});

test('changes the atmospheric palette for weather while retaining valid colors', () => {
    const clear = resolvePublicEnvironmentSnapshot({
        date: new Date('2026-08-24T15:00:00+02:00'),
        weather: clearWeather,
    });
    const storm = resolvePublicEnvironmentSnapshot({
        date: new Date('2026-08-24T15:00:00+02:00'),
        weather: {
            cloudy: 1,
            foggy: 0.2,
            rainy: 1,
            snowy: 0,
            thundery: 1,
        },
    });

    assert.notEqual(clear.zenith, storm.zenith);
    assert.match(storm.horizon, /^rgb\(\d+ \d+ \d+\)$/u);
    assert.notEqual(clear.themeHue, storm.themeHue);
});

test('builds distinct illuminated moon shapes for major phases', () => {
    const newMoon = createMoonIlluminationPath(0);
    const firstQuarter = createMoonIlluminationPath(0.25);
    const fullMoon = createMoonIlluminationPath(0.5);
    const lastQuarter = createMoonIlluminationPath(0.75);

    assert.notEqual(newMoon, firstQuarter);
    assert.notEqual(firstQuarter, fullMoon);
    assert.notEqual(firstQuarter, lastQuarter);
    assert.match(fullMoon, /^M /u);
    assert.match(fullMoon, / Z$/u);
});

test('parses and clamps the public weather response safely', () => {
    assert.deepEqual(
        parsePublicEnvironmentWeather({
            cloudy: 2,
            foggy: -1,
            rainy: 0.4,
            snowy: 'no',
        }),
        {
            cloudy: 1,
            foggy: 0,
            rainy: 0.4,
            snowy: 0,
            thundery: 0,
        },
    );
    assert.equal(parsePublicEnvironmentWeather(null), null);
});
