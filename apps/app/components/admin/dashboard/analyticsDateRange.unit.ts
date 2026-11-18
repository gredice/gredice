import assert from 'node:assert/strict';
import test from 'node:test';
import {
    analyticsDateKey,
    createAnalyticsDateRange,
    createAnalyticsWeekDays,
} from './analyticsDateRange';

test('creates Zagreb-aware custom date boundaries', () => {
    const range = createAnalyticsDateRange(
        undefined,
        '2026-07-17',
        '2026-07-17',
    );

    assert.equal(range.startDate.toISOString(), '2026-07-16T22:00:00.000Z');
    assert.equal(range.endDate.toISOString(), '2026-07-17T21:59:59.999Z');
    assert.deepEqual(range.dateKeys, ['2026-07-17']);
});

test('keeps one calendar bucket across the autumn DST transition', () => {
    const range = createAnalyticsDateRange(
        undefined,
        '2026-10-25',
        '2026-10-25',
    );

    assert.equal(range.startDate.toISOString(), '2026-10-24T22:00:00.000Z');
    assert.equal(range.endDate.toISOString(), '2026-10-25T22:59:59.999Z');
    assert.deepEqual(range.dateKeys, ['2026-10-25']);
});

test('assigns late UTC events to their Zagreb calendar date', () => {
    assert.equal(
        analyticsDateKey(new Date('2026-07-16T22:30:00.000Z')),
        '2026-07-17',
    );
});

test('creates a Monday-first week with future days marked', () => {
    const week = createAnalyticsWeekDays('2026-11-09', '2026-11-11');

    assert.deepEqual(
        week.map((day) => day.date),
        [
            '2026-11-09',
            '2026-11-10',
            '2026-11-11',
            '2026-11-12',
            '2026-11-13',
            '2026-11-14',
            '2026-11-15',
        ],
    );
    assert.deepEqual(
        week.map((day) => day.weekday),
        [1, 2, 3, 4, 5, 6, 0],
    );
    assert.deepEqual(
        week.map((day) => day.isFuture),
        [false, false, false, true, true, true, true],
    );
});

test('keeps week days continuous across a month boundary', () => {
    const week = createAnalyticsWeekDays('2026-11-30', '2026-12-06');

    assert.equal(week[1]?.date, '2026-12-01');
    assert.equal(week[6]?.date, '2026-12-06');
    assert.ok(week.every((day) => !day.isFuture));
});
