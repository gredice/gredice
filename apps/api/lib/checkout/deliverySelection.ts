export interface CheckoutDeliverySelection {
    slotId: number;
    mode: 'delivery' | 'pickup';
    addressId?: number;
    locationId?: number;
    notes?: string;
}

interface CheckoutDeliverySlot {
    id: number;
    type: string;
    status: string;
    startAt: Date;
    effectiveClosesAt: Date;
    locationId: number;
}

interface CheckoutDeliveryAddress {
    id: number;
}

interface CheckoutPickupLocation {
    id: number;
    isActive: boolean;
}

interface CheckoutDeliveryLookupCartItem {
    entityTypeName: string;
    id: number;
    isDeleted: boolean;
    status: string;
}

export const checkoutDeliverySelectionErrorCodes = {
    REQUIRED: 'delivery-selection-required',
    SLOT_UNAVAILABLE: 'delivery-slot-unavailable',
    MODE_MISMATCH: 'delivery-mode-mismatch',
    ADDRESS_INVALID: 'delivery-address-invalid',
    LOCATION_INVALID: 'pickup-location-invalid',
} as const;

type CheckoutDeliverySelectionErrorCode =
    (typeof checkoutDeliverySelectionErrorCodes)[keyof typeof checkoutDeliverySelectionErrorCodes];

export class CheckoutDeliverySelectionError extends Error {
    override name = 'CheckoutDeliverySelectionError';

    constructor(
        readonly code: CheckoutDeliverySelectionErrorCode,
        readonly status: 400 | 409,
        message: string,
    ) {
        super(message);
    }
}

export function hasCheckoutDeliveryLookupCandidate(
    items: readonly CheckoutDeliveryLookupCartItem[],
    mappedOperationCartItemIds: ReadonlySet<number>,
) {
    return items.some(
        (item) =>
            item.entityTypeName === 'operation' &&
            item.status === 'new' &&
            !item.isDeleted &&
            !mappedOperationCartItemIds.has(item.id),
    );
}

export async function resolveCheckoutRequiresDelivery(
    items: readonly CheckoutDeliveryLookupCartItem[],
    mappedOperationCartItemIds: ReadonlySet<number>,
    lookupDeliverableItems: () => Promise<boolean>,
) {
    if (
        !hasCheckoutDeliveryLookupCandidate(items, mappedOperationCartItemIds)
    ) {
        return false;
    }

    return lookupDeliverableItems();
}

export function validateCheckoutDeliverySelection({
    address,
    location,
    now = new Date(),
    requiresDelivery,
    selection,
    slot,
}: {
    address?: CheckoutDeliveryAddress;
    location?: CheckoutPickupLocation;
    now?: Date;
    requiresDelivery: boolean;
    selection?: CheckoutDeliverySelection;
    slot?: CheckoutDeliverySlot;
}) {
    if (!selection) {
        if (!requiresDelivery) {
            return;
        }

        throw new CheckoutDeliverySelectionError(
            checkoutDeliverySelectionErrorCodes.REQUIRED,
            400,
            'Odabir dostave ili preuzimanja je obavezan.',
        );
    }

    if (
        !slot ||
        slot.id !== selection.slotId ||
        slot.status !== 'scheduled' ||
        slot.startAt.getTime() <= now.getTime() ||
        slot.effectiveClosesAt.getTime() <= now.getTime()
    ) {
        throw new CheckoutDeliverySelectionError(
            checkoutDeliverySelectionErrorCodes.SLOT_UNAVAILABLE,
            409,
            'Odabrani termin više nije dostupan.',
        );
    }

    if (slot.type !== selection.mode) {
        throw new CheckoutDeliverySelectionError(
            checkoutDeliverySelectionErrorCodes.MODE_MISMATCH,
            400,
            'Način preuzimanja ne odgovara odabranom terminu.',
        );
    }

    if (selection.mode === 'delivery') {
        if (!address || address.id !== selection.addressId) {
            throw new CheckoutDeliverySelectionError(
                checkoutDeliverySelectionErrorCodes.ADDRESS_INVALID,
                400,
                'Odaberi važeću adresu za dostavu.',
            );
        }

        return selection;
    }

    if (
        !location?.isActive ||
        location.id !== slot.locationId ||
        location.id !== selection.locationId
    ) {
        throw new CheckoutDeliverySelectionError(
            checkoutDeliverySelectionErrorCodes.LOCATION_INVALID,
            400,
            'Lokacija preuzimanja ne odgovara odabranom terminu.',
        );
    }

    return selection;
}
