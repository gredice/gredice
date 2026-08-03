import { randomUUID } from 'node:crypto';
import {
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
    type StripeCheckoutAttemptSnapshot,
    type StripeCheckoutAttemptSnapshotItem,
} from '@gredice/storage';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import { calculateSunflowerAmount } from './sunflowerCalculations';

export const stripeCheckoutAttemptMetadataKeys = {
    attemptId: 'checkoutAttemptId',
    cartId: 'checkoutCartId',
    version: 'checkoutSnapshotVersion',
} as const;

export type StripeCheckoutSessionForSnapshot = {
    amountTotal: number | null;
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

function normalizedJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(normalizedJson).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(
                ([key, entry]) =>
                    `${JSON.stringify(key)}:${normalizedJson(entry)}`,
            )
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

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
    accountId,
    cartId,
    checkoutAdditionalDataByCartItemId,
    harvestDates,
    items,
    userId,
}: {
    accountId: string;
    cartId: number;
    checkoutAdditionalDataByCartItemId: ReadonlyMap<number, unknown>;
    harvestDates: readonly {
        cartItemId: number;
        scheduledDate: string;
    }[];
    items: readonly ShoppingCartItemWithShopData[];
    userId: string;
}): StripeCheckoutAttemptSnapshot {
    const snapshotItems = items.map((item) => {
        const paymentKind = getPaymentKind(item);
        return {
            additionalData: item.additionalData,
            amount: item.amount,
            cartId: item.cartId,
            checkoutAdditionalData:
                checkoutAdditionalDataByCartItemId.get(item.id) ?? {},
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
        accountId,
        attemptId: randomUUID(),
        cartId,
        expectedNonStripeCartItemIds: snapshotItems.flatMap((item) =>
            item.paymentKind === 'sunflower' || item.paymentKind === 'inventory'
                ? [item.id]
                : [],
        ),
        harvestDates: harvestDates.map((selection) => ({ ...selection })),
        items: snapshotItems,
        userId,
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

export function assertStripeSessionMatchesCheckoutAttempt(
    session: StripeCheckoutSessionForSnapshot,
    attempt: StripeCheckoutAttempt,
) {
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
            productMetadata.accountId !== attempt.snapshot.accountId ||
            productMetadata.userId !== attempt.snapshot.userId ||
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
            normalizedJson(
                parseProductAdditionalData(productMetadata.additionalData),
            ) !== normalizedJson(expected.checkoutAdditionalData)
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

export function getStripeCheckoutSnapshotAdditionalData(
    attempt: StripeCheckoutAttempt,
) {
    return new Map(
        attempt.snapshot.items.map((item) => [
            item.id,
            item.checkoutAdditionalData,
        ]),
    );
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
