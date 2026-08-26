import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowThirtyDayLowestPrice } from './shouldShowThirtyDayLowestPrice.ts';

test('hides the 30-day lowest price when it matches the current price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.25, 1.25), false);
});

test('hides differences that format to the same customer-visible price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.251, 1.252), false);
});

test('shows a distinct 30-day lowest price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.25, 0.95), true);
});
