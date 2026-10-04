import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKeyToUtcDate, timeZoneDayKey, unknownDayKey } from './index.ts';

const zagreb = 'Europe/Zagreb';

test('time zone day key resolves the local day, not the UTC day', () => {
    // 23:30 UTC in summer is already the next day in Zagreb (UTC+2).
    assert.equal(
        timeZoneDayKey('2026-07-01T23:30:00.000Z', zagreb),
        '2026-07-02',
    );
    assert.equal(
        timeZoneDayKey('2026-07-01T21:00:00.000Z', zagreb),
        '2026-07-01',
    );
});

test('time zone day key accepts dates and epoch milliseconds', () => {
    assert.equal(
        timeZoneDayKey(new Date('2026-07-01T10:00:00.000Z'), zagreb),
        '2026-07-01',
    );
    assert.equal(
        timeZoneDayKey(Date.parse('2026-07-01T10:00:00.000Z'), zagreb),
        '2026-07-01',
    );
});

test('time zone day key falls back for missing and invalid values', () => {
    assert.equal(timeZoneDayKey(null, zagreb), unknownDayKey);
    assert.equal(timeZoneDayKey(undefined, zagreb), unknownDayKey);
    assert.equal(timeZoneDayKey('', zagreb), unknownDayKey);
    assert.equal(timeZoneDayKey('not-a-date', zagreb), unknownDayKey);
});

test('day key round trips to a UTC midnight date', () => {
    assert.equal(
        dayKeyToUtcDate('2026-07-03')?.toISOString(),
        '2026-07-03T00:00:00.000Z',
    );
});

test('day key rejects malformed and out-of-range keys', () => {
    assert.equal(dayKeyToUtcDate('unknown'), null);
    assert.equal(dayKeyToUtcDate('2026-13-01'), null);
    assert.equal(dayKeyToUtcDate('2026-02-30'), null);
});
