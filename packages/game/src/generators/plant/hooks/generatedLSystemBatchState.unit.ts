import assert from 'node:assert/strict';
import test from 'node:test';
import type { LSystemSymbol } from '../lib/l-system';
import { reconcileGeneratedLSystemBatchState } from './generatedLSystemBatchState';

function symbols(char: string): LSystemSymbol[] {
    return [{ char, generation: 0 }];
}

test('preserves state identity when a cached batch is already current', () => {
    const first = symbols('F');
    const second = symbols('L');
    const current = { first, second };

    const reconciled = reconcileGeneratedLSystemBatchState(
        current,
        ['first', 'second'],
        { first, second },
    );

    assert.equal(reconciled, current);
});

test('updates changed entries and removes entries outside the active batch', () => {
    const first = symbols('F');
    const previousSecond = symbols('L');
    const nextSecond = symbols('P');
    const stale = symbols('S');
    const current = { first, second: previousSecond, stale };

    const reconciled = reconcileGeneratedLSystemBatchState(
        current,
        ['first', 'second'],
        { second: nextSecond },
    );

    assert.notEqual(reconciled, current);
    assert.deepEqual(reconciled, { first, second: nextSecond });
});
