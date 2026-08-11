import { randomUUID } from 'node:crypto';
import type { AdvancedSowingCartAuthorizationV1 } from '@gredice/js/plants';
import {
    fingerprintStripeCheckoutValue,
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
    type StripeCheckoutAttemptSnapshot,
    type StripeCheckoutAttemptSnapshotItem,
    serializeStripeCheckoutValue,
} from '@gredice/storage';
import type {
    CheckoutItem,
    StripeCheckoutReturnUrls,
} from '@gredice/stripe/server';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import type { CheckoutDeliverySelection } from './deliverySelection';
import {
    buildCheckoutAdditionalData,
    encodeHarvestDatesMetadata,
} from './harvestCheckout';
import { calculateSunflowerAmount } from './sunflowerCalculations';

export const stripeCheckoutAttemptMetadataKeys = {
    attemptId: 'checkoutAttemptId',
    cartId: 'checkoutCartId',
    version: 'checkoutSnapshotVersion',
} as const;

export type StripeCheckoutSessionForSnapshot = {
    amountTotal: number | null;
    customerId?: string | { id: string } | null;
    id: string;
    lineItems?: {
        data: Array<{
            amount_total?: number | null;
            price?: {
                currency?: string | null;
                product?:
                    | string
                    | {
                          deleted?: unknown;
                          metadata?: Record<string, string | undefined>;
                      }
                    | null;
                unit_amount?: number | null;
            } | null;
            quantity?: number | null;
        }>;
    } | null;
};

type SnapshotMetadata = {
    attemptId: string;
    cartId: number;
};

function parseOptionalInteger(value: string | null | undefined) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function parseOptionalString(value: string | null | undefined) {
    return value === null || value === undefined || value === '' ? null : value;
}

function outletMetadataMatchesSnapshot(
    metadata: Record<string, string | undefined>,
    outlet: StripeCheckoutAttemptSnapshotItem['outlet'],
) {
    if (!outlet) {
        return (
            parseOptionalInteger(metadata.outletOfferId) === null &&
            parseOptionalInteger(metadata.outletReservationId) === null &&
            parseOptionalString(metadata.outletSowingDate) === null &&
            parseOptionalString(metadata.outletInitialPlantStatus) === null &&
            parseOptionalInteger(metadata.outletPriceCents) === null &&
            parseOptionalInteger(metadata.outletComparePriceCents) === null
        );
    }
    return (
        parseOptionalInteger(metadata.outletOfferId) === outlet.offerId &&
        parseOptionalInteger(metadata.outletReservationId) ===
            outlet.reservationId &&
        metadata.outletSowingDate === outlet.sowingDate &&
        metadata.outletInitialPlantStatus === outlet.initialPlantStatus &&
        parseOptionalInteger(metadata.outletPriceCents) === outlet.priceCents &&
        parseOptionalInteger(metadata.outletComparePriceCents) ===
            outlet.comparePriceCents
    );
}

function getPaymentKind(item: ShoppingCartItemWithShopData) {
    if (item.status === 'paid') {
        return 'paid' as const;
    }
    if (item.currency === 'eur') {
        return 'stripe' as const;
    }
    if (item.currency === 'sunflower') {
        return 'sunflower' as const;
    }
    if (item.currency === 'inventory' || item.usesInventory) {
        return 'inventory' as const;
    }
    throw new StripeCheckoutAttemptConflictError(
        'unsupported_payment_currency',
    );
}

function getPaymentAmount(
    item: ShoppingCartItemWithShopData,
    paymentKind: StripeCheckoutAttemptSnapshotItem['paymentKind'],
) {
    if (paymentKind === 'stripe') {
        const price =
            typeof item.shopData.discountPrice === 'number'
                ? item.shopData.discountPrice
                : item.shopData.price;
        const cents = typeof price === 'number' ? Math.round(price * 100) : 0;
        if (!Number.isSafeInteger(cents) || cents <= 0) {
            throw new StripeCheckoutAttemptConflictError(
                'stripe_amount_invalid',
            );
        }
        return cents;
    }
    if (paymentKind === 'sunflower') {
        const amount = calculateSunflowerAmount(item);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            throw new StripeCheckoutAttemptConflictError(
                'sunflower_amount_invalid',
            );
        }
        return amount;
    }
    return 0;
}

export function buildStripeCheckoutAttemptSnapshot({
    advancedSowingAuthorizationsByCartItemId,
    cartId,
    checkoutAdditionalDataByCartItemId,
    customerId,
    expiresAt,
    harvestDates,
    items,
    returnUrls,
    userId,
}: {
    advancedSowingAuthorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >;
    cartId: number;
    checkoutAdditionalDataByCartItemId: ReadonlyMap<number, unknown>;
    customerId: string;
    expiresAt?: Date;
    harvestDates: readonly {
        cartItemId: number;
        scheduledDate: string;
    }[];
    items: readonly ShoppingCartItemWithShopData[];
    returnUrls: StripeCheckoutReturnUrls;
    userId: string;
}): StripeCheckoutAttemptSnapshot {
    const snapshotItems = items.map((item) => {
        const paymentKind = getPaymentKind(item);
        const advancedSowingAuthorization =
            advancedSowingAuthorizationsByCartItemId.get(item.id);
        return {
            ...(advancedSowingAuthorization
                ? { advancedSowingAuthorization }
                : {}),
            additionalDataFingerprint: fingerprintStripeCheckoutValue(
                item.additionalData,
            ),
            amount: item.amount,
            cartId: item.cartId,
            checkoutAdditionalDataFingerprint: fingerprintStripeCheckoutValue(
                checkoutAdditionalDataByCartItemId.get(item.id) ?? {},
            ),
            currency: item.currency,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            gardenId: item.gardenId,
            id: item.id,
            ...(item.outlet
                ? {
                      outlet: {
                          comparePriceCents:
                              typeof item.outlet.comparePrice === 'number'
                                  ? Math.round(item.outlet.comparePrice * 100)
                                  : null,
                          initialPlantStatus: item.outlet.initialPlantStatus,
                          offerId: item.outlet.offerId,
                          priceCents: Math.round(item.outlet.outletPrice * 100),
                          reservationId: item.outlet.reservationId,
                          sowingDate: item.outlet.sowingDate.toISOString(),
                      },
                  }
                : {}),
            paymentAmount: getPaymentAmount(item, paymentKind),
            paymentKind,
            positionIndex: item.positionIndex,
            raisedBedId: item.raisedBedId,
            status: item.status === 'paid' ? 'paid' : 'new',
        } satisfies StripeCheckoutAttemptSnapshotItem;
    });
    return {
        attemptId: randomUUID(),
        cartId,
        expectedNonStripeCartItemIds: snapshotItems.flatMap((item) =>
            item.paymentKind === 'sunflower' || item.paymentKind === 'inventory'
                ? [item.id]
                : [],
        ),
        harvestDates: harvestDates.map((selection) => ({ ...selection })),
        items: snapshotItems,
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue(customerId),
            expiresAt: expiresAt?.toISOString() ?? null,
            items: items.flatMap((item) => {
                const snapshotItem = snapshotItems.find(
                    (candidate) => candidate.id === item.id,
                );
                if (snapshotItem?.paymentKind !== 'stripe') {
                    return [];
                }
                const name = item.shopData.name;
                if (!name) {
                    throw new StripeCheckoutAttemptConflictError(
                        'stripe_item_name_invalid',
                    );
                }
                const imageUrls = item.shopData.image
                    ? [
                          /^https?:\/\//u.test(item.shopData.image)
                              ? item.shopData.image
                              : `https://www.gredice.com${item.shopData.image}`,
                      ]
                    : undefined;
                return [
                    {
                        cartItemId: item.id,
                        price: {
                            currency: 'eur' as const,
                            valueInCents: snapshotItem.paymentAmount,
                        },
                        product: {
                            ...(item.shopData.description
                                ? { description: item.shopData.description }
                                : {}),
                            ...(imageUrls ? { imageUrls } : {}),
                            name,
                        },
                        quantity: item.amount,
                    },
                ];
            }),
            returnUrls,
        },
        userFingerprint: fingerprintStripeCheckoutValue(userId),
        version: 1,
    };
}

export function encodeStripeCheckoutAttemptMetadata(
    snapshot: StripeCheckoutAttemptSnapshot,
) {
    return {
        [stripeCheckoutAttemptMetadataKeys.attemptId]: snapshot.attemptId,
        [stripeCheckoutAttemptMetadataKeys.cartId]: snapshot.cartId,
        [stripeCheckoutAttemptMetadataKeys.version]: snapshot.version,
    };
}

export function decodeStripeCheckoutAttemptMetadata(
    metadata: Record<string, string> | null | undefined,
): SnapshotMetadata | null {
    const attemptId = metadata?.[stripeCheckoutAttemptMetadataKeys.attemptId];
    const cartIdValue = metadata?.[stripeCheckoutAttemptMetadataKeys.cartId];
    const version = metadata?.[stripeCheckoutAttemptMetadataKeys.version];
    if (!attemptId && !cartIdValue && !version) {
        return null;
    }
    const cartId = Number(cartIdValue);
    if (
        !attemptId ||
        !Number.isSafeInteger(cartId) ||
        cartId <= 0 ||
        version !== '1'
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'session_metadata_invalid',
        );
    }
    return { attemptId, cartId };
}

function parseProductAdditionalData(value: string | undefined) {
    try {
        return value ? JSON.parse(value) : {};
    } catch {
        throw new StripeCheckoutAttemptConflictError(
            'stripe_additional_data_invalid',
        );
    }
}

export function buildStripeCheckoutReplayInput({
    accountId,
    attempt,
    checkoutAdditionalDataByCartItemId,
    customerId,
    userId,
}: {
    accountId: string;
    attempt: StripeCheckoutAttempt;
    checkoutAdditionalDataByCartItemId: ReadonlyMap<number, unknown>;
    customerId: string;
    userId: string;
}) {
    if (
        fingerprintStripeCheckoutValue(customerId) !==
            attempt.snapshot.stripeSession.customerFingerprint ||
        fingerprintStripeCheckoutValue(userId) !==
            attempt.snapshot.userFingerprint
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'checkout_identity_changed',
        );
    }
    for (const item of attempt.snapshot.items) {
        if (
            fingerprintStripeCheckoutValue(
                checkoutAdditionalDataByCartItemId.get(item.id) ?? {},
            ) !== item.checkoutAdditionalDataFingerprint
        ) {
            throw new StripeCheckoutAttemptConflictError(
                'checkout_additional_data_changed',
            );
        }
    }

    const items: CheckoutItem[] = attempt.snapshot.stripeSession.items.map(
        (sessionItem) => {
            const item = attempt.snapshot.items.find(
                (candidate) => candidate.id === sessionItem.cartItemId,
            );
            if (item?.paymentKind !== 'stripe') {
                throw new StripeCheckoutAttemptConflictError(
                    'stripe_membership_changed',
                );
            }
            return {
                price: { ...sessionItem.price },
                product: {
                    ...sessionItem.product,
                    metadata: {
                        accountId,
                        additionalData: serializeStripeCheckoutValue(
                            checkoutAdditionalDataByCartItemId.get(item.id) ??
                                {},
                        ),
                        cartId: attempt.snapshot.cartId,
                        cartItemId: item.id.toString(),
                        entityId: item.entityId,
                        entityTypeName: item.entityTypeName,
                        gardenId: item.gardenId,
                        outletComparePriceCents:
                            item.outlet?.comparePriceCents ?? null,
                        outletInitialPlantStatus:
                            item.outlet?.initialPlantStatus ?? null,
                        outletOfferId: item.outlet?.offerId ?? null,
                        outletPriceCents: item.outlet?.priceCents ?? null,
                        outletReservationId: item.outlet?.reservationId ?? null,
                        outletSowingDate: item.outlet?.sowingDate ?? null,
                        positionIndex: item.positionIndex?.toString() ?? null,
                        raisedBedId: item.raisedBedId,
                        userId,
                    },
                },
                quantity: sessionItem.quantity,
            };
        },
    );
    return {
        data: {
            allowPromotionCodes:
                attempt.snapshot.stripeSession.allowPromotionCodes,
            ...(attempt.snapshot.stripeSession.expiresAt
                ? {
                      expiresAt: new Date(
                          attempt.snapshot.stripeSession.expiresAt,
                      ),
                  }
                : {}),
            items,
            metadata: {
                ...encodeHarvestDatesMetadata(
                    attempt.snapshot.harvestDates,
                    attempt.snapshot.expectedNonStripeCartItemIds,
                ),
                ...encodeStripeCheckoutAttemptMetadata(attempt.snapshot),
            },
        },
        options: {
            customerId,
            idempotencyKey: attempt.snapshot.attemptId,
            returnUrls: attempt.snapshot.stripeSession.returnUrls,
        },
    };
}

export function rebuildStripeCheckoutAttemptAdditionalData({
    attempt,
    deliveryInfo,
    liveItems,
}: {
    attempt: StripeCheckoutAttempt;
    deliveryInfo?: CheckoutDeliverySelection;
    liveItems: readonly { additionalData: string | null; id: number }[];
}) {
    const liveItemsById = new Map(liveItems.map((item) => [item.id, item]));
    const harvestDates = getStripeCheckoutSnapshotHarvestDates(attempt);
    const result = new Map<number, unknown>();
    for (const item of attempt.snapshot.items) {
        const live = liveItemsById.get(item.id);
        if (!live) {
            throw new StripeCheckoutAttemptConflictError(
                'cart_membership_changed',
            );
        }
        const additionalData =
            item.paymentKind === 'paid'
                ? {}
                : buildCheckoutAdditionalData({
                      additionalData: live.additionalData,
                      deliveryInfo,
                      scheduledHarvestDate: harvestDates.get(item.id),
                  });
        if (
            fingerprintStripeCheckoutValue(additionalData) !==
            item.checkoutAdditionalDataFingerprint
        ) {
            throw new StripeCheckoutAttemptConflictError(
                'checkout_additional_data_changed',
            );
        }
        result.set(item.id, additionalData);
    }
    return result;
}

export function assertStripeSessionMatchesCheckoutAttempt(
    session: StripeCheckoutSessionForSnapshot,
    attempt: StripeCheckoutAttempt,
    { accountId, userId }: { accountId: string; userId: string },
) {
    const sessionCustomerId =
        typeof session.customerId === 'string'
            ? session.customerId
            : session.customerId?.id;
    if (
        !sessionCustomerId ||
        fingerprintStripeCheckoutValue(sessionCustomerId) !==
            attempt.snapshot.stripeSession.customerFingerprint
    ) {
        throw new StripeCheckoutAttemptConflictError('stripe_customer_changed');
    }
    const expectedStripeItems = attempt.snapshot.items.filter(
        (item) => item.paymentKind === 'stripe',
    );
    const expectedById = new Map(
        expectedStripeItems.map((item) => [item.id, item]),
    );
    const seen = new Set<number>();
    let lineAmountTotal = 0;

    for (const lineItem of session.lineItems?.data ?? []) {
        const product = lineItem.price?.product;
        if (typeof product === 'string' || product?.deleted) {
            throw new StripeCheckoutAttemptConflictError(
                'stripe_product_unavailable',
            );
        }
        const productMetadata = product?.metadata ?? {};
        const cartItemId = Number(productMetadata.cartItemId);
        const expected = expectedById.get(cartItemId);
        if (!expected || seen.has(cartItemId)) {
            throw new StripeCheckoutAttemptConflictError(
                'stripe_membership_changed',
            );
        }
        seen.add(cartItemId);
        const lineAmount = lineItem.amount_total;
        const unitAmount = lineItem.price?.unit_amount;
        if (
            lineItem.quantity !== expected.amount ||
            lineItem.price?.currency !== 'eur' ||
            unitAmount !== expected.paymentAmount ||
            typeof lineAmount !== 'number' ||
            !Number.isSafeInteger(lineAmount) ||
            lineAmount < 0 ||
            lineAmount > expected.paymentAmount * expected.amount ||
            productMetadata.accountId !== accountId ||
            productMetadata.userId !== userId ||
            Number(productMetadata.cartId) !== attempt.snapshot.cartId ||
            productMetadata.entityId !== expected.entityId ||
            productMetadata.entityTypeName !== expected.entityTypeName ||
            parseOptionalInteger(productMetadata.gardenId) !==
                expected.gardenId ||
            parseOptionalInteger(productMetadata.raisedBedId) !==
                expected.raisedBedId ||
            parseOptionalInteger(productMetadata.positionIndex) !==
                expected.positionIndex ||
            !outletMetadataMatchesSnapshot(productMetadata, expected.outlet) ||
            fingerprintStripeCheckoutValue(
                parseProductAdditionalData(productMetadata.additionalData),
            ) !== expected.checkoutAdditionalDataFingerprint
        ) {
            throw new StripeCheckoutAttemptConflictError('stripe_item_changed');
        }
        lineAmountTotal += lineAmount;
    }

    if (
        seen.size !== expectedStripeItems.length ||
        lineAmountTotal !== session.amountTotal
    ) {
        throw new StripeCheckoutAttemptConflictError(
            seen.size !== expectedStripeItems.length
                ? 'stripe_membership_changed'
                : 'stripe_total_changed',
        );
    }
}

export function getStripeCheckoutSnapshotNonStripeAmounts(
    attempt: StripeCheckoutAttempt,
) {
    return new Map(
        attempt.snapshot.items.flatMap((item) =>
            item.paymentKind === 'sunflower'
                ? [[item.id, item.paymentAmount] as const]
                : [],
        ),
    );
}

export function getStripeCheckoutSnapshotNonStripePaymentKinds(
    attempt: StripeCheckoutAttempt,
) {
    return new Map(
        attempt.snapshot.items.flatMap((item) =>
            item.paymentKind === 'sunflower' || item.paymentKind === 'inventory'
                ? [[item.id, item.paymentKind] as const]
                : [],
        ),
    );
}

export function getStripeCheckoutSnapshotAdvancedSowingAuthorizations(
    attempt: StripeCheckoutAttempt,
) {
    return new Map(
        attempt.snapshot.items.flatMap((item) =>
            item.advancedSowingAuthorization
                ? [[item.id, item.advancedSowingAuthorization] as const]
                : [],
        ),
    );
}

function parseCheckoutDeliverySelection(
    value: unknown,
): CheckoutDeliverySelection | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const slotId = Reflect.get(value, 'slotId');
    const mode = Reflect.get(value, 'mode');
    const addressId = Reflect.get(value, 'addressId');
    const locationId = Reflect.get(value, 'locationId');
    const notes = Reflect.get(value, 'notes');
    if (
        !Number.isSafeInteger(slotId) ||
        (mode !== 'delivery' && mode !== 'pickup') ||
        (addressId !== undefined && !Number.isSafeInteger(addressId)) ||
        (locationId !== undefined && !Number.isSafeInteger(locationId)) ||
        (notes !== undefined && typeof notes !== 'string')
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'stripe_delivery_data_invalid',
        );
    }
    return {
        ...(typeof addressId === 'number' ? { addressId } : {}),
        ...(typeof locationId === 'number' ? { locationId } : {}),
        mode,
        ...(typeof notes === 'string' ? { notes } : {}),
        slotId,
    };
}

export function buildVerifiedStripeCheckoutAdditionalData({
    attempt,
    liveItems,
    session,
}: {
    attempt: StripeCheckoutAttempt;
    liveItems: readonly { additionalData: string | null; id: number }[];
    session: StripeCheckoutSessionForSnapshot;
}) {
    const stripeAdditionalDataByCartItemId = new Map<number, unknown>();
    const deliverySelections = new Map<string, CheckoutDeliverySelection>();
    for (const lineItem of session.lineItems?.data ?? []) {
        const product = lineItem.price?.product;
        if (typeof product === 'string' || product?.deleted) {
            continue;
        }
        const cartItemId = Number(product?.metadata?.cartItemId);
        if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
            continue;
        }
        const additionalData = parseProductAdditionalData(
            product?.metadata?.additionalData,
        );
        stripeAdditionalDataByCartItemId.set(cartItemId, additionalData);
        if (
            additionalData &&
            typeof additionalData === 'object' &&
            !Array.isArray(additionalData)
        ) {
            const delivery = parseCheckoutDeliverySelection(
                Reflect.get(additionalData, 'delivery'),
            );
            if (delivery) {
                deliverySelections.set(
                    fingerprintStripeCheckoutValue(delivery),
                    delivery,
                );
            }
        }
    }
    if (deliverySelections.size > 1) {
        throw new StripeCheckoutAttemptConflictError(
            'stripe_delivery_data_changed',
        );
    }
    const deliveryInfo = deliverySelections.values().next().value;
    const liveItemsById = new Map(liveItems.map((item) => [item.id, item]));
    const harvestDates = getStripeCheckoutSnapshotHarvestDates(attempt);
    const verified = new Map<number, unknown>();
    for (const item of attempt.snapshot.items) {
        const live = liveItemsById.get(item.id);
        if (!live) {
            throw new StripeCheckoutAttemptConflictError(
                'cart_membership_changed',
            );
        }
        const additionalData =
            item.paymentKind === 'stripe'
                ? stripeAdditionalDataByCartItemId.get(item.id)
                : item.paymentKind === 'paid'
                  ? {}
                  : buildCheckoutAdditionalData({
                        additionalData: live.additionalData,
                        deliveryInfo,
                        scheduledHarvestDate: harvestDates.get(item.id),
                    });
        if (
            fingerprintStripeCheckoutValue(additionalData ?? {}) !==
            item.checkoutAdditionalDataFingerprint
        ) {
            throw new StripeCheckoutAttemptConflictError(
                'checkout_additional_data_changed',
            );
        }
        verified.set(item.id, additionalData ?? {});
    }
    return verified;
}

export function getStripeCheckoutSnapshotHarvestDates(
    attempt: StripeCheckoutAttempt,
) {
    return new Map(
        attempt.snapshot.harvestDates.map((selection) => [
            selection.cartItemId,
            selection.scheduledDate,
        ]),
    );
}
