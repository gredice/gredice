import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalyticsDateRange } from './analyticsDateRange';
import {
    createDashboardDateBuckets,
    sumDashboardBucket,
} from './dashboardDateBuckets';

test('one day and rolling week keep chronological daily columns', () => {
    for (const days of [1, 7]) {
        const range = createAnalyticsDateRange(
            days,
            undefined,
            undefined,
            new Date('2026-11-11T12:00:00Z'),
        );
        const buckets = createDashboardDateBuckets(range.dateKeys);
        assert.deepEqual(
            buckets.flatMap((bucket) => bucket.dates),
            range.dateKeys,
        );
        assert.equal(buckets.length, days);
        assert.equal(buckets.at(-1)?.key, '2026-11-11');
    }
});

test('long ranges partition dates without duplicating, dropping or mixing repeated weekdays', () => {
    for (const [from, to] of [
        ['2026-10-20', '2026-11-18'],
        ['2025-01-01', '2026-12-31'],
    ]) {
        const range = createAnalyticsDateRange(undefined, from, to);
        const data = range.dateKeys.map((date, index) => ({
            date,
            count: index + 1,
        }));
        const buckets = createDashboardDateBuckets(range.dateKeys);
        assert.ok(buckets.length <= 7);
        assert.deepEqual(
            buckets.flatMap((bucket) => bucket.dates),
            range.dateKeys,
        );
        assert.equal(
            buckets.reduce(
                (total, bucket) =>
                    total +
                    sumDashboardBucket(
                        data,
                        bucket.dates,
                        (point) => point.count,
                    ),
                0,
            ),
            data.reduce((total, point) => total + point.count, 0),
        );
        assert.equal(
            sumDashboardBucket(data, [from], (point) => point.count),
            1,
        );
    }
});

test('empty and missing daily data sum to zero', () => {
    assert.deepEqual(createDashboardDateBuckets([]), []);
    assert.equal(
        sumDashboardBucket(
            [{ date: '2026-11-01', count: 10 }],
            ['2026-11-02'],
            (point) => point.count,
        ),
        0,
    );
});

test('cross-year ranges include years in every bucket description', () => {
    // A 49-day range yields seven-day buckets, including one spanning New Year.
    const range = createAnalyticsDateRange(
        undefined,
        '2026-12-01',
        '2027-01-18',
    );
    const buckets = createDashboardDateBuckets(range.dateKeys);
    assert.equal(
        buckets[4]?.description,
        'utorak, 29. 12. 2026. – ponedjeljak, 04. 01. 2027.',
    );
    assert.match(buckets[0]?.description ?? '', /2026/);
    assert.match(buckets.at(-1)?.description ?? '', /2027/);
    const daily = createDashboardDateBuckets(['2026-12-31', '2027-01-01']);
    assert.match(daily[0]?.description ?? '', /2026/);
    assert.match(daily[1]?.description ?? '', /2027/);
    const sameYear = createDashboardDateBuckets(['2026-12-30', '2026-12-31']);
    assert.ok(sameYear.every((bucket) => !bucket.description.includes('2026')));
});
