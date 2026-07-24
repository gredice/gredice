import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    CheckoutDeliverySelectionError,
    checkoutDeliverySelectionErrorCodes,
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
