import {
    fiscalizeReceipt,
    issueReceiptForPaidInvoice,
} from '@gredice/fiscalization/server';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    notifyCheckoutFulfillmentIncident,
    notifyPurchase,
} from '@gredice/notifications';
import {
    type CheckoutPlantingRaisedBedActivation,
    consumeInventoryItem,
    convertOutletReservationForCartItem,
    createEvent,
    createNotificationWithStatus,
    createTransaction,
    deliverNotificationOperatorAlert,
    earnSunflowersForPayment,
    ensureInvoiceForTransaction,
    getCheckoutFulfillmentStartedCartItemIds,
    getCheckoutOperationMapping,
    getCheckoutOperationMappings,
    getCompletedTransactionByStripePaymentId,
    getDefaultShoppingCartScheduledDate,
    getOrCreateCheckoutOperation,
    getOrCreateDeliveryRequest,
    getOutletOfferReservationForCartItem,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    getSunflowerPackageByCode,
    getUser,
    hasMatchingCheckoutPlantingPurchase,
    type InvoiceForTransactionLineItem,
    isCartItemDeliverable,
    knownEvents,
    lockAndActivateRaisedBedForCheckoutPlanting,
    lockShoppingCartForCheckout,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    processReferralRewardsForAccount,
    SunflowerPackageAlreadyPurchasedError,
    setCartItemPaid,
    spendSunflowersBatch,
    sunflowerPackageEntityTypeName,
    topUpSunflowerPackage,
    upsertRaisedBedField,
    withCheckoutCartItemLock,
    withCheckoutCartItemLocks,
    withCheckoutCartItemProcessingLock,
    withCheckoutCartItemProcessingLocks,
    withInventoryAccountTransaction,
    withPlantingScheduleTaskTransaction,
    withStripePaymentProcessingLock,
} from '@gredice/storage';
import { getStripeCheckoutSession } from '@gredice/stripe/server';
import { isBillingAutomationEnabled } from '../billing/automationFlag';
import { notifyBillingDocumentsEmail } from '../billing/billingDocumentEmail';
import {
    buildCheckoutInvoiceBillingSnapshot,
    buildCheckoutInvoiceLineItem,
} from '../billing/checkoutInvoiceDraft';
import {
    getCartInfo,
    type ShoppingCartItemWithShopData,
} from '../checkout/cartInfo';
import { assertCheckoutCartItemSnapshot } from '../checkout/checkoutRecovery';
import {
    decodeExpectedNonStripeCartItemIdsMetadata,
    decodeHarvestDatesMetadata,
} from '../checkout/harvestCheckout';
import {
    buildOrderConfirmationItems,
    notifyOrderConfirmationEmail,
} from '../checkout/orderConfirmationEmail';
import {
    calculateSunflowerAmount,
    calculateSunflowerReplayAmount,
} from '../checkout/sunflowerCalculations';
import { getPostHogClient } from '../posthog-server';

export type ProcessCheckoutSessionDependencies = {
    isRaisedBedAbandoned: typeof isRaisedBedAbandoned;
    notifyCheckoutFulfillmentIncident: typeof notifyCheckoutFulfillmentIncident;
    notifyPurchase: typeof notifyPurchase;
    consumeInventoryItem: typeof consumeInventoryItem;
    convertOutletReservationForCartItem: typeof convertOutletReservationForCartItem;
    getOrCreateDeliveryRequest: typeof getOrCreateDeliveryRequest;
    createEvent: typeof createEvent;
    createNotificationWithStatus: typeof createNotificationWithStatus;
    getOrCreateCheckoutOperation: typeof getOrCreateCheckoutOperation;
    createTransaction: typeof createTransaction;
    deliverNotificationOperatorAlert: typeof deliverNotificationOperatorAlert;
    earnSunflowersForPayment: typeof earnSunflowersForPayment;
    ensureInvoiceForTransaction: typeof ensureInvoiceForTransaction;
    getSunflowerPackageByCode: typeof getSunflowerPackageByCode;
    getCompletedTransactionByStripePaymentId: typeof getCompletedTransactionByStripePaymentId;
    getCheckoutFulfillmentStartedCartItemIds: typeof getCheckoutFulfillmentStartedCartItemIds;
    getCheckoutOperationMapping: typeof getCheckoutOperationMapping;
    getCheckoutOperationMappings: typeof getCheckoutOperationMappings;
    hasMatchingCheckoutPlantingPurchase: typeof hasMatchingCheckoutPlantingPurchase;
    getDefaultShoppingCartScheduledDate: typeof getDefaultShoppingCartScheduledDate;
    getOutletOfferReservationForCartItem: typeof getOutletOfferReservationForCartItem;
    getRaisedBed: typeof getRaisedBed;
    getRaisedBedFieldsWithEvents: typeof getRaisedBedFieldsWithEvents;
    getShoppingCart: typeof getShoppingCart;
    getUser: typeof getUser;
    isCartItemDeliverable: typeof isCartItemDeliverable;
    knownEvents: typeof knownEvents;
    lockAndActivateRaisedBedForCheckoutPlanting: typeof lockAndActivateRaisedBedForCheckoutPlanting;
    lockShoppingCartForCheckout: typeof lockShoppingCartForCheckout;
    markCartPaidIfAllItemsPaid: typeof markCartPaidIfAllItemsPaid;
    normalizeShoppingCartInventoryUsage: typeof normalizeShoppingCartInventoryUsage;
    normalizeShoppingCartScheduledDates: typeof normalizeShoppingCartScheduledDates;
    processReferralRewardsForAccount: typeof processReferralRewardsForAccount;
    setCartItemPaid: typeof setCartItemPaid;
    spendSunflowersBatch: typeof spendSunflowersBatch;
    topUpSunflowerPackage: typeof topUpSunflowerPackage;
    upsertRaisedBedField: typeof upsertRaisedBedField;
    withPlantingScheduleTaskTransaction: typeof withPlantingScheduleTaskTransaction;
    withCheckoutCartItemLock: typeof withCheckoutCartItemLock;
    withCheckoutCartItemLocks: typeof withCheckoutCartItemLocks;
    withCheckoutCartItemProcessingLock: typeof withCheckoutCartItemProcessingLock;
    withCheckoutCartItemProcessingLocks: typeof withCheckoutCartItemProcessingLocks;
    withInventoryAccountTransaction: typeof withInventoryAccountTransaction;
    withStripePaymentProcessingLock: typeof withStripePaymentProcessingLock;
    getStripeCheckoutSession: typeof getStripeCheckoutSession;
    isBillingAutomationEnabled: typeof isBillingAutomationEnabled;
    buildCheckoutInvoiceBillingSnapshot: typeof buildCheckoutInvoiceBillingSnapshot;
    buildCheckoutInvoiceLineItem: typeof buildCheckoutInvoiceLineItem;
    getCartInfo: typeof getCartInfo;
    calculateSunflowerAmount: typeof calculateSunflowerAmount;
    buildOrderConfirmationItems: typeof buildOrderConfirmationItems;
    notifyOrderConfirmationEmail: typeof notifyOrderConfirmationEmail;
    getPostHogClient: typeof getPostHogClient;
    issueReceiptForPaidInvoice: typeof issueReceiptForPaidInvoice;
    fiscalizeReceipt: typeof fiscalizeReceipt;
    notifyBillingDocumentsEmail: typeof notifyBillingDocumentsEmail;
};

const realDependencies: ProcessCheckoutSessionDependencies = {
    isRaisedBedAbandoned,
    notifyCheckoutFulfillmentIncident,
    notifyPurchase,
    consumeInventoryItem,
    convertOutletReservationForCartItem,
    getOrCreateDeliveryRequest,
    createEvent,
    createNotificationWithStatus,
    getOrCreateCheckoutOperation,
    createTransaction,
    deliverNotificationOperatorAlert,
    earnSunflowersForPayment,
    ensureInvoiceForTransaction,
    getSunflowerPackageByCode,
    getCompletedTransactionByStripePaymentId,
    getCheckoutFulfillmentStartedCartItemIds,
    getCheckoutOperationMapping,
    getCheckoutOperationMappings,
    hasMatchingCheckoutPlantingPurchase,
    getDefaultShoppingCartScheduledDate,
    getOutletOfferReservationForCartItem,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    getUser,
    isCartItemDeliverable,
    knownEvents,
    lockAndActivateRaisedBedForCheckoutPlanting,
    lockShoppingCartForCheckout,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    processReferralRewardsForAccount,
    setCartItemPaid,
    spendSunflowersBatch,
    topUpSunflowerPackage,
    upsertRaisedBedField,
    withPlantingScheduleTaskTransaction,
    withCheckoutCartItemLock,
    withCheckoutCartItemLocks,
    withCheckoutCartItemProcessingLock,
    withCheckoutCartItemProcessingLocks,
    withInventoryAccountTransaction,
    withStripePaymentProcessingLock,
    getStripeCheckoutSession,
    isBillingAutomationEnabled,
    buildCheckoutInvoiceBillingSnapshot,
    buildCheckoutInvoiceLineItem,
    getCartInfo,
    calculateSunflowerAmount,
    buildOrderConfirmationItems,
    notifyOrderConfirmationEmail,
    getPostHogClient,
    issueReceiptForPaidInvoice,
    fiscalizeReceipt,
    notifyBillingDocumentsEmail,
};

/**
 * Recursively sorts object keys for deterministic JSON serialization.
 * Handles nested objects and arrays to ensure consistent comparison.
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    return Object.keys(obj)
        .sort()
        .reduce((result: Record<string, unknown>, key) => {
            result[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
            return result;
        }, {});
}

function parseShoppingCartItemAdditionalData(
    value: string | null | undefined,
): object {
    if (!value) {
        return {};
    }
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Shopping cart item additional data must be an object');
    }
    return parsed;
}

type CheckoutDeliveryInfo = {
    addressId?: number;
    locationId?: number;
    mode: 'delivery' | 'pickup';
    notes?: string;
    slotId: number;
};

function checkoutDeliveryInfoFromAdditionalData(
    additionalData: unknown,
): CheckoutDeliveryInfo | null {
    if (
        !additionalData ||
        typeof additionalData !== 'object' ||
        !('delivery' in additionalData)
    ) {
        return null;
    }
    const delivery = additionalData.delivery;
    if (!delivery || typeof delivery !== 'object') {
        return null;
    }
    const value = delivery as Record<string, unknown>;
    if (
        typeof value.slotId !== 'number' ||
        !Number.isSafeInteger(value.slotId) ||
        (value.mode !== 'delivery' && value.mode !== 'pickup') ||
        (value.addressId !== undefined &&
            !Number.isSafeInteger(value.addressId)) ||
        (value.locationId !== undefined &&
            !Number.isSafeInteger(value.locationId)) ||
        (value.notes !== undefined && typeof value.notes !== 'string')
    ) {
        return null;
    }
    return {
        addressId:
            typeof value.addressId === 'number' ? value.addressId : undefined,
        locationId:
            typeof value.locationId === 'number' ? value.locationId : undefined,
        mode: value.mode,
        notes: typeof value.notes === 'string' ? value.notes : undefined,
        slotId: value.slotId,
    };
}

function checkoutDeliveryProvenance(deliveryInfo: CheckoutDeliveryInfo | null) {
    return deliveryInfo
        ? {
              addressId: deliveryInfo.addressId ?? null,
              locationId: deliveryInfo.locationId ?? null,
              mode: deliveryInfo.mode,
              notes: deliveryInfo.notes ?? null,
              slotId: deliveryInfo.slotId,
          }
        : null;
}

function checkoutDeliveryInfoFromProvenance(
    provenance: NonNullable<
        NonNullable<
            Awaited<ReturnType<typeof getCheckoutOperationMapping>>
        >['delivery']
    > | null,
): CheckoutDeliveryInfo | null {
    return provenance
        ? {
              addressId: provenance.addressId ?? undefined,
              locationId: provenance.locationId ?? undefined,
              mode: provenance.mode,
              notes: provenance.notes ?? undefined,
              slotId: provenance.slotId,
          }
        : null;
}

type PaidCheckoutSession = NonNullable<
    Awaited<ReturnType<typeof getStripeCheckoutSession>>
>;
type StripeCheckoutLineItem = PaidCheckoutSession['lineItems']['data'][number];

type SunflowerPackageCheckoutLineItem = {
    lineItemId: string;
    productName: string | null;
    amountTotal: number;
    quantity: number;
    accountId: string;
    userId: string;
    entityId: number;
    entityTypeName: string;
    packageCode: string;
    packageRole: string;
    sunflowers: number;
    baseSunflowers: number;
    bonusSunflowers: number;
    priceCents: number;
    currency: string;
};

function readMetadataString(
    metadata: Record<string, unknown> | undefined,
    key: string,
) {
    const value = metadata?.[key];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}

function readMetadataInteger(
    metadata: Record<string, unknown> | undefined,
    key: string,
) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string' && /^\d+$/u.test(value.trim())) {
        return Number.parseInt(value.trim(), 10);
    }
    return null;
}

function parseSunflowerPackageCheckoutLineItem(
    item: StripeCheckoutLineItem,
): SunflowerPackageCheckoutLineItem | null {
    const product = item.price?.product;
    if (typeof product === 'string' || product?.deleted) {
        return null;
    }

    const metadata = product?.metadata;
    if (metadata?.kind !== 'sunflowerPackage') {
        return null;
    }

    const accountId = readMetadataString(metadata, 'accountId');
    const userId = readMetadataString(metadata, 'userId');
    const entityTypeName = readMetadataString(metadata, 'entityTypeName');
    const packageCode = readMetadataString(metadata, 'packageCode');
    const packageRole = readMetadataString(metadata, 'packageRole');
    const currency = readMetadataString(metadata, 'currency');
    const entityId = readMetadataInteger(metadata, 'entityId');
    const sunflowers = readMetadataInteger(metadata, 'sunflowers');
    const baseSunflowers = readMetadataInteger(metadata, 'baseSunflowers');
    const bonusSunflowers = readMetadataInteger(metadata, 'bonusSunflowers');
    const priceCents = readMetadataInteger(metadata, 'priceCents');

    if (
        !accountId ||
        !userId ||
        !entityTypeName ||
        !packageCode ||
        !packageRole ||
        !currency ||
        entityId === null ||
        sunflowers === null ||
        baseSunflowers === null ||
        bonusSunflowers === null ||
        priceCents === null ||
        typeof item.amount_total !== 'number'
    ) {
        return null;
    }

    return {
        lineItemId: item.id,
        productName: typeof product?.name === 'string' ? product.name : null,
        amountTotal: item.amount_total,
        quantity: item.quantity ?? 1,
        accountId,
        userId,
        entityId,
        entityTypeName,
        packageCode,
        packageRole,
        sunflowers,
        baseSunflowers,
        bonusSunflowers,
        priceCents,
        currency,
    };
}

function hasSunflowerPackageCheckoutMetadata(item: StripeCheckoutLineItem) {
    const product = item.price?.product;
    if (typeof product === 'string' || product?.deleted) {
        return false;
    }
    return product?.metadata?.kind === 'sunflowerPackage';
}

function getSunflowerPackageCheckoutLineItems(session: PaidCheckoutSession) {
    const packageLineItems = (session.lineItems?.data ?? []).filter(
        hasSunflowerPackageCheckoutMetadata,
    );
    const items = packageLineItems
        .map(parseSunflowerPackageCheckoutLineItem)
        .filter((item) => item !== null);
    return {
        items,
        malformedCount: packageLineItems.length - items.length,
    };
}

async function processNonStripeCartItems(
    cartId: number,
    accountId: string,
    deliveryInfo?: unknown,
    harvestDateByCartItemId = new Map<number, string>(),
    expectedNonStripeCartItemIds: ReadonlySet<number> | null = null,
    checkoutSessionId?: string | null,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
): Promise<{
    confirmationItems: ShoppingCartItemWithShopData[];
    processedItems: ShoppingCartItemWithShopData[];
    resolvedSunflowerAmountsByCartItemId: Map<number, number>;
    satisfiedExpectedItemIds: Set<number>;
}> {
    let confirmationItems: ShoppingCartItemWithShopData[] = [];
    const processedItems: ShoppingCartItemWithShopData[] = [];
    const resolvedSunflowerAmountsByCartItemId = new Map<number, number>();
    const satisfiedExpectedItemIds = new Set<number>();
    const inventoryNormalizedCart =
        await dependencies.normalizeShoppingCartInventoryUsage(cartId);
    if (!inventoryNormalizedCart) {
        const message = `No cart found for ID ${cartId} when processing non-stripe items.`;
        if (expectedNonStripeCartItemIds !== null) {
            throw new Error(message);
        }
        console.warn(message);
        return {
            confirmationItems,
            processedItems,
            resolvedSunflowerAmountsByCartItemId,
            satisfiedExpectedItemIds,
        };
    }
    const checkoutOperationMappings =
        await dependencies.getCheckoutOperationMappings(
            inventoryNormalizedCart.items
                .filter(
                    (item) =>
                        item.status !== 'paid' &&
                        item.entityTypeName === 'operation',
                )
                .map((item) => item.id),
        );
    const cart =
        (await dependencies.normalizeShoppingCartScheduledDates(
            inventoryNormalizedCart.id,
            {
                checkoutOperationMappings,
                defaultMissingScheduledDates: true,
            },
        )) ?? inventoryNormalizedCart;

    const isExpectedNonStripeItem = (item: { id: number }) =>
        expectedNonStripeCartItemIds === null ||
        expectedNonStripeCartItemIds.has(item.id);
    for (const item of cart.items) {
        if (
            item.status === 'paid' &&
            expectedNonStripeCartItemIds?.has(item.id)
        ) {
            satisfiedExpectedItemIds.add(item.id);
        }
    }

    let cartInfo = await dependencies.getCartInfo(cart.items, accountId, {
        checkoutOperationMappings,
    });
    if (!cartInfo.allowPurchase) {
        const pendingDirectItems = cart.items.filter(
            (item) =>
                item.status !== 'paid' &&
                item.currency !== 'eur' &&
                isExpectedNonStripeItem(item),
        );
        const resumableDirectCartItemIds =
            pendingDirectItems.length > 0
                ? await dependencies.getCheckoutFulfillmentStartedCartItemIds(
                      accountId,
                      pendingDirectItems,
                  )
                : new Set<number>();
        if (resumableDirectCartItemIds.size > 0) {
            cartInfo = await dependencies.getCartInfo(cart.items, accountId, {
                checkoutOperationMappings,
                resumableCartItemIds: resumableDirectCartItemIds,
            });
        }
    }
    confirmationItems = cartInfo.items.filter(
        (item) =>
            isExpectedNonStripeItem(item) &&
            (item.currency === 'sunflower' ||
                item.currency === 'inventory' ||
                item.usesInventory),
    );
    if (!cartInfo.allowPurchase) {
        const pendingExpectedItem = cart.items.find(
            (item) => item.status !== 'paid' && isExpectedNonStripeItem(item),
        );
        if (pendingExpectedItem) {
            throw new Error(
                `Cart ${cartId} failed validation when processing expected non-stripe item ${pendingExpectedItem.id.toString()}: ${cartInfo.notes.join('; ')}`,
            );
        }
        console.warn(
            `Cart ${cartId} failed validation after all expected non-stripe items were already paid: ${cartInfo.notes.join('; ')}`,
        );
    }
    for (const item of cartInfo.items) {
        if (
            expectedNonStripeCartItemIds?.has(item.id) &&
            item.status !== 'paid' &&
            item.entityTypeName === 'operation' &&
            item.entityData.attributes?.deliverable === true &&
            item.entityData.attributes.stage?.information.name === 'harvest' &&
            !harvestDateByCartItemId.has(item.id)
        ) {
            throw new Error(
                `Missing canonical harvest date for non-Stripe cart item ${item.id.toString()}`,
            );
        }
    }

    const checkoutAdditionalDataByCartItemId = new Map(
        cartInfo.items
            .filter(
                (item) =>
                    item.status !== 'paid' && isExpectedNonStripeItem(item),
            )
            .map((item) => [
                item.id,
                {
                    ...parseShoppingCartItemAdditionalData(item.additionalData),
                    ...(deliveryInfo ? { delivery: deliveryInfo } : {}),
                    ...(harvestDateByCartItemId.has(item.id)
                        ? {
                              scheduledDate: harvestDateByCartItemId.get(
                                  item.id,
                              ),
                          }
                        : {}),
                },
            ]),
    );

    const expectedSunflowerCartItemsWithShopData = cartInfo.items.filter(
        (item) =>
            item.currency === 'sunflower' && isExpectedNonStripeItem(item),
    );
    // Precompute sunflower amounts so the durable batch debit can be retried
    // without charging an already-processed item again.
    const sunflowerAmountsByItem = new Map<number, number>();

    for (const item of expectedSunflowerCartItemsWithShopData) {
        const sunflowerAmount =
            item.status === 'paid'
                ? calculateSunflowerReplayAmount(item)
                : dependencies.calculateSunflowerAmount(item);
        sunflowerAmountsByItem.set(item.id, sunflowerAmount);
    }

    if (expectedSunflowerCartItemsWithShopData.length > 0) {
        await dependencies.withCheckoutCartItemProcessingLocks(
            expectedSunflowerCartItemsWithShopData.map((item) => item.id),
            async () => {
                const { pendingItems, resolvedAmountsByItemId } =
                    await dependencies.withCheckoutCartItemLocks(
                        expectedSunflowerCartItemsWithShopData.map(
                            (item) => item.id,
                        ),
                        async (db) => {
                            const lockedCart =
                                await dependencies.lockShoppingCartForCheckout(
                                    cartId,
                                    db,
                                );
                            if (!lockedCart) {
                                throw new Error(
                                    `Cart ${cartId.toString()} disappeared before sunflower fulfillment.`,
                                );
                            }
                            if (lockedCart.accountId !== accountId) {
                                throw new Error(
                                    `Cart ${cartId.toString()} account changed before sunflower fulfillment.`,
                                );
                            }
                            const paymentStatesByCartItemId = new Map<
                                number,
                                'paid' | 'pending'
                            >();
                            for (const item of expectedSunflowerCartItemsWithShopData) {
                                const state = assertCheckoutCartItemSnapshot(
                                    lockedCart.items.find(
                                        (lockedItem) =>
                                            lockedItem.id === item.id,
                                    ),
                                    item,
                                );
                                paymentStatesByCartItemId.set(item.id, state);
                                if (
                                    state === 'paid' &&
                                    expectedNonStripeCartItemIds?.has(item.id)
                                ) {
                                    satisfiedExpectedItemIds.add(item.id);
                                }
                            }
                            const lockedPendingItems =
                                expectedSunflowerCartItemsWithShopData.filter(
                                    (item) =>
                                        paymentStatesByCartItemId.get(
                                            item.id,
                                        ) === 'pending',
                                );
                            try {
                                const spendResult =
                                    await dependencies.spendSunflowersBatch(
                                        accountId,
                                        lockedPendingItems.map((item) => ({
                                            amount:
                                                sunflowerAmountsByItem.get(
                                                    item.id,
                                                ) ?? 0,
                                            reason: `shoppingCartItem:${item.id.toString()}`,
                                        })),
                                        db,
                                        {
                                            existingCheckoutItemAmountsAreAuthoritative: true,
                                            legacyCartSpend: {
                                                reason: `shoppingCart:${cartId.toString()}`,
                                                coveredItems:
                                                    expectedSunflowerCartItemsWithShopData.map(
                                                        (item) => {
                                                            const paymentState =
                                                                paymentStatesByCartItemId.get(
                                                                    item.id,
                                                                );
                                                            if (!paymentState) {
                                                                throw new Error(
                                                                    `Sunflower cart item ${item.id.toString()} lost its payment state.`,
                                                                );
                                                            }
                                                            return {
                                                                amount:
                                                                    sunflowerAmountsByItem.get(
                                                                        item.id,
                                                                    ) ?? 0,
                                                                cartItemId:
                                                                    item.id,
                                                                createdAt:
                                                                    item.createdAt,
                                                                paymentState,
                                                                reason: `shoppingCartItem:${item.id.toString()}`,
                                                            };
                                                        },
                                                    ),
                                            },
                                        },
                                    );
                                const resolvedAmountsByItemId = new Map<
                                    number,
                                    number
                                >();
                                for (const item of expectedSunflowerCartItemsWithShopData) {
                                    const resolvedAmount =
                                        spendResult.resolvedAmountsByReason[
                                            `shoppingCartItem:${item.id.toString()}`
                                        ];
                                    if (
                                        !Number.isSafeInteger(resolvedAmount) ||
                                        resolvedAmount <= 0
                                    ) {
                                        throw new Error(
                                            `Sunflower spend for cart item ${item.id.toString()} did not resolve a valid amount.`,
                                        );
                                    }
                                    resolvedAmountsByItemId.set(
                                        item.id,
                                        resolvedAmount,
                                    );
                                    resolvedSunflowerAmountsByCartItemId.set(
                                        item.id,
                                        resolvedAmount,
                                    );
                                }
                                return {
                                    pendingItems: lockedPendingItems,
                                    resolvedAmountsByItemId,
                                };
                            } catch (error) {
                                console.error(
                                    'Error spending sunflowers during cart processing',
                                    { error, accountId, cartId },
                                );
                                throw error;
                            }
                        },
                    );

                for (const item of pendingItems) {
                    const sunflowerAmount = resolvedAmountsByItemId.get(
                        item.id,
                    );
                    if (sunflowerAmount === undefined) {
                        throw new Error(
                            `Sunflower spend for cart item ${item.id.toString()} lost its resolved amount.`,
                        );
                    }
                    resolvedSunflowerAmountsByCartItemId.set(
                        item.id,
                        sunflowerAmount,
                    );
                    const checkoutOperationMapping =
                        item.entityTypeName === 'operation'
                            ? await dependencies.getCheckoutOperationMapping(
                                  item.id,
                              )
                            : undefined;
                    const additionalData =
                        checkoutAdditionalDataByCartItemId.get(item.id) ?? {};
                    const fulfillment = await processItem(
                        {
                            accountId,
                            cartItemId: item.id,
                            entityId: item.entityId,
                            entityTypeName: item.entityTypeName,
                            cartId: item.cartId,
                            gardenId: item.gardenId,
                            raisedBedId: item.raisedBedId,
                            positionIndex: item.positionIndex,
                            currency: item.currency,
                            amount_total: sunflowerAmount,
                            additionalData,
                            checkoutSessionId,
                            checkoutOperationMapping:
                                item.entityTypeName === 'operation'
                                    ? checkoutOperationMapping
                                    : undefined,
                        },
                        dependencies,
                    );
                    assertCheckoutItemFulfilled(fulfillment);
                    await dependencies.setCartItemPaid(item.id);
                    processedItems.push(item);
                    if (expectedNonStripeCartItemIds?.has(item.id)) {
                        satisfiedExpectedItemIds.add(item.id);
                    }
                }
            },
        );
    }

    const inventoryCartItems = cartInfo.items.filter(
        (item) =>
            item.status !== 'paid' &&
            (item.currency === 'inventory' || item.usesInventory) &&
            isExpectedNonStripeItem(item),
    );

    // Helper function to generate inventory key
    const getInventoryKey = (item: {
        entityTypeName: string;
        entityId: string;
    }) => `${item.entityTypeName}-${item.entityId}`;

    // Pre-validate that total required inventory for all items is available
    // This prevents partial processing when multiple items consume the same inventory
    if (inventoryCartItems.length > 0) {
        // Calculate total required inventory for each unique entity
        const requiredInventory = new Map<string, number>();
        const availableInventory = new Map<string, number>();
        for (const item of inventoryCartItems) {
            const inventoryKey = getInventoryKey(item);
            const currentRequired = requiredInventory.get(inventoryKey) ?? 0;
            requiredInventory.set(inventoryKey, currentRequired + item.amount);
            availableInventory.set(inventoryKey, item.inventoryAvailable ?? 0);
        }

        // Validate all required inventory is available before processing any items
        for (const [
            inventoryKey,
            requiredAmount,
        ] of requiredInventory.entries()) {
            const available = availableInventory.get(inventoryKey) ?? 0;
            if (available < requiredAmount) {
                const errorMsg = `Insufficient inventory for key ${inventoryKey} in cart ${cartId}. Required: ${requiredAmount}, Available: ${available}. Manual intervention required to refund or fulfill this order.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        for (const item of inventoryCartItems) {
            await dependencies.withCheckoutCartItemProcessingLock(
                item.id,
                async () => {
                    const state = await dependencies.withCheckoutCartItemLock(
                        item.id,
                        async (db) => {
                            const lockedCart =
                                await dependencies.getShoppingCart(cartId, db);
                            if (!lockedCart) {
                                throw new Error(
                                    `Cart ${cartId.toString()} disappeared before inventory fulfillment.`,
                                );
                            }
                            const lockedState = assertCheckoutCartItemSnapshot(
                                lockedCart.items.find(
                                    (lockedItem) => lockedItem.id === item.id,
                                ),
                                item,
                            );
                            if (lockedState === 'pending') {
                                await dependencies.withInventoryAccountTransaction(
                                    accountId,
                                    (inventoryDb) =>
                                        dependencies.consumeInventoryItem(
                                            accountId,
                                            {
                                                entityTypeName:
                                                    item.entityTypeName,
                                                entityId: item.entityId,
                                                amount: item.amount,
                                                source: `shoppingCartItem:${item.id}`,
                                            },
                                            inventoryDb,
                                        ),
                                    db,
                                );
                            }
                            return lockedState;
                        },
                    );
                    if (state === 'paid') {
                        if (expectedNonStripeCartItemIds?.has(item.id)) {
                            satisfiedExpectedItemIds.add(item.id);
                        }
                        return;
                    }
                    const checkoutOperationMapping =
                        item.entityTypeName === 'operation'
                            ? await dependencies.getCheckoutOperationMapping(
                                  item.id,
                              )
                            : undefined;

                    const additionalData =
                        checkoutAdditionalDataByCartItemId.get(item.id) ?? {};

                    const fulfillment = await processItem(
                        {
                            accountId,
                            cartItemId: item.id,
                            entityId: item.entityId,
                            entityTypeName: item.entityTypeName,
                            cartId: item.cartId,
                            gardenId: item.gardenId,
                            raisedBedId: item.raisedBedId,
                            positionIndex: item.positionIndex,
                            currency: item.currency,
                            amount_total: 0,
                            additionalData,
                            checkoutSessionId,
                            checkoutOperationMapping:
                                item.entityTypeName === 'operation'
                                    ? checkoutOperationMapping
                                    : undefined,
                        },
                        dependencies,
                    );
                    assertCheckoutItemFulfilled(fulfillment);
                    await dependencies.setCartItemPaid(item.id);
                    processedItems.push(item);
                    if (expectedNonStripeCartItemIds?.has(item.id)) {
                        satisfiedExpectedItemIds.add(item.id);
                    }
                },
            );
        }
    }

    return {
        confirmationItems,
        processedItems,
        resolvedSunflowerAmountsByCartItemId,
        satisfiedExpectedItemIds,
    };
}

export async function processCheckoutSession(
    checkoutSessionId?: string,
    dependenciesOrMapIndex:
        | ProcessCheckoutSessionDependencies
        | number = realDependencies,
) {
    const dependencies =
        typeof dependenciesOrMapIndex === 'number'
            ? realDependencies
            : dependenciesOrMapIndex;

    if (!checkoutSessionId) {
        console.warn(`No checkout session ID provided`);
        return;
    }

    const session =
        await dependencies.getStripeCheckoutSession(checkoutSessionId);
    if (!session) {
        console.warn(`No session found for ID ${checkoutSessionId}`);
        return;
    }
    if (session.status !== 'complete') {
        console.warn(
            `Session ${checkoutSessionId} is not complete, current status: ${session.status}`,
        );
        return;
    }
    if (session.paymentStatus !== 'paid') {
        console.warn(
            `Payment not completed for session ${checkoutSessionId} with status: ${session.paymentStatus}`,
        );
        return;
    }

    return dependencies.withStripePaymentProcessingLock(session.id, () =>
        processPaidCheckoutSession(checkoutSessionId, session, dependencies),
    );
}

async function recordSunflowerPackageFulfillmentFailure({
    accountId,
    checkoutSessionId,
    dependencies,
    packageCode,
    reason,
}: {
    accountId?: string | null;
    checkoutSessionId: string;
    dependencies: ProcessCheckoutSessionDependencies;
    packageCode?: string | null;
    reason: string;
}) {
    console.warn('Sunflower package fulfillment failed', {
        accountId,
        checkoutSessionId,
        packageCode,
        reason,
    });

    if (!accountId) {
        return;
    }

    (await dependencies.getPostHogClient()).capture({
        distinctId: accountId,
        event: 'sunflower_package_fulfillment_failed',
        properties: {
            checkout_session_id: checkoutSessionId,
            package_code: packageCode ?? null,
            reason,
        },
    });
}

async function processSunflowerPackageCheckoutSession({
    checkoutSessionId,
    dependencies,
    existingTransactionId,
    packageItem,
    session,
}: {
    checkoutSessionId: string;
    dependencies: ProcessCheckoutSessionDependencies;
    existingTransactionId?: number;
    packageItem: SunflowerPackageCheckoutLineItem;
    session: PaidCheckoutSession;
}) {
    if (session.amountTotal !== packageItem.amountTotal) {
        await recordSunflowerPackageFulfillmentFailure({
            accountId: packageItem.accountId,
            checkoutSessionId,
            dependencies,
            packageCode: packageItem.packageCode,
            reason: 'session_amount_mismatch',
        });
        return;
    }

    const paidAmountCents = packageItem.amountTotal;
    const packageData = await dependencies.getSunflowerPackageByCode(
        packageItem.packageCode,
    );
    if (!packageData) {
        await recordSunflowerPackageFulfillmentFailure({
            accountId: packageItem.accountId,
            checkoutSessionId,
            dependencies,
            packageCode: packageItem.packageCode,
            reason: 'package_not_available',
        });
        return;
    }

    const mismatches = [
        packageItem.entityTypeName === sunflowerPackageEntityTypeName
            ? null
            : 'entity_type',
        packageItem.entityId === packageData.entityId ? null : 'entity_id',
        packageItem.packageRole === packageData.role ? null : 'role',
        packageItem.currency === packageData.currency ? null : 'currency',
        packageItem.priceCents === packageData.priceCents
            ? null
            : 'price_cents',
        paidAmountCents > 0 && paidAmountCents <= packageData.priceCents
            ? null
            : 'line_amount',
        packageItem.sunflowers === packageData.sunflowers ? null : 'sunflowers',
        packageItem.baseSunflowers === packageData.baseSunflowers
            ? null
            : 'base_sunflowers',
        packageItem.bonusSunflowers === packageData.bonusSunflowers
            ? null
            : 'bonus_sunflowers',
    ].filter((mismatch) => mismatch !== null);

    if (mismatches.length > 0 || packageData.currency !== 'eur') {
        await recordSunflowerPackageFulfillmentFailure({
            accountId: packageItem.accountId,
            checkoutSessionId,
            dependencies,
            packageCode: packageItem.packageCode,
            reason: `metadata_mismatch:${mismatches.join(',')}`,
        });
        return;
    }

    try {
        const oneTimeAccountPackage =
            packageData.isOneTime && packageData.oneTimeScope === 'account';
        const idempotencyKey = `stripe:${session.id}:sunflowerPackage:${packageData.code}`;
        const ledgerMetadata = {
            checkoutSessionId: session.id,
            lineItemId: packageItem.lineItemId,
            packageRole: packageData.role,
            catalogPriceCents: packageData.priceCents,
            paidAmountCents,
        };
        let creditedSunflowers = packageData.sunflowers;
        let creditedBonusSunflowers = packageData.bonusSunflowers;
        let duplicateOneTimePurchase = false;
        let topUpResult: Awaited<
            ReturnType<
                ProcessCheckoutSessionDependencies['topUpSunflowerPackage']
            >
        >;
        try {
            topUpResult = await dependencies.topUpSunflowerPackage({
                accountId: packageItem.accountId,
                packageCode: packageData.code,
                packageEntityId: packageData.entityId,
                sunflowers: packageData.sunflowers,
                bonusSunflowers: packageData.bonusSunflowers,
                priceCents: paidAmountCents,
                idempotencyKey,
                enforceOneTime: oneTimeAccountPackage,
                sourceType: 'stripeCheckoutSession',
                sourceId: session.id,
                reason: `sunflowerPackage:${packageData.code}`,
                metadata: ledgerMetadata,
            });
        } catch (error) {
            if (
                !(error instanceof SunflowerPackageAlreadyPurchasedError) ||
                !oneTimeAccountPackage
            ) {
                throw error;
            }
            if (packageData.baseSunflowers <= 0) {
                await recordSunflowerPackageFulfillmentFailure({
                    accountId: packageItem.accountId,
                    checkoutSessionId,
                    dependencies,
                    packageCode: packageItem.packageCode,
                    reason: 'already_purchased',
                });
                return;
            }

            console.warn(
                'One-time sunflower package was already purchased before a paid duplicate session fulfilled; crediting paid base sunflowers without duplicate bonus.',
                {
                    accountId: packageItem.accountId,
                    checkoutSessionId,
                    packageCode: packageData.code,
                },
            );
            duplicateOneTimePurchase = true;
            creditedSunflowers = packageData.baseSunflowers;
            creditedBonusSunflowers = 0;
            topUpResult = await dependencies.topUpSunflowerPackage({
                accountId: packageItem.accountId,
                packageCode: packageData.code,
                packageEntityId: packageData.entityId,
                sunflowers: creditedSunflowers,
                bonusSunflowers: 0,
                priceCents: paidAmountCents,
                idempotencyKey: `${idempotencyKey}:duplicate_paid_base`,
                enforceOneTime: false,
                sourceType: 'stripeCheckoutSession',
                sourceId: session.id,
                reason: `sunflowerPackage:${packageData.code}:duplicatePaid`,
                metadata: {
                    ...ledgerMetadata,
                    duplicateOneTimePurchase: true,
                    originalSunflowers: packageData.sunflowers,
                    originalBonusSunflowers: packageData.bonusSunflowers,
                },
            });
        }

        const transactionId =
            existingTransactionId ??
            (await dependencies.createTransaction({
                accountId: packageItem.accountId,
                amount: paidAmountCents,
                stripePaymentId: session.id,
                status: 'completed',
                currency: 'eur',
            }));

        if (existingTransactionId) {
            console.info(
                `Checkout session ${checkoutSessionId} already has transaction ${existingTransactionId}; sunflower package ledger replayed idempotently.`,
            );
            return;
        }

        const customer = await dependencies.getUser(packageItem.userId);
        const invoiceLineItem = dependencies.buildCheckoutInvoiceLineItem({
            amountTotalCents: packageItem.amountTotal,
            entityId: packageData.entityId.toString(),
            entityTypeName: sunflowerPackageEntityTypeName,
            metadataName: packageData.name,
            productName: packageItem.productName ?? packageData.name,
            quantity: packageItem.quantity,
        });

        if (dependencies.isBillingAutomationEnabled() && invoiceLineItem) {
            try {
                const invoiceResult =
                    await dependencies.ensureInvoiceForTransaction({
                        transactionId,
                        billingSnapshot:
                            dependencies.buildCheckoutInvoiceBillingSnapshot({
                                customerEmail: customer?.userName,
                                customerName: customer?.displayName,
                            }),
                        items: [invoiceLineItem],
                    });
                if (invoiceResult.status === 'skipped') {
                    console.warn('Sunflower package invoice skipped', {
                        checkoutSessionId,
                        reason: invoiceResult.reason,
                        transactionId,
                    });
                } else {
                    const receiptResult =
                        await dependencies.issueReceiptForPaidInvoice({
                            invoiceId: invoiceResult.invoiceId,
                            paymentReference: session.id,
                        });
                    if (receiptResult.status === 'skipped') {
                        console.warn('Sunflower package receipt skipped', {
                            checkoutSessionId,
                            invoiceId: invoiceResult.invoiceId,
                            reason: receiptResult.reason,
                            transactionId,
                        });
                    } else {
                        const fiscalizationResult =
                            await dependencies.fiscalizeReceipt(
                                receiptResult.receiptId,
                            );
                        const hasFiscalizedReceipt =
                            fiscalizationResult.status === 'confirmed' ||
                            fiscalizationResult.status === 'existing';
                        if (fiscalizationResult.status === 'failed') {
                            console.warn(
                                'Sunflower package receipt fiscalization failed',
                                {
                                    checkoutSessionId,
                                    reason: fiscalizationResult.reason,
                                    receiptId: receiptResult.receiptId,
                                    transactionId,
                                },
                            );
                        } else if (fiscalizationResult.status === 'skipped') {
                            console.warn(
                                'Sunflower package receipt fiscalization skipped',
                                {
                                    checkoutSessionId,
                                    reason: fiscalizationResult.reason,
                                    receiptId: receiptResult.receiptId,
                                    transactionId,
                                },
                            );
                        }

                        await dependencies.notifyBillingDocumentsEmail({
                            to: customer?.userName,
                            checkoutSessionId: session.id,
                            invoiceId: invoiceResult.invoiceId,
                            invoiceNumber: invoiceResult.invoiceNumber,
                            receiptId: hasFiscalizedReceipt
                                ? receiptResult.receiptId
                                : null,
                            receiptNumber: hasFiscalizedReceipt
                                ? receiptResult.yearReceiptNumber
                                : null,
                        });
                    }
                }
            } catch (error) {
                console.error(
                    'Sunflower package billing document automation failed',
                    {
                        checkoutSessionId,
                        error,
                        transactionId,
                    },
                );
            }
        }

        const purchasedItems = [
            {
                name: packageData.name,
                quantity: 1,
                amountSubtotal: paidAmountCents,
                currency: 'eur',
            },
        ];
        await dependencies.notifyOrderConfirmationEmail({
            to: customer?.userName,
            cartId: null,
            checkoutSessionId: session.id,
            items: purchasedItems,
            totalAmountCents: paidAmountCents,
            currency: 'eur',
        });
        await dependencies.notifyPurchase({
            accountId: packageItem.accountId,
            amountTotal: paidAmountCents,
            checkoutSessionId: session.id,
            customerEmail: customer?.userName ?? null,
            items: purchasedItems,
        });

        const ledgerEntryIds = [
            topUpResult.topUp.entry.id,
            topUpResult.bonus?.entry.id,
        ].filter((id) => typeof id === 'number');
        (await dependencies.getPostHogClient()).capture({
            distinctId: packageItem.accountId,
            event: 'sunflower_package_fulfilled',
            properties: {
                checkout_session_id: session.id,
                transaction_id: transactionId,
                package_code: packageData.code,
                package_role: packageData.role,
                price_cents: packageData.priceCents,
                paid_amount_cents: paidAmountCents,
                sunflowers: creditedSunflowers,
                bonus_sunflowers: creditedBonusSunflowers,
                duplicate_one_time_purchase: duplicateOneTimePurchase,
                ledger_entry_ids: ledgerEntryIds,
            },
        });
    } catch (error) {
        if (error instanceof SunflowerPackageAlreadyPurchasedError) {
            await recordSunflowerPackageFulfillmentFailure({
                accountId: packageItem.accountId,
                checkoutSessionId,
                dependencies,
                packageCode: packageItem.packageCode,
                reason: 'already_purchased',
            });
            return;
        }
        throw error;
    }
}

type CheckoutPlantingRaisedBedUnavailableReason = Extract<
    CheckoutPlantingRaisedBedActivation,
    { available: false }
>['reason'];

class CheckoutPlantingRaisedBedUnavailableError extends Error {
    override readonly name = 'CheckoutPlantingRaisedBedUnavailableError';

    constructor(readonly reason: CheckoutPlantingRaisedBedUnavailableReason) {
        super(`Checkout planting raised bed is unavailable (${reason}).`);
    }
}

async function processPaidCheckoutSession(
    checkoutSessionId: string,
    session: NonNullable<Awaited<ReturnType<typeof getStripeCheckoutSession>>>,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    const alreadyProcessed =
        await dependencies.getCompletedTransactionByStripePaymentId(session.id);
    const sunflowerPackageCheckout =
        getSunflowerPackageCheckoutLineItems(session);
    if (sunflowerPackageCheckout.malformedCount > 0) {
        await recordSunflowerPackageFulfillmentFailure({
            checkoutSessionId,
            dependencies,
            packageCode: null,
            reason: 'malformed_package_metadata',
        });
        return;
    }
    const sunflowerPackageLineItems = sunflowerPackageCheckout.items;
    if (sunflowerPackageLineItems.length > 1) {
        await recordSunflowerPackageFulfillmentFailure({
            checkoutSessionId,
            dependencies,
            packageCode: null,
            reason: 'multiple_package_line_items',
        });
        return;
    }
    const sunflowerPackageLineItem = sunflowerPackageLineItems[0];
    if (sunflowerPackageLineItem) {
        await processSunflowerPackageCheckoutSession({
            checkoutSessionId,
            dependencies,
            existingTransactionId: alreadyProcessed?.id,
            packageItem: sunflowerPackageLineItem,
            session,
        });
        return;
    }

    if (alreadyProcessed) {
        console.info(
            `Checkout session ${checkoutSessionId} already processed; skipping.`,
        );
        return;
    }

    console.debug(
        `Processing checkout session ${checkoutSessionId} with amount ${session.amountTotal} cents`,
    );

    const affectedCartIds: number[] = [];
    const purchasedItems: {
        name?: string | null;
        quantity?: number | null;
        amountSubtotal?: number | null;
        currency?: string | null;
    }[] = [];
    let accountId: string | undefined;
    let customerUserId: string | undefined;
    const invoiceLineItems: InvoiceForTransactionLineItem[] = [];
    const fulfillmentErrors: unknown[] = [];
    const expectedNonStripeCartItemIds =
        decodeExpectedNonStripeCartItemIdsMetadata(session.metadata);
    if (expectedNonStripeCartItemIds?.size) {
        const candidateCartIds = new Set<number>();
        for (const lineItem of session.lineItems?.data ?? []) {
            const product = lineItem.price?.product;
            if (typeof product === 'string' || product?.deleted) {
                continue;
            }
            const cartId = Number(product?.metadata.cartId);
            if (Number.isSafeInteger(cartId) && cartId > 0) {
                candidateCartIds.add(cartId);
            }
        }

        const presentExpectedItemIds = new Set<number>();
        for (const cartId of candidateCartIds) {
            const candidateCart = await dependencies.getShoppingCart(cartId);
            for (const item of candidateCart?.items ?? []) {
                if (expectedNonStripeCartItemIds.has(item.id)) {
                    presentExpectedItemIds.add(item.id);
                }
            }
        }
        const missingExpectedItemIds = [...expectedNonStripeCartItemIds].filter(
            (itemId) => !presentExpectedItemIds.has(itemId),
        );
        if (missingExpectedItemIds.length > 0) {
            throw new Error(
                `Expected non-Stripe cart items are missing before fulfillment: ${missingExpectedItemIds.join(', ')}`,
            );
        }
    }
    for (const item of session.lineItems?.data ?? []) {
        console.debug(`Item: ${item.id} Quantity: ${item.quantity}`);

        const product = item.price?.product;
        if (typeof product === 'string') {
            const error = new Error(
                `Stripe line item ${item.id} has an unexpanded product and cannot be fulfilled.`,
            );
            console.warn(error.message);
            fulfillmentErrors.push(error);
            continue;
        }

        if (product?.deleted) {
            const error = new Error(
                `Stripe line item ${item.id} references deleted product ${product.id} and cannot be fulfilled.`,
            );
            console.warn(error.message);
            fulfillmentErrors.push(error);
            continue;
        }

        purchasedItems.push({
            name:
                typeof product?.name === 'string'
                    ? `${product.name}${
                          product.metadata?.outletOfferId
                              ? ` (Outlet #${product.metadata.outletOfferId}${
                                    product.metadata.outletSowingDate
                                        ? `, sjetva ${product.metadata.outletSowingDate.slice(0, 10)}`
                                        : ''
                                })`
                              : ''
                      }`
                    : (product?.metadata?.name ?? null),
            quantity: item.quantity ?? null,
            amountSubtotal:
                (item as { amount_subtotal?: number }).amount_subtotal ??
                item.amount_total ??
                null,
            currency: 'eur',
        });

        // Extract metadata from the product
        let additionalData: unknown;
        try {
            additionalData = product?.metadata.additionalData
                ? JSON.parse(product.metadata.additionalData)
                : undefined;
        } catch (cause) {
            const error = new Error(
                `Stripe line item ${item.id} has invalid additionalData metadata.`,
                { cause },
            );
            console.warn(error.message);
            fulfillmentErrors.push(error);
            continue;
        }

        const itemData = {
            cartItemId: product?.metadata.cartItemId
                ? parseInt(product.metadata.cartItemId, 10)
                : undefined,
            entityId: product?.metadata.entityId,
            entityTypeName: product?.metadata.entityTypeName,
            accountId: product?.metadata.accountId,
            userId: product?.metadata.userId,
            cartId: product?.metadata.cartId
                ? parseInt(product.metadata.cartId, 10)
                : undefined,
            gardenId: product?.metadata.gardenId
                ? parseInt(product.metadata.gardenId, 10)
                : undefined,
            raisedBedId: product?.metadata.raisedBedId
                ? parseInt(product.metadata.raisedBedId, 10)
                : undefined,
            positionIndex: product?.metadata.positionIndex
                ? parseInt(product.metadata.positionIndex, 10)
                : undefined,
            additionalData,
            outletOfferId: product?.metadata.outletOfferId
                ? parseInt(product.metadata.outletOfferId, 10)
                : undefined,
            outletReservationId: product?.metadata.outletReservationId
                ? parseInt(product.metadata.outletReservationId, 10)
                : undefined,
            outletSowingDate: product?.metadata.outletSowingDate ?? undefined,
            outletInitialPlantStatus:
                product?.metadata.outletInitialPlantStatus ?? undefined,
            outletPriceCents: product?.metadata.outletPriceCents
                ? parseInt(product.metadata.outletPriceCents, 10)
                : undefined,
            currency: 'eur',
        };

        customerUserId ??= itemData.userId;

        // Validate required metadata (accountId can be derived from cart)
        if (
            !itemData.cartItemId ||
            !itemData.entityId ||
            !itemData.entityTypeName ||
            !itemData.cartId
        ) {
            const error = new Error(
                `Missing required metadata for item ${item.id} in session ${checkoutSessionId}.`,
            );
            console.warn(error.message);
            fulfillmentErrors.push(error);
            continue;
        }

        // Process cart item
        let resolvedAccountId: string | undefined;
        try {
            const cart = await dependencies.getShoppingCart(itemData.cartId);
            if (!cart) {
                throw new Error(
                    `No cart found for ID ${itemData.cartId} in session ${checkoutSessionId}.`,
                );
            }

            if (!cart.accountId) {
                throw new Error(
                    `Missing accountId for cart ${itemData.cartId} when processing session ${checkoutSessionId}.`,
                );
            }
            if (itemData.accountId && itemData.accountId !== cart.accountId) {
                throw new Error(
                    `Stripe metadata account does not own cart ${itemData.cartId} in session ${checkoutSessionId}.`,
                );
            }
            resolvedAccountId = cart.accountId;
            const checkoutAccountId = resolvedAccountId;

            // Every line in one checkout must resolve to the same cart owner.
            if (accountId && accountId !== resolvedAccountId) {
                throw new Error(
                    `Checkout session ${checkoutSessionId} references carts owned by different accounts.`,
                );
            }
            accountId = checkoutAccountId;

            // Find cart item by cartItemId for more reliable matching
            const cartItem = cart.items.find(
                (i) => i.id === itemData.cartItemId,
            );

            if (!cartItem) {
                throw new Error(
                    `No cart item found with ID ${itemData.cartItemId} in cart ${itemData.cartId} for session ${checkoutSessionId}.`,
                );
            }

            // Additional validation: ensure the cart item matches the expected entity details
            if (
                cartItem.entityId !== itemData.entityId ||
                cartItem.entityTypeName !== itemData.entityTypeName
            ) {
                throw new Error(
                    `Cart item ${itemData.cartItemId} entity mismatch. Expected: ${itemData.entityId}/${itemData.entityTypeName}, Found: ${cartItem.entityId}/${cartItem.entityTypeName}.`,
                );
            }

            if (typeof item.amount_total !== 'number') {
                throw new Error(
                    `Missing amount_total for Stripe line item ${item.id} in session ${checkoutSessionId}.`,
                );
            }

            affectedCartIds.push(cart.id);
            const invoiceLineItem = dependencies.buildCheckoutInvoiceLineItem({
                amountTotalCents: item.amount_total,
                entityId: itemData.entityId,
                entityTypeName: itemData.entityTypeName,
                metadataName: product?.metadata?.name ?? null,
                outletOfferId: itemData.outletOfferId,
                outletSowingDate: itemData.outletSowingDate,
                productName:
                    typeof product?.name === 'string' ? product.name : null,
                quantity: item.quantity ?? null,
            });
            if (invoiceLineItem) {
                invoiceLineItems.push(invoiceLineItem);
            } else {
                console.warn(
                    `Missing invoice line amount for Stripe line item ${item.id} in session ${checkoutSessionId}.`,
                );
            }

            if (cartItem.status === 'paid') {
                console.warn(
                    `Cart item ${cartItem.id} is already paid. Skipping fulfillment replay.`,
                );
                continue;
            }
            await dependencies.withCheckoutCartItemProcessingLock(
                cartItem.id,
                async () => {
                    const state = await dependencies.withCheckoutCartItemLock(
                        cartItem.id,
                        async (db) => {
                            const lockedCart =
                                await dependencies.getShoppingCart(cart.id, db);
                            if (!lockedCart) {
                                throw new Error(
                                    `Cart ${cart.id.toString()} disappeared before Stripe fulfillment.`,
                                );
                            }
                            const lockedState = assertCheckoutCartItemSnapshot(
                                lockedCart.items.find(
                                    (lockedItem) =>
                                        lockedItem.id === cartItem.id,
                                ),
                                cartItem,
                            );
                            if (lockedState === 'pending') {
                                const legacyRewardAlreadyEarned =
                                    itemData.entityTypeName === 'plantSort' &&
                                    typeof cartItem.positionIndex ===
                                        'number' &&
                                    typeof cartItem.raisedBedId === 'number' &&
                                    (await dependencies.hasMatchingCheckoutPlantingPurchase(
                                        {
                                            cartItemId: cartItem.id,
                                            euroAmountCents: item.amount_total,
                                            plantSortId: cartItem.entityId,
                                            positionIndex:
                                                cartItem.positionIndex,
                                            raisedBedId: cartItem.raisedBedId,
                                        },
                                        db,
                                    ));
                                await dependencies.earnSunflowersForPayment(
                                    checkoutAccountId,
                                    item.amount_total / 100,
                                    `shoppingCartItem:${cartItem.id.toString()}`,
                                    db,
                                    { legacyRewardAlreadyEarned },
                                );
                            }
                            return lockedState;
                        },
                    );
                    if (state === 'paid') {
                        console.warn(
                            `Cart item ${cartItem.id} became paid while waiting for its fulfillment lock. Skipping replay.`,
                        );
                        return;
                    }

                    try {
                        const isPlantingItem =
                            itemData.entityTypeName === 'plantSort';
                        const checkoutOperationMapping =
                            itemData.entityTypeName === 'operation'
                                ? await dependencies.getCheckoutOperationMapping(
                                      cartItem.id,
                                  )
                                : undefined;
                        if (
                            !checkoutOperationMapping &&
                            !(await assertRaisedBedAllowsCheckoutItem(
                                cartItem.raisedBedId,
                                dependencies,
                            ))
                        ) {
                            if (isPlantingItem) {
                                throw new CheckoutPlantingRaisedBedUnavailableError(
                                    'abandoned',
                                );
                            }
                            throw new CheckoutItemFulfillmentError(
                                'raised_bed_unavailable',
                            );
                        }

                        const fulfillment = await processItem(
                            {
                                ...itemData,
                                accountId: checkoutAccountId,
                                amount_total: item.amount_total,
                                checkoutSessionId: session.id,
                                paymentRewardAlreadyEnsured: true,
                                checkoutOperationMapping,
                            },
                            dependencies,
                        );
                        assertCheckoutItemFulfilled(fulfillment);
                        await dependencies.setCartItemPaid(cartItem.id);
                    } catch (error) {
                        if (
                            error instanceof
                            CheckoutPlantingRaisedBedUnavailableError
                        ) {
                            try {
                                await recordCheckoutPlantingRaisedBedUnavailable(
                                    {
                                        accountId: checkoutAccountId,
                                        cartItemId: cartItem.id,
                                        checkoutSessionId: session.id,
                                        dependencies,
                                        gardenId: itemData.gardenId,
                                        positionIndex: itemData.positionIndex,
                                        raisedBedId: itemData.raisedBedId,
                                        reason: error.reason,
                                    },
                                );
                            } catch (incidentError) {
                                console.error(
                                    'Failed to record checkout planting incident',
                                    incidentError,
                                );
                            }
                        }
                        throw error;
                    }
                },
            );
        } catch (error) {
            console.error(
                `Error processing cart item ${itemData.cartItemId} in session ${checkoutSessionId}`,
                error,
            );
            fulfillmentErrors.push(error);
        }

        // TODO: Send invoice to customer
    }

    if (fulfillmentErrors.length > 0) {
        const firstFulfillmentError = fulfillmentErrors[0];
        if (firstFulfillmentError !== undefined) {
            throw firstFulfillmentError;
        }
        throw new Error('Checkout item fulfillment failed');
    }

    // Extract and validate delivery info from Stripe items to use for non-Stripe items.
    // All items in a single checkout session should share the same delivery information.
    let deliveryInfo: unknown;
    const deliveryInfosFound = new Set<string>();
    for (const item of session.lineItems?.data ?? []) {
        const product = item.price?.product;
        if (typeof product !== 'string' && !product?.deleted) {
            const additionalData = product?.metadata?.additionalData
                ? JSON.parse(product.metadata.additionalData)
                : undefined;
            if (
                additionalData &&
                typeof additionalData === 'object' &&
                'delivery' in additionalData
            ) {
                const itemDeliveryInfo = additionalData.delivery;
                // Use deterministic serialization with sorted keys for reliable comparison
                const serialized = JSON.stringify(
                    sortObjectKeys(itemDeliveryInfo),
                );
                deliveryInfosFound.add(serialized);

                if (!deliveryInfo) {
                    deliveryInfo = itemDeliveryInfo;
                }
            }
        }
    }

    // Warn if multiple different delivery configurations were found
    if (deliveryInfosFound.size > 1) {
        console.warn(
            `Multiple different delivery configurations found in session ${checkoutSessionId}. ` +
                `Using the first one encountered. This may indicate a checkout flow issue.`,
        );
    }

    const uniqueAffectedCartIds = Array.from(new Set(affectedCartIds));
    const harvestDateByCartItemId = decodeHarvestDatesMetadata(
        session.metadata,
    );
    const satisfiedExpectedNonStripeItemIds = new Set<number>();
    const resolvedSunflowerAmountsByCartItemId = new Map<number, number>();
    if (accountId && uniqueAffectedCartIds.length > 0) {
        for (const cartId of uniqueAffectedCartIds) {
            const nonStripeResult = await processNonStripeCartItems(
                cartId,
                accountId,
                deliveryInfo,
                harvestDateByCartItemId,
                expectedNonStripeCartItemIds,
                session.id,
                dependencies,
            );
            for (const itemId of nonStripeResult.satisfiedExpectedItemIds) {
                satisfiedExpectedNonStripeItemIds.add(itemId);
            }
            for (const [
                itemId,
                amount,
            ] of nonStripeResult.resolvedSunflowerAmountsByCartItemId) {
                resolvedSunflowerAmountsByCartItemId.set(itemId, amount);
            }
            purchasedItems.push(
                ...dependencies.buildOrderConfirmationItems(
                    nonStripeResult.confirmationItems,
                    (item) => {
                        const resolvedAmount =
                            resolvedSunflowerAmountsByCartItemId.get(item.id);
                        if (resolvedAmount === undefined) {
                            throw new Error(
                                `Sunflower confirmation amount is missing for cart item ${item.id.toString()}.`,
                            );
                        }
                        return resolvedAmount;
                    },
                ),
            );
        }
    }
    if (expectedNonStripeCartItemIds !== null) {
        const missingExpectedItemIds = [...expectedNonStripeCartItemIds].filter(
            (itemId) => !satisfiedExpectedNonStripeItemIds.has(itemId),
        );
        if (missingExpectedItemIds.length > 0) {
            throw new Error(
                `Expected non-Stripe cart items were not fulfilled: ${missingExpectedItemIds.join(', ')}`,
            );
        }
    }

    const customer = customerUserId
        ? await dependencies.getUser(customerUserId)
        : null;

    // Update all affected carts to mark them as paid if all items are paid
    await Promise.all(
        uniqueAffectedCartIds.map(dependencies.markCartPaidIfAllItemsPaid),
    );

    const transactionId =
        accountId && typeof session.amountTotal === 'number'
            ? await dependencies.createTransaction({
                  accountId,
                  amount: session.amountTotal,
                  stripePaymentId: session.id,
                  status: 'completed',
                  currency: 'eur',
              })
            : undefined;

    if (transactionId && dependencies.isBillingAutomationEnabled()) {
        try {
            const invoiceResult =
                await dependencies.ensureInvoiceForTransaction({
                    transactionId,
                    billingSnapshot:
                        dependencies.buildCheckoutInvoiceBillingSnapshot({
                            customerEmail: customer?.userName,
                            customerName: customer?.displayName,
                        }),
                    items: invoiceLineItems,
                });
            if (invoiceResult.status === 'skipped') {
                console.warn('Checkout invoice generation skipped', {
                    checkoutSessionId,
                    reason: invoiceResult.reason,
                    transactionId,
                });
            } else {
                const receiptResult =
                    await dependencies.issueReceiptForPaidInvoice({
                        invoiceId: invoiceResult.invoiceId,
                        paymentReference: session.id,
                    });
                if (receiptResult.status === 'skipped') {
                    console.warn('Checkout receipt issuing skipped', {
                        checkoutSessionId,
                        invoiceId: invoiceResult.invoiceId,
                        reason: receiptResult.reason,
                        transactionId,
                    });
                } else {
                    const fiscalizationResult =
                        await dependencies.fiscalizeReceipt(
                            receiptResult.receiptId,
                        );
                    const hasFiscalizedReceipt =
                        fiscalizationResult.status === 'confirmed' ||
                        fiscalizationResult.status === 'existing';
                    if (fiscalizationResult.status === 'failed') {
                        console.warn('Checkout receipt fiscalization failed', {
                            checkoutSessionId,
                            reason: fiscalizationResult.reason,
                            receiptId: receiptResult.receiptId,
                            transactionId,
                        });
                    } else if (fiscalizationResult.status === 'skipped') {
                        console.warn('Checkout receipt fiscalization skipped', {
                            checkoutSessionId,
                            reason: fiscalizationResult.reason,
                            receiptId: receiptResult.receiptId,
                            transactionId,
                        });
                    }

                    await dependencies.notifyBillingDocumentsEmail({
                        to: customer?.userName,
                        cartIds: uniqueAffectedCartIds,
                        checkoutSessionId: session.id,
                        invoiceId: invoiceResult.invoiceId,
                        invoiceNumber: invoiceResult.invoiceNumber,
                        receiptId: hasFiscalizedReceipt
                            ? receiptResult.receiptId
                            : null,
                        receiptNumber: hasFiscalizedReceipt
                            ? receiptResult.yearReceiptNumber
                            : null,
                    });
                }
            }
        } catch (error) {
            console.error('Checkout billing document automation failed', {
                checkoutSessionId,
                error,
                transactionId,
            });
        }
    }

    const completedCartIds: number[] = [];
    for (const cartId of uniqueAffectedCartIds) {
        const completedCart = await dependencies.getShoppingCart(cartId);
        if (completedCart?.status === 'paid') {
            completedCartIds.push(completedCart.id);
        }
    }

    if (completedCartIds.length > 0) {
        await dependencies.notifyOrderConfirmationEmail({
            to: customer?.userName,
            cartId: completedCartIds.length === 1 ? completedCartIds[0] : null,
            checkoutSessionId: session.id,
            items: purchasedItems,
            totalAmountCents: session.amountTotal ?? null,
            currency: 'eur',
        });
    } else {
        console.warn(
            'Skipping order confirmation email: no affected cart is paid',
            {
                checkoutSessionId: session.id,
                affectedCartIds: uniqueAffectedCartIds,
            },
        );
    }

    await dependencies.notifyPurchase({
        accountId,
        amountTotal: session.amountTotal ?? null,
        checkoutSessionId: session.id ?? null,
        customerEmail: customer?.userName ?? null,
        items: purchasedItems,
    });

    if (accountId) {
        (await dependencies.getPostHogClient()).capture({
            distinctId: accountId,
            event: 'purchase_completed',
            properties: {
                amount_total: session.amountTotal,
                currency: 'eur',
                item_count: purchasedItems.length,
                checkout_session_id: session.id,
            },
        });
    }
}

async function assertRaisedBedAllowsCheckoutItem(
    raisedBedId?: number | null,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    if (!raisedBedId) {
        return true;
    }

    const raisedBed = await dependencies.getRaisedBed(raisedBedId);
    if (raisedBed && dependencies.isRaisedBedAbandoned(raisedBed.status)) {
        console.warn(
            `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
            { raisedBedId },
        );
        return false;
    }

    return true;
}

async function recordCheckoutPlantingRaisedBedUnavailable({
    accountId,
    cartItemId,
    checkoutSessionId,
    dependencies,
    gardenId,
    positionIndex,
    raisedBedId,
    reason,
}: {
    accountId: string;
    cartItemId: number;
    checkoutSessionId: string;
    dependencies: ProcessCheckoutSessionDependencies;
    gardenId?: number | null;
    positionIndex?: number | null;
    raisedBedId?: number | null;
    reason: CheckoutPlantingRaisedBedUnavailableReason;
}) {
    const incident = await dependencies.createNotificationWithStatus(
        {
            accountId,
            gardenId,
            raisedBedId,
            header: 'Plaćena sadnja čeka provjeru',
            content:
                'Plaćenu sadnju nismo postavili jer je odabrana gredica napuštena ili više nije dostupna. Zadatak ostaje otvoren za ponovni pokušaj, ručno postavljanje ili povrat sredstava.',
            category: 'checkout_fulfillment',
            type: 'checkout_planting_raised_bed_unavailable',
            primaryChannel: 'in_app',
            priority: 'critical',
            metadata: {
                cartItemId,
                checkoutSessionId,
                fulfillmentStatus: 'open',
                operatorOwner: 'farm_operations',
                recovery: 'stripe_retry_then_manual_placement_or_refund',
                positionIndex: positionIndex ?? null,
                raisedBedId: raisedBedId ?? null,
                reason,
            },
            timestamp: new Date(),
        },
        {
            idempotencyKey: `checkout-planting-raised-bed-unavailable:${checkoutSessionId}:${cartItemId.toString()}`,
            routeDelivery: false,
        },
    );

    if (typeof raisedBedId === 'number' && typeof positionIndex === 'number') {
        const operatorAlert =
            await dependencies.deliverNotificationOperatorAlert(
                incident.notificationId,
                () =>
                    dependencies.notifyCheckoutFulfillmentIncident({
                        accountId,
                        cartItemId,
                        checkoutSessionId,
                        incidentId: incident.notificationId,
                        positionIndex,
                        raisedBedId,
                    }),
            );
        if (operatorAlert.status === 'failed') {
            console.error(
                'Checkout raised-bed fulfillment incident operator alert failed and will be retried',
                {
                    cartItemId,
                    checkoutSessionId,
                    error: operatorAlert.error,
                    incidentId: incident.notificationId,
                },
            );
        }
    } else {
        console.error(
            'Checkout raised-bed fulfillment incident is missing placement metadata for an operator alert',
            {
                cartItemId,
                checkoutSessionId,
                incidentId: incident.notificationId,
                positionIndex,
                raisedBedId,
            },
        );
    }

    (await dependencies.getPostHogClient()).capture({
        distinctId: accountId,
        event: 'checkout_planting_raised_bed_unavailable',
        properties: {
            $insert_id: `checkout-planting-raised-bed-unavailable:${checkoutSessionId}:${cartItemId.toString()}`,
            cart_item_id: cartItemId,
            checkout_session_id: checkoutSessionId,
            position_index: positionIndex ?? null,
            raised_bed_id: raisedBedId ?? null,
            reason,
        },
    });
}

async function outletReservationForCheckout(
    itemData: {
        cartItemId?: number | null;
        entityId: string | null | undefined;
        outletOfferId?: number | null;
        outletReservationId?: number | null;
    },
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    if (!itemData.cartItemId) {
        return null;
    }

    const reservation = await dependencies.getOutletOfferReservationForCartItem(
        itemData.cartItemId,
    );
    if (!reservation) {
        if (itemData.outletOfferId || itemData.outletReservationId) {
            throw new Error(
                `Outlet reservation not found for cart item ${itemData.cartItemId}.`,
            );
        }

        return null;
    }

    if (
        itemData.outletReservationId &&
        itemData.outletReservationId !== reservation.id
    ) {
        throw new Error(
            `Outlet reservation mismatch for cart item ${itemData.cartItemId}.`,
        );
    }
    if (
        itemData.outletOfferId &&
        itemData.outletOfferId !== reservation.outletOfferId
    ) {
        throw new Error(
            `Outlet offer mismatch for cart item ${itemData.cartItemId}.`,
        );
    }
    if (reservation.outletOffer.plantSortId.toString() !== itemData.entityId) {
        throw new Error(
            `Outlet plant sort mismatch for cart item ${itemData.cartItemId}.`,
        );
    }

    return reservation;
}

function parseAdditionalDataValue(additionalData: unknown) {
    if (typeof additionalData !== 'string') {
        return additionalData;
    }

    try {
        return JSON.parse(additionalData);
    } catch {
        return null;
    }
}

export const __testUtils = {
    parseAdditionalDataValue,
};

function scheduledDateFromAdditionalData(additionalData: unknown) {
    const parsedAdditionalData = parseAdditionalDataValue(additionalData);
    const scheduledDate =
        typeof parsedAdditionalData === 'object' &&
        parsedAdditionalData != null &&
        'scheduledDate' in parsedAdditionalData &&
        typeof parsedAdditionalData.scheduledDate === 'string'
            ? parsedAdditionalData.scheduledDate
            : null;
    if (!scheduledDate) {
        return null;
    }

    return Number.isNaN(new Date(scheduledDate).getTime())
        ? null
        : scheduledDate;
}

function greenhouseSowingLocationFromAdditionalData(additionalData: unknown) {
    const parsedAdditionalData = parseAdditionalDataValue(additionalData);
    return typeof parsedAdditionalData === 'object' &&
        parsedAdditionalData != null &&
        'sowingLocation' in parsedAdditionalData &&
        parsedAdditionalData.sowingLocation === 'greenhouse'
        ? 'greenhouse'
        : undefined;
}

function checkoutScheduledDateFromAdditionalData(
    additionalData: unknown,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    return (
        scheduledDateFromAdditionalData(additionalData) ??
        dependencies.getDefaultShoppingCartScheduledDate()
    );
}

function plantingPurchaseFromCheckoutItem(itemData: {
    amount_total: number;
    cartItemId?: number | null;
    currency: string | null;
}) {
    if (!itemData.cartItemId) {
        return undefined;
    }

    if (itemData.currency === 'sunflower') {
        return {
            cartItemId: itemData.cartItemId,
            currency: 'sunflower' as const,
            sunflowerAmount: itemData.amount_total,
        };
    }
    if (itemData.currency === 'eur') {
        return {
            cartItemId: itemData.cartItemId,
            currency: 'eur' as const,
            euroAmountCents: itemData.amount_total,
        };
    }
    if (itemData.currency === 'inventory') {
        return {
            cartItemId: itemData.cartItemId,
            currency: 'inventory' as const,
        };
    }

    return undefined;
}

function isSameCheckoutPlanting(
    plantCycle: Awaited<
        ReturnType<typeof getRaisedBedFieldsWithEvents>
    >[number]['plantCycles'][number],
    plantSortId: string,
    purchase: ReturnType<typeof plantingPurchaseFromCheckoutItem>,
) {
    return (
        purchase !== undefined &&
        plantCycle.purchase?.cartItemId === purchase.cartItemId &&
        plantCycle.plantSortId?.toString() === plantSortId
    );
}

class CheckoutPlantingTargetConflictError extends Error {
    override readonly name = 'CheckoutPlantingTargetConflictError';
}

export type ProcessItemFulfillmentResult =
    | { status: 'fulfilled' }
    | {
          reason:
              | 'delivery_configuration_missing'
              | 'delivery_request_failed'
              | 'invalid_entity_id'
              | 'missing_metadata'
              | 'raised_bed_unavailable'
              | 'unsupported_item';
          status: 'not_fulfilled';
      };

type CheckoutItemFulfillmentFailureReason = Extract<
    ProcessItemFulfillmentResult,
    { status: 'not_fulfilled' }
>['reason'];

export class CheckoutItemFulfillmentError extends Error {
    override readonly name = 'CheckoutItemFulfillmentError';

    constructor(readonly reason: CheckoutItemFulfillmentFailureReason) {
        super(`Checkout item fulfillment was not confirmed (${reason})`);
    }
}

export function assertCheckoutItemFulfilled(
    result: ProcessItemFulfillmentResult,
): asserts result is { status: 'fulfilled' } {
    if (result.status !== 'fulfilled') {
        throw new CheckoutItemFulfillmentError(result.reason);
    }
}

export async function processItem(
    itemData: {
        entityId: string | null | undefined;
        entityTypeName: string | null | undefined;
        accountId: string | null | undefined;
        cartItemId?: number | null;
        cartId: number | null | undefined;
        gardenId: number | null | undefined;
        raisedBedId: number | null | undefined;
        positionIndex: number | null | undefined;
        additionalData: unknown | null | undefined;
        outletOfferId?: number | null;
        outletReservationId?: number | null;
        outletSowingDate?: string | null;
        outletInitialPlantStatus?: string | null;
        outletPriceCents?: number | null;
        currency: string | null;
        amount_total: number; // Amount in cents or sunflowers
        checkoutSessionId?: string | null;
        paymentRewardAlreadyEnsured?: boolean;
        checkoutOperationMapping?: Awaited<
            ReturnType<typeof getCheckoutOperationMapping>
        >;
    },
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
): Promise<ProcessItemFulfillmentResult> {
    console.debug(
        `Processing item with entityId ${itemData.entityId} and entityTypeName ${itemData.entityTypeName} for account ${itemData.accountId} in total amount ${itemData.amount_total}`,
    );

    const earnSunflowersFunc = () =>
        itemData.accountId &&
        itemData.cartItemId &&
        itemData.currency === 'eur' &&
        itemData.paymentRewardAlreadyEnsured !== true
            ? dependencies.earnSunflowersForPayment(
                  itemData.accountId,
                  itemData.amount_total / 100,
                  `shoppingCartItem:${itemData.cartItemId.toString()}`,
              )
            : Promise.resolve();

    // TODO: Move this logic to a separate function
    if (itemData.entityTypeName === 'operation') {
        // TODO: Handle operation processing
        // TODO: Handle raisedBed operation placement (not currently necessary since we can't buy raised bed operation without planting plants)

        // Validate item data
        if (
            !itemData.accountId ||
            !itemData.cartItemId ||
            !itemData.entityId ||
            !itemData.entityTypeName
        ) {
            console.error(
                `Missing required metadata for operation item in order.`,
                itemData,
            );
            return { status: 'not_fulfilled', reason: 'missing_metadata' };
        }
        const entityIdNumber = parseInt(itemData.entityId, 10);
        if (Number.isNaN(entityIdNumber)) {
            console.error(
                `Invalid entityId ${itemData.entityId} for operation item in order.`,
                itemData,
            );
            return { status: 'not_fulfilled', reason: 'invalid_entity_id' };
        }
        const paymentCurrency = itemData.currency;
        if (
            paymentCurrency !== 'eur' &&
            paymentCurrency !== 'inventory' &&
            paymentCurrency !== 'sunflower'
        ) {
            console.error(
                `Invalid payment currency for operation item in order.`,
                itemData,
            );
            return { status: 'not_fulfilled', reason: 'unsupported_item' };
        }
        const checkoutOperationMapping =
            itemData.checkoutOperationMapping === undefined
                ? await dependencies.getCheckoutOperationMapping(
                      itemData.cartItemId,
                  )
                : itemData.checkoutOperationMapping;
        if (
            !checkoutOperationMapping &&
            !(await assertRaisedBedAllowsCheckoutItem(
                itemData.raisedBedId,
                dependencies,
            ))
        ) {
            return {
                status: 'not_fulfilled',
                reason: 'raised_bed_unavailable',
            };
        }

        // New operations target the currently active field. Retries must keep
        // the field captured in the durable mapping, even if the active field
        // at this position has changed since the first attempt.
        let fieldId: number | undefined;
        if (checkoutOperationMapping) {
            fieldId = checkoutOperationMapping.raisedBedFieldId ?? undefined;
        } else if (
            typeof itemData.positionIndex === 'number' &&
            itemData.raisedBedId
        ) {
            const raisedBedFields =
                await dependencies.getRaisedBedFieldsWithEvents(
                    itemData.raisedBedId,
                );
            fieldId = raisedBedFields.find(
                (field) =>
                    field.positionIndex === itemData.positionIndex &&
                    field.active,
            )?.id;
        }

        let additionalData = itemData.additionalData;
        if (typeof additionalData === 'string') {
            try {
                additionalData = JSON.parse(additionalData);
            } catch (error) {
                console.error(
                    `Invalid additionalData for operation item in order.`,
                    {
                        additionalData,
                        itemData,
                        error,
                    },
                );
                additionalData = null;
            }
        }
        const scheduledDate = checkoutScheduledDateFromAdditionalData(
            additionalData,
            dependencies,
        );
        const operationScheduledDate =
            checkoutOperationMapping?.scheduledDate ?? scheduledDate;
        const requestedDeliveryInfo =
            checkoutDeliveryInfoFromAdditionalData(additionalData);
        const deliveryProvenance = checkoutOperationMapping
            ? checkoutOperationMapping.delivery
            : checkoutDeliveryProvenance(requestedDeliveryInfo);
        const deliveryInfo =
            checkoutDeliveryInfoFromProvenance(deliveryProvenance);

        // Credit the captured-payment reward first. Its cart-item key makes a
        // replay a no-op if operation creation or later fulfillment fails.
        await earnSunflowersFunc();
        const { created, operationId } =
            await dependencies.getOrCreateCheckoutOperation(
                itemData.cartItemId,
                {
                    accountId: itemData.accountId,
                    entityId: entityIdNumber,
                    entityTypeName: itemData.entityTypeName,
                    gardenId: itemData.gardenId,
                    raisedBedId: itemData.raisedBedId,
                    raisedBedFieldId: fieldId,
                },
                {
                    delivery: deliveryProvenance,
                    paymentCurrency,
                    scheduledDate: new Date(operationScheduledDate),
                },
            );

        console.debug(
            `${created ? 'Created' : 'Reused'} scheduled operation ${operationId.toString()} for cart item ${itemData.cartItemId.toString()}.`,
        );

        // Check if this operation/entity is deliverable and create delivery request if needed
        if (itemData.cartId) {
            const isDeliverable = await dependencies.isCartItemDeliverable({
                entityId: entityIdNumber,
            });
            if (isDeliverable) {
                console.debug(
                    `Operation ${operationId} is deliverable - checking for delivery configuration in metadata`,
                );

                if (deliveryInfo) {
                    try {
                        const deliveryRequest =
                            await dependencies.getOrCreateDeliveryRequest({
                                operationId,
                                slotId: deliveryInfo.slotId,
                                mode: deliveryInfo.mode,
                                addressId: deliveryInfo.addressId,
                                locationId: deliveryInfo.locationId,
                                notes: deliveryInfo.notes,
                                accountId: itemData.accountId,
                            });
                        console.debug(
                            `${deliveryRequest.created ? 'Created' : 'Reused'} delivery request ${deliveryRequest.requestId} for operation ${operationId.toString()}`,
                        );
                    } catch (error) {
                        console.error(
                            `Failed to create delivery request for operation ${operationId}:`,
                            error,
                        );
                        // Payment already captured -- do not re-throw. Surface the failure so ops
                        // can reconcile the paid-but-undelivered order.
                        (await dependencies.getPostHogClient()).capture({
                            distinctId: itemData.accountId,
                            event: 'delivery_request_creation_failed',
                            properties: {
                                operation_id: operationId,
                                account_id: itemData.accountId,
                                slot_id: deliveryInfo.slotId,
                                mode: deliveryInfo.mode,
                                checkout_session_id:
                                    itemData.checkoutSessionId ?? null,
                            },
                        });
                        return {
                            status: 'not_fulfilled',
                            reason: 'delivery_request_failed',
                        };
                    }
                } else {
                    console.warn(
                        `Operation ${operationId} is deliverable but no delivery information found in metadata`,
                    );
                    return {
                        status: 'not_fulfilled',
                        reason: 'delivery_configuration_missing',
                    };
                }
            }
        }
        return { status: 'fulfilled' };
    } else if (
        itemData.entityId &&
        itemData.entityTypeName === 'plantSort' &&
        itemData.raisedBedId &&
        typeof itemData.positionIndex === 'number'
    ) {
        const plantSortId = itemData.entityId;
        const positionIndex = itemData.positionIndex;
        const raisedBedId = itemData.raisedBedId;
        const outletReservation = await outletReservationForCheckout(
            itemData,
            dependencies,
        );
        const outletCartItemId = (() => {
            if (!outletReservation) return undefined;
            if (!itemData.cartItemId) {
                throw new Error(
                    'Outlet checkout planting requires a cart item ID.',
                );
            }
            return itemData.cartItemId;
        })();
        const aggregateId = `${raisedBedId}|${positionIndex}`;
        const purchase = plantingPurchaseFromCheckoutItem(itemData);

        await earnSunflowersFunc();
        let placementResult: 'already-placed' | 'placed';
        try {
            placementResult =
                await dependencies.withPlantingScheduleTaskTransaction(
                    raisedBedId,
                    positionIndex,
                    async (transaction) => {
                        const raisedBedActivation =
                            await dependencies.lockAndActivateRaisedBedForCheckoutPlanting(
                                raisedBedId,
                                transaction,
                            );
                        if (!raisedBedActivation.available) {
                            throw new CheckoutPlantingRaisedBedUnavailableError(
                                raisedBedActivation.reason,
                            );
                        }
                        if (raisedBedActivation.activatedAccountId) {
                            await dependencies.processReferralRewardsForAccount(
                                raisedBedActivation.activatedAccountId,
                                transaction,
                            );
                        }

                        await dependencies.upsertRaisedBedField(
                            {
                                positionIndex,
                                raisedBedId,
                            },
                            transaction,
                        );
                        const fields =
                            await dependencies.getRaisedBedFieldsWithEvents(
                                raisedBedId,
                                transaction,
                            );
                        const targetField = fields.find(
                            (field) => field.positionIndex === positionIndex,
                        );
                        const existingCheckoutPlanting = fields
                            .flatMap((field) => field.plantCycles)
                            .find((plantCycle) =>
                                isSameCheckoutPlanting(
                                    plantCycle,
                                    plantSortId,
                                    purchase,
                                ),
                            );
                        if (existingCheckoutPlanting) {
                            if (outletCartItemId) {
                                await dependencies.convertOutletReservationForCartItem(
                                    outletCartItemId,
                                    new Date(),
                                    transaction,
                                );
                            }
                            return 'already-placed';
                        }

                        const activePlantCycle = targetField?.plantCycles.find(
                            (plantCycle) => plantCycle.active,
                        );
                        if (activePlantCycle) {
                            throw new CheckoutPlantingTargetConflictError(
                                'Checkout planting target has an active plant cycle.',
                            );
                        }

                        if (outletCartItemId) {
                            await dependencies.convertOutletReservationForCartItem(
                                outletCartItemId,
                                new Date(),
                                transaction,
                            );
                        }

                        await dependencies.createEvent(
                            dependencies.knownEvents.raisedBedFields.plantPlaceV1(
                                aggregateId,
                                {
                                    plantSortId,
                                    scheduledDate: outletReservation
                                        ? null
                                        : checkoutScheduledDateFromAdditionalData(
                                              itemData.additionalData,
                                              dependencies,
                                          ),
                                    sowingLocation: outletReservation
                                        ? 'greenhouse'
                                        : greenhouseSowingLocationFromAdditionalData(
                                              itemData.additionalData,
                                          ),
                                    ...(purchase ? { purchase } : {}),
                                },
                            ),
                            transaction,
                        );
                        if (outletReservation) {
                            await dependencies.createEvent(
                                dependencies.knownEvents.raisedBedFields.plantUpdateV1(
                                    aggregateId,
                                    {
                                        status: 'sowed',
                                        effectiveDate:
                                            outletReservation.heldSowingDate.toISOString(),
                                    },
                                ),
                                transaction,
                            );

                            if (
                                outletReservation.heldInitialPlantStatus !==
                                'sowed'
                            ) {
                                await dependencies.createEvent(
                                    dependencies.knownEvents.raisedBedFields.plantUpdateV1(
                                        aggregateId,
                                        {
                                            status: outletReservation.heldInitialPlantStatus,
                                        },
                                    ),
                                    transaction,
                                );
                            }
                        }
                        return 'placed';
                    },
                );
        } catch (error) {
            if (error instanceof CheckoutPlantingTargetConflictError) {
                console.error('Checkout planting target is occupied', {
                    accountId: itemData.accountId,
                    cartItemId: itemData.cartItemId,
                    checkoutSessionId: itemData.checkoutSessionId,
                    error,
                    positionIndex,
                    raisedBedId,
                });
                if (
                    itemData.accountId &&
                    itemData.cartItemId &&
                    itemData.checkoutSessionId
                ) {
                    const accountId = itemData.accountId;
                    const cartItemId = itemData.cartItemId;
                    const checkoutSessionId = itemData.checkoutSessionId;
                    const incident =
                        await dependencies.createNotificationWithStatus(
                            {
                                accountId,
                                gardenId: itemData.gardenId,
                                raisedBedId,
                                header: 'Plaćena sadnja čeka provjeru',
                                content:
                                    'Plaćenu sadnju nismo postavili jer je odabrano polje u međuvremenu zauzeto. Zadatak je evidentiran za ponovni pokušaj i pregled tima farme.',
                                category: 'checkout_fulfillment',
                                type: 'checkout_planting_target_conflict',
                                primaryChannel: 'in_app',
                                priority: 'critical',
                                metadata: {
                                    cartItemId,
                                    checkoutSessionId,
                                    fulfillmentStatus: 'open',
                                    operatorOwner: 'farm_operations',
                                    recovery:
                                        'stripe_retry_then_manual_placement_or_refund',
                                    positionIndex,
                                    raisedBedId,
                                },
                                timestamp: new Date(),
                            },
                            {
                                idempotencyKey: `checkout-planting-target-conflict:${checkoutSessionId}:${cartItemId.toString()}`,
                                routeDelivery: false,
                            },
                        );
                    const operatorAlert =
                        await dependencies.deliverNotificationOperatorAlert(
                            incident.notificationId,
                            () =>
                                dependencies.notifyCheckoutFulfillmentIncident({
                                    accountId,
                                    cartItemId,
                                    checkoutSessionId,
                                    incidentId: incident.notificationId,
                                    positionIndex,
                                    raisedBedId,
                                }),
                        );
                    if (operatorAlert.status === 'failed') {
                        console.error(
                            'Checkout fulfillment incident operator alert failed and will be retried',
                            {
                                cartItemId,
                                checkoutSessionId,
                                error: operatorAlert.error,
                                incidentId: incident.notificationId,
                            },
                        );
                    }
                }
                if (itemData.accountId) {
                    (await dependencies.getPostHogClient()).capture({
                        distinctId: itemData.accountId,
                        event: 'checkout_planting_target_conflict',
                        properties: {
                            $insert_id: `checkout-planting-target-conflict:${itemData.checkoutSessionId ?? 'unknown'}:${itemData.cartItemId?.toString() ?? 'unknown'}`,
                            cart_item_id: itemData.cartItemId ?? null,
                            checkout_session_id:
                                itemData.checkoutSessionId ?? null,
                            position_index: positionIndex,
                            raised_bed_id: raisedBedId,
                        },
                    });
                }
            }
            throw error;
        }
        console.debug(
            placementResult === 'already-placed'
                ? `Plant sort ${itemData.entityId} was already placed in raised bed ${itemData.raisedBedId} at position ${itemData.positionIndex}.`
                : `Placed plant sort ${itemData.entityId} in raised bed ${itemData.raisedBedId} at position ${itemData.positionIndex}.`,
        );
        if (outletReservation && itemData.accountId) {
            (await dependencies.getPostHogClient()).capture({
                distinctId: itemData.accountId,
                event: 'outlet_reservation_converted',
                properties: {
                    $insert_id: `outlet-reservation-converted:${itemData.cartItemId?.toString() ?? outletReservation.id.toString()}`,
                    checkout_session_id: itemData.checkoutSessionId ?? null,
                    outlet_offer_id: outletReservation.outletOfferId,
                    outlet_reservation_id: outletReservation.id,
                    cart_item_id: itemData.cartItemId,
                },
            });
        }
        return { status: 'fulfilled' };
    } else {
        console.error(
            `Unsupported item type for entityId ${itemData.entityId} in order.`,
            itemData,
        );
        return { status: 'not_fulfilled', reason: 'unsupported_item' };
    }
}
