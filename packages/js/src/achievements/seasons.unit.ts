import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getGrowingSeasonForDate,
    parseSeasonAchievementKey,
    seasonAchievementKey,
} from './seasons';

test('maps Zagreb calendar dates to 2026 growing seasons and ignores winter', () => {
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-02-28T23:00:00.000Z')),
        { year: 2026, name: 'spring' },
    );
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-05-31T21:59:59.000Z')),
        { year: 2026, name: 'spring' },
    );
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-05-31T22:00:00.000Z')),
        { year: 2026, name: 'summer' },
    );
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-08-31T21:59:59.000Z')),
        { year: 2026, name: 'summer' },
    );
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-08-31T22:00:00.000Z')),
        { year: 2026, name: 'autumn' },
    );
    assert.deepEqual(
        getGrowingSeasonForDate(new Date('2026-11-30T22:59:59.000Z')),
        { year: 2026, name: 'autumn' },
    );
    assert.equal(
        getGrowingSeasonForDate(new Date('2026-11-30T23:00:00.000Z')),
        undefined,
    );
    assert.equal(
        getGrowingSeasonForDate(new Date('2026-01-15T12:00:00.000Z')),
        undefined,
    );
    assert.equal(getGrowingSeasonForDate(new Date('invalid')), undefined);
});

test('round-trips season achievement keys', () => {
    const season = { year: 2026, name: 'autumn' as const };
    assert.equal(seasonAchievementKey(season), 'season_2026_autumn');
    assert.deepEqual(parseSeasonAchievementKey('season_2026_autumn'), season);
    assert.equal(parseSeasonAchievementKey('season_2026_winter'), undefined);
    assert.equal(parseSeasonAchievementKey('season_autumn'), undefined);
});
