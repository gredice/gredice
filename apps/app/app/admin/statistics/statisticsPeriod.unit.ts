import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveCurrentWeekStatisticsPeriod,
    resolveStatisticsPeriod,
} from './statisticsPeriod';

const julySeventeenth = new Date('2026-07-17T12:00:00.000Z');

test('defaults to the current Zagreb calendar year', () => {
    const period = resolveStatisticsPeriod({}, julySeventeenth);

    assert.equal(period.key, 'current-year');
    assert.equal(period.pickerFrom, '2026-01-01');
    assert.equal(period.pickerTo, '2026-07-17');
    assert.equal(period.maxDate, '2026-07-17');
    assert.equal(period.fromDate?.toISOString(), '2025-12-31T23:00:00.000Z');
    assert.equal(period.toDate?.toISOString(), '2026-07-17T21:59:59.999Z');
});

test('creates inclusive rolling ranges', () => {
    const period = resolveStatisticsPeriod(
        { period: 'last-7-days' },
        julySeventeenth,
    );

    assert.equal(period.key, 'last-7-days');
    assert.equal(period.pickerFrom, '2026-07-11');
    assert.equal(period.pickerTo, '2026-07-17');
    assert.equal(period.fromDate?.toISOString(), '2026-07-10T22:00:00.000Z');
});

test('accepts a valid custom range with DST-aware Zagreb boundaries', () => {
    const period = resolveStatisticsPeriod(
        {
            period: 'custom',
            from: '2026-03-29',
            to: '2026-03-29',
        },
        julySeventeenth,
    );

    assert.equal(period.key, 'custom');
    assert.equal(period.fromDate?.toISOString(), '2026-03-28T23:00:00.000Z');
    assert.equal(period.toDate?.toISOString(), '2026-03-29T21:59:59.999Z');
});

test('falls back to the current year for invalid or future custom ranges', () => {
    const reversed = resolveStatisticsPeriod(
        {
            period: 'custom',
            from: '2026-07-17',
            to: '2026-07-16',
        },
        julySeventeenth,
    );
    const future = resolveStatisticsPeriod(
        {
            period: 'custom',
            from: '2026-07-17',
            to: '2026-07-18',
        },
        julySeventeenth,
    );

    assert.equal(reversed.key, 'current-year');
    assert.equal(future.key, 'current-year');
});

test('leaves the query unbounded for the all-time period when allowed', () => {
    const period = resolveStatisticsPeriod(
        { period: 'all-time' },
        julySeventeenth,
    );

    assert.equal(period.key, 'all-time');
    assert.equal(period.fromDate, undefined);
    assert.equal(period.toDate, undefined);
    assert.equal(period.rangeLabel, 'Cijelo razdoblje');
});

test('falls back to the current year when all-time is unavailable', () => {
    const period = resolveStatisticsPeriod(
        { period: 'all-time' },
        julySeventeenth,
        { allowAllTime: false },
    );

    assert.equal(period.key, 'current-year');
    assert.equal(period.pickerFrom, '2026-01-01');
});

test('resolves the current calendar week from Monday through today', () => {
    const period = resolveCurrentWeekStatisticsPeriod(julySeventeenth);

    assert.equal(period.pickerFrom, '2026-07-13');
    assert.equal(period.pickerTo, '2026-07-17');
    assert.equal(period.fromDate.toISOString(), '2026-07-12T22:00:00.000Z');
    assert.equal(period.toDate.toISOString(), '2026-07-17T21:59:59.999Z');
});

test('keeps Monday as the week start when today is Sunday', () => {
    const period = resolveCurrentWeekStatisticsPeriod(
        new Date('2026-07-19T12:00:00.000Z'),
    );

    assert.equal(period.pickerFrom, '2026-07-13');
    assert.equal(period.pickerTo, '2026-07-19');
});
