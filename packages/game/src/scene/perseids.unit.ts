import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createPerseidsMeteor,
    getPerseidsActiveWindowDurationDays,
    getPerseidsMeteorRatePerHour,
    getPerseidsRealRatePerHour,
    PERSEIDS_DENSITY_MULTIPLIER,
    PERSEIDS_REAL_EDGE_RATE_PER_HOUR,
    PERSEIDS_REAL_PEAK_ZHR,
    PERSEIDS_RENDERING,
    samplePerseidsIntervalSeconds,
    shouldRenderPerseids,
} from './perseids';

test('keeps meteors behind depth-writing garden geometry in every camera mode', () => {
    assert.equal(PERSEIDS_RENDERING.depthTest, true);
    assert.equal(PERSEIDS_RENDERING.depthWrite, false);
});

test('uses the recurring July 17 through August 24 activity window', () => {
    assert.equal(
        getPerseidsMeteorRatePerHour(new Date(2026, 6, 16, 23, 59)),
        0,
    );
    assert.equal(
        getPerseidsMeteorRatePerHour(new Date(2026, 6, 17, 0, 0)),
        PERSEIDS_REAL_EDGE_RATE_PER_HOUR * PERSEIDS_DENSITY_MULTIPLIER,
    );
    assert.ok(getPerseidsMeteorRatePerHour(new Date(2026, 7, 24, 23, 59)) > 0);
    assert.equal(getPerseidsMeteorRatePerHour(new Date(2026, 7, 25, 0, 0)), 0);
    assert.ok(getPerseidsMeteorRatePerHour(new Date(2031, 7, 12, 22, 0)) > 0);
    assert.equal(getPerseidsActiveWindowDurationDays(), 39);
});

test('triples the original in-game cadence and peaks on August 13', () => {
    const peak = new Date(2026, 7, 13, 0, 0);
    assert.equal(PERSEIDS_DENSITY_MULTIPLIER, 6);
    assert.equal(getPerseidsRealRatePerHour(peak), PERSEIDS_REAL_PEAK_ZHR);
    assert.equal(
        getPerseidsMeteorRatePerHour(peak),
        PERSEIDS_REAL_PEAK_ZHR * PERSEIDS_DENSITY_MULTIPLIER,
    );

    for (const date of [
        new Date(2026, 6, 19, 23, 0),
        new Date(2026, 7, 1, 23, 0),
        new Date(2026, 7, 12, 23, 0),
        new Date(2026, 7, 18, 23, 0),
    ]) {
        assert.equal(
            getPerseidsMeteorRatePerHour(date),
            getPerseidsRealRatePerHour(date) * PERSEIDS_DENSITY_MULTIPLIER,
        );
    }
});

test('ramps toward the peak and tapers after it', () => {
    const opening = getPerseidsMeteorRatePerHour(new Date(2026, 6, 17, 0, 0));
    const earlyAugust = getPerseidsMeteorRatePerHour(
        new Date(2026, 7, 2, 0, 0),
    );
    const peak = getPerseidsMeteorRatePerHour(new Date(2026, 7, 13, 0, 0));
    const lateAugust = getPerseidsMeteorRatePerHour(
        new Date(2026, 7, 21, 0, 0),
    );

    assert.ok(opening < earlyAugust);
    assert.ok(earlyAugust < peak);
    assert.ok(lateAugust < peak);
    assert.ok(lateAugust > 0);
});

test('requires both an active date and visible night sky', () => {
    const activeDate = new Date(2026, 7, 12, 23, 0);
    assert.equal(
        shouldRenderPerseids({ date: activeDate, skyVisibility: 1 }),
        true,
    );
    assert.equal(
        shouldRenderPerseids({ date: activeDate, skyVisibility: 0 }),
        false,
    );
    assert.equal(
        shouldRenderPerseids({
            date: new Date(2026, 5, 12, 23, 0),
            skyVisibility: 1,
        }),
        false,
    );
});

test('samples a natural exponential interval from the configured rate', () => {
    const interval = samplePerseidsIntervalSeconds({
        meteorsPerHour: 200,
        random: () => 0.5,
    });
    assert.ok(Math.abs(interval - (Math.log(2) * 3600) / 200) < 1e-12);
    assert.equal(
        samplePerseidsIntervalSeconds({ meteorsPerHour: 0 }),
        Number.POSITIVE_INFINITY,
    );
});

test('creates deterministic, finite streaks moving away from the radiant', () => {
    let seed = 0;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
    const first = createPerseidsMeteor(random);
    seed = 0;
    const second = createPerseidsMeteor(random);

    assert.deepEqual(first, second);
    assert.ok(first.start[0] >= 0 && first.start[0] <= 1);
    assert.ok(first.start[1] >= 0 && first.start[1] <= 1);
    assert.ok(first.end[0] >= 0.52 && first.end[0] <= 1.08);
    assert.ok(first.end[1] >= -0.08 && first.end[1] <= 0.64);
    assert.ok(first.durationSeconds > 0);
    assert.ok(first.trailFraction > 0 && first.trailFraction < 1);
    assert.ok(first.width > 0);
});
