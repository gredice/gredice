import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlantSowingPrice } from './resolvePlantSowingPrice.ts';

test('resolvePlantSowingPrice uses the sort-specific price when available', () => {
    assert.deepEqual(
        resolvePlantSowingPrice(
            { id: 1, prices: { perPlant: 1.5 } },
            { id: 2, prices: { perPlant: 2.25 } },
        ),
        {
            currentPrice: 2.25,
            entityId: 2,
            entityTypeName: 'plantSort',
        },
    );
});

test('resolvePlantSowingPrice falls back to the parent plant price for a sort', () => {
    assert.deepEqual(
        resolvePlantSowingPrice(
            { id: 1, prices: { perPlant: 1.5 } },
            { id: 2 },
        ),
        {
            currentPrice: 1.5,
            entityId: 1,
            entityTypeName: 'plant',
        },
    );
});

test('resolvePlantSowingPrice preserves a zero sort price instead of falling back', () => {
    assert.deepEqual(
        resolvePlantSowingPrice(
            { id: 1, prices: { perPlant: 1.5 } },
            { id: 2, prices: { perPlant: 0 } },
        ),
        {
            currentPrice: 0,
            entityId: 2,
            entityTypeName: 'plantSort',
        },
    );
});

test('resolvePlantSowingPrice returns the plant price without a sort', () => {
    assert.deepEqual(
        resolvePlantSowingPrice({ id: 1, prices: { perPlant: 1.5 } }),
        {
            currentPrice: 1.5,
            entityId: 1,
            entityTypeName: 'plant',
        },
    );
});

test('resolvePlantSowingPrice returns null when neither entity has a price', () => {
    assert.equal(resolvePlantSowingPrice({ id: 1 }, { id: 2 }), null);
});
