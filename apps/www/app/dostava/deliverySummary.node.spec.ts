import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryPricePerKilometre,
    maximumDeliveryDistanceKilometres,
} from '@gredice/js/delivery';
import {
    deliverySummaryFacts,
    deliverySummaryHeading,
    deliverySummaryLead,
} from './deliverySummary.ts';

const summaryText = [deliverySummaryLead, ...deliverySummaryFacts].join(' ');

test('delivery summary names the concepts people search for', () => {
    assert.equal(deliverySummaryHeading, 'Gredice ukratko');

    for (const term of [
        'zagreb',
        'dostav',
        'svježe povrće',
        'aplikacij',
        'vlastitu gredicu',
    ]) {
        assert.ok(
            summaryText.toLowerCase().includes(term),
            `Summary is missing "${term}"`,
        );
    }
});

test('delivery summary stays short enough to quote', () => {
    assert.ok(
        deliverySummaryLead.length <= 400,
        `Lead is ${deliverySummaryLead.length} characters, expected at most 400`,
    );
    assert.ok(deliverySummaryFacts.length >= 3);
    for (const fact of deliverySummaryFacts) {
        assert.ok(
            fact.length <= 160,
            `Fact is ${fact.length} characters, expected at most 160: ${fact}`,
        );
    }
});

test('delivery summary quotes the same pricing the page calculates', () => {
    const distanceFact = deliverySummaryFacts.find((fact) =>
        fact.includes('kilometru'),
    );

    assert.ok(distanceFact, 'Expected a fact about the per-kilometre price');
    assert.ok(
        distanceFact.includes(
            deliveryPricePerKilometre.toFixed(2).replace('.', ','),
        ),
        `Distance fact does not quote ${deliveryPricePerKilometre}: ${distanceFact}`,
    );
    assert.ok(
        distanceFact.includes(`${maximumDeliveryDistanceKilometres} km`),
        `Distance fact does not quote the ${maximumDeliveryDistanceKilometres} km limit`,
    );
});
