import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveGameProfileDate,
    restoreGameProfileDate,
    serializeGameProfileDate,
} from './profileDate.ts';

test('profile date validates calendar days and preserves the fixture clock', () => {
    const fallback = new Date(2024, 5, 21, 18, 30);
    const date = resolveGameProfileDate('2024-02-29', fallback);
    assert.ok(date);
    assert.deepEqual(
        [
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
        ],
        [2024, 1, 29, 18, 30],
    );
    assert.equal(fallback.getMonth(), 5);
    assert.equal(resolveGameProfileDate('2026-10-22')?.getHours(), 12);
    assert.equal(resolveGameProfileDate('0001-01-01')?.getFullYear(), 1);
});

test('invalid date queries preserve the caller fallback, including live debug scenes', () => {
    const fallback = new Date(2024, 5, 21, 12);
    for (const value of [
        undefined,
        '',
        '2026-02-29',
        '2024-02-30',
        '2026-04-31',
        '0000-01-01',
        '10000-01-01',
        '2024-13-01',
        '2024-00-01',
        '2024-01-00',
        '2024-2-9',
        '2024-01-01T12:00:00Z',
        'garbage',
    ]) {
        assert.equal(resolveGameProfileDate(value, fallback), fallback);
        assert.equal(resolveGameProfileDate(value), undefined);
    }
});

test('server calendar parts preserve the requested local clock in a different browser timezone', () => {
    const previous = process.env.TZ;
    try {
        process.env.TZ = 'UTC';
        const date = resolveGameProfileDate(
            '2024-10-22',
            new Date(2024, 5, 21, 22, 30),
        );
        const parts = serializeGameProfileDate(date);
        assert.equal(parts, '2024-10-22T22:30:00.000');
        process.env.TZ = 'Europe/Zagreb';
        const browserDate = restoreGameProfileDate(parts);
        assert.ok(browserDate);
        assert.equal(browserDate.getDate(), 22);
        assert.equal(browserDate.getHours(), 22);
        assert.equal(browserDate.toISOString(), '2024-10-22T20:30:00.000Z');
        process.env.TZ = 'America/Los_Angeles';
        assert.equal(restoreGameProfileDate(parts)?.getHours(), 22);
        assert.equal(restoreGameProfileDate(parts)?.getDate(), 22);
        assert.equal(restoreGameProfileDate(undefined), undefined);
    } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
    }
});
