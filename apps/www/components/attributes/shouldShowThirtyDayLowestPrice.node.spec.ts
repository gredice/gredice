import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowThirtyDayLowestPrice } from './shouldShowThirtyDayLowestPrice.ts';

test('unchanged anchor prices suppress an older distinct 30-day minimum', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(0.6, 0, 0.6), false);
    assert.equal(shouldShowThirtyDayLowestPrice(0.6, 0, 0.5), true);
});

test('hides the 30-day lowest price when it matches the current price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.25, 1.25), false);
});

test('hides differences that format to the same customer-visible price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.251, 1.252), false);
});

test('shows a distinct 30-day lowest price', () => {
    assert.equal(shouldShowThirtyDayLowestPrice(1.25, 0.95), true);
});
