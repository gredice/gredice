import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCheckoutAdditionalData,
    decodeExpectedNonStripeCartItemIdsMetadata,
    decodeHarvestDatesMetadata,
    encodeHarvestDatesMetadata,
} from './harvestCheckout';

test('harvest checkout preserves metadata and applies the canonical date', () => {
    assert.deepEqual(
        buildCheckoutAdditionalData({
            additionalData: JSON.stringify({
                scheduledDate: '2026-07-20T00:00:00.000Z',
                sowingLocation: 'outdoor',
            }),
            deliveryInfo: {
                slotId: 8,
                mode: 'pickup',
                locationId: 3,
            },
            scheduledHarvestDate: '2026-07-24T00:00:00.000Z',
        }),
        {
            scheduledDate: '2026-07-24T00:00:00.000Z',
            sowingLocation: 'outdoor',
            delivery: {
                slotId: 8,
                mode: 'pickup',
                locationId: 3,
            },
        },
    );
});

test('non-harvest checkout leaves an existing scheduled date unchanged', () => {
    assert.deepEqual(
        buildCheckoutAdditionalData({
            additionalData: JSON.stringify({
                scheduledDate: '2026-07-27T00:00:00.000Z',
            }),
        }),
        {
            scheduledDate: '2026-07-27T00:00:00.000Z',
        },
    );
});

test('round-trips a chunked canonical harvest date map for Stripe fulfillment', () => {
    const selections = Array.from({ length: 100 }, (_, index) => ({
        cartItemId: index + 1,
        scheduledDate: '2026-07-24T00:00:00.000Z',
    }));

    const metadata = encodeHarvestDatesMetadata(selections, [104, 102]);
    assert.ok(Number(metadata.harvestDatesChunkCount) > 1);
    assert.deepEqual(
        [...decodeHarvestDatesMetadata(metadata).entries()],
        selections.map(
            ({ cartItemId, scheduledDate }) =>
                [cartItemId, scheduledDate] as const,
        ),
    );
    assert.deepEqual(
        [...(decodeExpectedNonStripeCartItemIdsMetadata(metadata) ?? [])],
        [102, 104],
    );
});

test('rejects incomplete canonical harvest date metadata', () => {
    assert.throws(
        () =>
            decodeHarvestDatesMetadata({
                harvestDatesVersion: '1',
                harvestDatesChunkCount: '2',
                harvestDates0: '[[1,"2026-07-24T00:00:00.000Z"]]',
            }),
        /Incomplete harvest date checkout metadata/,
    );
});

test('distinguishes a legacy session from a new empty non-Stripe snapshot', () => {
    assert.equal(decodeExpectedNonStripeCartItemIdsMetadata(undefined), null);

    const metadata = encodeHarvestDatesMetadata([], []);
    assert.deepEqual(
        [...(decodeExpectedNonStripeCartItemIdsMetadata(metadata) ?? [])],
        [],
    );
});
