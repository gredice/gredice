import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGameProfileDate } from './profileDate.ts';

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
