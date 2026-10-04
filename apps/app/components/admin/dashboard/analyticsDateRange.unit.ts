import assert from 'node:assert/strict';
import test from 'node:test';
import {
    analyticsDateKey,
    createAnalyticsDateRange,
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
