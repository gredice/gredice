import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    CheckoutDeliverySelectionError,
    checkoutDeliverySelectionErrorCodes,
    hasCheckoutDeliveryLookupCandidate,
    resolveCheckoutRequiresDelivery,
    validateCheckoutDeliverySelection,
} from './deliverySelection';

const now = new Date('2026-07-24T08:00:00.000Z');
const deliverySlot = {
    id: 7,
    type: 'delivery',
    status: 'scheduled',
    startAt: new Date('2026-07-28T08:00:00.000Z'),
    effectiveClosesAt: new Date('2026-07-26T08:00:00.000Z'),
    locationId: 3,
};

describe('hasCheckoutDeliveryLookupCandidate', () => {
    const operationItem = {
        entityTypeName: 'operation',
        id: 42,
        isDeleted: false,
        status: 'new',
    };

    it('skips lookup for non-operation items', () => {
        assert.equal(
            hasCheckoutDeliveryLookupCandidate(
                [{ ...operationItem, entityTypeName: 'sunflowerPackage' }],
                new Set(),
            ),
            false,
        );
    });

    it('skips lookup for paid operation items', () => {
        assert.equal(
            hasCheckoutDeliveryLookupCandidate(
                [{ ...operationItem, status: 'paid' }],
                new Set(),
            ),
            false,
        );
    });

    it('skips lookup for deleted operation items', () => {
        assert.equal(
            hasCheckoutDeliveryLookupCandidate(
                [{ ...operationItem, isDeleted: true }],
                new Set(),
            ),
            false,
        );
    });

    it('skips lookup for mapped operation items', () => {
        assert.equal(
            hasCheckoutDeliveryLookupCandidate(
                [operationItem],
                new Set([operationItem.id]),
            ),
            false,
        );
    });

    it('requires the authoritative lookup for an eligible operation', () => {
        assert.equal(
            hasCheckoutDeliveryLookupCandidate([operationItem], new Set()),
            true,
        );
    });
});

describe('resolveCheckoutRequiresDelivery', () => {
    const operationItem = {
        entityTypeName: 'operation',
        id: 42,
        isDeleted: false,
        status: 'new',
    };

    it('does not call the authoritative lookup for an ineligible cart', async () => {
        let lookupCalls = 0;

        const requiresDelivery = await resolveCheckoutRequiresDelivery(
            [{ ...operationItem, entityTypeName: 'sunflowerPackage' }],
            new Set(),
            async () => {
                lookupCalls += 1;
                return true;
            },
        );

        assert.equal(requiresDelivery, false);
        assert.equal(lookupCalls, 0);
    });

    for (const authoritativeResult of [false, true]) {
        it(`calls the authoritative lookup once and returns ${authoritativeResult.toString()}`, async () => {
            let lookupCalls = 0;

            const requiresDelivery = await resolveCheckoutRequiresDelivery(
                [operationItem],
                new Set(),
                async () => {
                    lookupCalls += 1;
                    return authoritativeResult;
                },
            );

            assert.equal(requiresDelivery, authoritativeResult);
            assert.equal(lookupCalls, 1);
        });
    }
});

describe('validateCheckoutDeliverySelection', () => {
    it('requires a selection for a cart with deliverable items', () => {
        assert.throws(
            () =>
                validateCheckoutDeliverySelection({
                    requiresDelivery: true,
                    now,
                }),
            (error) =>
                error instanceof CheckoutDeliverySelectionError &&
                error.code === checkoutDeliverySelectionErrorCodes.REQUIRED,
        );
    });

    it('accepts an owned address for an available delivery slot', () => {
        const selection = {
            slotId: 7,
            mode: 'delivery' as const,
            addressId: 11,
        };

        assert.deepEqual(
            validateCheckoutDeliverySelection({
                address: { id: 11 },
                requiresDelivery: true,
                now,
                selection,
                slot: deliverySlot,
            }),
            selection,
        );
    });

    it('rejects a pickup location that does not belong to the slot', () => {
        assert.throws(
            () =>
                validateCheckoutDeliverySelection({
                    location: { id: 9, isActive: true },
                    requiresDelivery: true,
                    now,
                    selection: {
                        slotId: 8,
                        mode: 'pickup',
                        locationId: 9,
                    },
                    slot: {
                        ...deliverySlot,
                        id: 8,
                        type: 'pickup',
                        locationId: 3,
                    },
                }),
            (error) =>
                error instanceof CheckoutDeliverySelectionError &&
                error.code ===
                    checkoutDeliverySelectionErrorCodes.LOCATION_INVALID,
        );
    });

    it('rejects a slot after its effective close deadline', () => {
        assert.throws(
            () =>
                validateCheckoutDeliverySelection({
                    address: { id: 11 },
                    requiresDelivery: true,
                    now,
                    selection: {
                        slotId: 7,
                        mode: 'delivery',
                        addressId: 11,
                    },
                    slot: {
                        ...deliverySlot,
                        effectiveClosesAt: now,
                    },
                }),
            (error) =>
                error instanceof CheckoutDeliverySelectionError &&
                error.code ===
                    checkoutDeliverySelectionErrorCodes.SLOT_UNAVAILABLE,
        );
    });
});
