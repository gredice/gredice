import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLandingPricing } from './landingPricingSummary.ts';

test('summarizeLandingPricing quotes the cheapest priced plant, ignoring sorts and unpriced plants', () => {
    const summary = summarizeLandingPricing({
        plantRows: [
            { kind: 'plant', price: 2.99 },
            { kind: 'plant', price: 0 },
            { kind: 'sort', price: 0.99 },
            { kind: 'plant', price: 1.99 },
        ],
        operationRows: [],
        deliveryRows: [],
    });

    assert.equal(summary.minPlantPrice, 1.99);
});

test('summarizeLandingPricing quotes the cheapest available operation with a stable label', () => {
    const summary = summarizeLandingPricing({
        plantRows: [],
        operationRows: [
            { availability: 'internal', label: 'Čišćenje korova', price: 0 },
            { availability: 'unavailable', label: 'Dekapitacija', price: 0 },
            { availability: 'available', label: 'Zalijevanje', price: 0.5 },
            { availability: 'available', label: 'Branje zrelih', price: 0.2 },
            { availability: 'available', label: 'Branje biljke', price: 0.2 },
        ],
        deliveryRows: [],
    });

    assert.deepEqual(summary.cheapestOperation, {
        label: 'Branje biljke',
        price: 0.2,
    });
});

test('summarizeLandingPricing quotes the cheapest delivery rate and its zone', () => {
    const summary = summarizeLandingPricing({
        plantRows: [],
        operationRows: [],
        deliveryRows: [
            { pricePerKilometer: 0.3, zoneRadius: 60 },
            { pricePerKilometer: 0.2, zoneRadius: 100 },
        ],
    });

    assert.deepEqual(summary.delivery, {
        pricePerKilometer: 0.2,
        zoneRadius: 100,
    });
});

test('summarizeLandingPricing returns nulls when the catalogue has no prices', () => {
    assert.deepEqual(
        summarizeLandingPricing({
            plantRows: [],
            operationRows: [],
            deliveryRows: [],
        }),
        { minPlantPrice: null, cheapestOperation: null, delivery: null },
    );
});
