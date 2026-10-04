import { expect, test } from '@playwright/test';
import {
    assertNonNegativeSafeInteger,
    assertPositiveSafeInteger,
} from './scheduleTaskInput';

test('accepts only positive safe task identifiers', () => {
    expect(assertPositiveSafeInteger(42, 'invalid')).toBe(42);

    for (const value of [
        undefined,
        null,
        '42',
        Number.NaN,
        Number.POSITIVE_INFINITY,
        0,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        expect(() => assertPositiveSafeInteger(value, 'invalid')).toThrow(
            'invalid',
        );
    }
});

test('accepts zero only for non-negative safe indexes', () => {
    expect(assertNonNegativeSafeInteger(0, 'invalid')).toBe(0);
    expect(assertNonNegativeSafeInteger(12, 'invalid')).toBe(12);

    for (const value of [-1, 0.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => assertNonNegativeSafeInteger(value, 'invalid')).toThrow(
            'invalid',
        );
    }
});
