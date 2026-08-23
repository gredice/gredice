import assert from 'node:assert/strict';
import test from 'node:test';
import { croatianCountLabel } from './croatianCount';

test('selects Croatian singular, paucal, and plural count forms', () => {
    const label = (count: number) =>
        croatianCountLabel(count, 'iznimka', 'iznimke', 'iznimki');

    assert.deepEqual([0, 1, 2, 4, 5, 11, 21, 22].map(label), [
        '0 iznimki',
        '1 iznimka',
        '2 iznimke',
        '4 iznimke',
        '5 iznimki',
        '11 iznimki',
        '21 iznimka',
        '22 iznimke',
    ]);
});
