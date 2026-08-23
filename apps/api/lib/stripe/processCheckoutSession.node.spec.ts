import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import {
    fingerprintStripeCheckoutValue,
    RaisedBedPlantingError,
    StripePaymentProcessingClaimLostError,
    StripePaymentProcessingDeferredError,
    StripePaymentProcessingPermanentError,
    StripePaymentProcessingUnavailableError,
    SunflowerPackageAlreadyPurchasedError,
} from '@gredice/storage';
import {
    buildCheckoutInvoiceBillingSnapshot,
    buildCheckoutInvoiceLineItem,
} from '../billing/checkoutInvoiceDraft';
import { encodeHarvestDatesMetadata } from '../checkout/harvestCheckout';
import {
    __testUtils,
    type ProcessCheckoutSessionDependencies,
    processCheckoutSession,
    processCheckoutSessionForReconciliation,
    processItem,
} from './processCheckoutSession';

type RecordedCall = {
    name: string;
    args: unknown[];
};

function record(calls: RecordedCall[], name: string, args: unknown[] = []) {
    calls.push({ name, args });
}

function callNames(calls: RecordedCall[]) {
    return calls.map((call) => call.name);
}

function callsNamed(calls: RecordedCall[], name: string) {
    return calls.filter((call) => call.name === name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function advancedSowingAuthorization({
    anchorPositionIndex,
    selectedDistanceCm,
}: {
    anchorPositionIndex: number;
    selectedDistanceCm: number;
}) {
    return {
        kind: advancedSowingCartAuthorizationKind,
        plan: buildAdvancedSowingCartConfigurationV1({
            anchorPositionIndex,
            bedFieldCount: 18,
            maxDistanceCm: 60,
            minDistanceCm: 15,
            optimalDistanceCm: 30,
            selectedDistanceCm,
        }),
        version: 1 as const,
    };
}

function isRecordedEvent(value: unknown): value is {
    type: string;
    aggregateId: string;
    data: unknown;
} {
    return (
        isRecord(value) &&
        typeof value.type === 'string' &&
        typeof value.aggregateId === 'string' &&
        'data' in value
    );
}

function makeDependencies(
    calls: RecordedCall[],
    overrides: Partial<
        Record<keyof ProcessCheckoutSessionDependencies, unknown>
    > = {},
): ProcessCheckoutSessionDependencies {
    let completionOutputs: {
        orderConfirmationEmailMessageId: number;
        outputVersion: 1;
        purchaseNotificationEmailMessageId: number;
    } | null = null;
    const paidCartIds = new Set<number>();
    const checkoutFieldsByPosition = new Map([
        [
            2,
            {
                id: 88,
                positionIndex: 2,
                active: false,
                plantCycles: [],
            },
        ],
    ]);
    const readShoppingCart = async (...args: unknown[]) => {
        const override = overrides.getShoppingCart;
        if (typeof override === 'function') {
            const cart = await override(...args);
            return typeof args[0] === 'number' &&
                paidCartIds.has(args[0]) &&
                cart
                ? { ...cart, status: 'paid' }
                : cart;
        }
        record(calls, 'getShoppingCart', args);
        return null;
    };
    const writeEvent = async (...args: unknown[]) => {
        const override = overrides.createEvent;
        if (typeof override === 'function') {
            return override(...args);
        }
        record(calls, 'createEvent', args);
        return undefined;
    };
    const dependencies = {
        acquirePlantingScheduleTaskLock: async (...args: unknown[]) => {
            record(calls, 'acquirePlantingScheduleTaskLock', args);
        },
        isRaisedBedAbandoned: (status: unknown) => {
            record(calls, 'isRaisedBedAbandoned', [status]);
            return status === 'abandoned';
        },
        notifyCheckoutFulfillmentIncident: async (...args: unknown[]) => {
            record(calls, 'notifyCheckoutFulfillmentIncident', args);
        },
        consumeInventoryItem: async (...args: unknown[]) => {
            record(calls, 'consumeInventoryItem', args);
        },
        convertOutletReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'convertOutletReservationForCartItem', args);
        },
        bindStripeCheckoutAttempt: async (...args: unknown[]) => {
            record(calls, 'bindStripeCheckoutAttempt', args);
            return undefined;
        },
        getOrCreateDeliveryRequest: async (...args: unknown[]) => {
            record(calls, 'getOrCreateDeliveryRequest', args);
            return { created: true, requestId: 'delivery-request-701' };
        },
        createEvent: writeEvent,
        createLegacyRaisedBedPlantPlaceWithProjection: async (
            ...args: unknown[]
        ) => {
            const override =
                overrides.createLegacyRaisedBedPlantPlaceWithProjection;
            if (typeof override === 'function') {
                return override(...args);
            }
            record(
                calls,
                'createLegacyRaisedBedPlantPlaceWithProjection',
                args,
            );
            const input = args[0];
            if (!isRecord(input) || !('event' in input)) {
                throw new Error('Missing legacy plant-place event input.');
            }
            await writeEvent(input.event, args[1]);
            return undefined;
        },
        createRaisedBedPlanting: async (...args: unknown[]) => {
            const override = overrides.createRaisedBedPlanting;
            if (typeof override === 'function') {
                return override(...args);
            }
            record(calls, 'createRaisedBedPlanting', args);
            return { created: true, planting: {} };
        },
        ensureLegacyRaisedBedPlantingProjection: async (...args: unknown[]) => {
            record(calls, 'ensureLegacyRaisedBedPlantingProjection', args);
        },
        createNotificationWithStatus: async (...args: unknown[]) => {
            record(calls, 'createNotificationWithStatus', args);
            return { notificationId: 'notification-1', created: true };
        },
        deliverNotificationOperatorAlert: async (...args: unknown[]) => {
            record(calls, 'deliverNotificationOperatorAlert', args.slice(0, 1));
            const deliver = args[1];
            if (typeof deliver !== 'function') {
                throw new Error('Missing operator alert delivery callback.');
            }
            await deliver();
            return { attempted: true, status: 'sent' as const };
        },
        getOrCreateCheckoutOperation: async (...args: unknown[]) => {
            record(calls, 'getOrCreateCheckoutOperation', args);
            return { created: true, operationId: 501 };
        },
        createTransaction: async (...args: unknown[]) => {
            record(calls, 'createTransaction', args);
            return 901;
        },
        earnSunflowersForPayment: async (...args: unknown[]) => {
            record(calls, 'earnSunflowersForPayment', args);
        },
        ensureStripePaymentCompletionOutputs: async (...args: unknown[]) => {
            record(calls, 'ensureStripePaymentCompletionOutputs', args);
            completionOutputs = {
                orderConfirmationEmailMessageId: 4378,
                outputVersion: 1,
                purchaseNotificationEmailMessageId: 4379,
            };
            return {
                created: true,
                ...completionOutputs,
                status: 'ready' as const,
            };
        },
        ensureInvoiceForTransaction: async (...args: unknown[]) => {
            record(calls, 'ensureInvoiceForTransaction', args);
            return {
                status: 'created',
                invoiceId: 601,
                invoiceNumber: 'PON-2026-0001',
            };
        },
        getSunflowerPackageByCode: async (...args: unknown[]) => {
            record(calls, 'getSunflowerPackageByCode', args);
            return null;
        },
        issueReceiptForPaidInvoice: async (...args: unknown[]) => {
            record(calls, 'issueReceiptForPaidInvoice', args);
            return {
                status: 'created',
                receiptId: 701,
                receiptNumber: '1',
                yearReceiptNumber: '2026-1',
            };
        },
        fiscalizeReceipt: async (...args: unknown[]) => {
            record(calls, 'fiscalizeReceipt', args);
            return {
                status: 'confirmed',
                receiptId: 701,
                receiptNumber: '1',
                jir: 'jir-123',
                zki: 'zki-123',
            };
        },
        notifyBillingDocumentsEmail: async (...args: unknown[]) => {
            record(calls, 'notifyBillingDocumentsEmail', args);
            return { status: 'sent' };
        },
        getCompletedTransactionByStripePaymentId: async (
            ...args: unknown[]
        ) => {
            record(calls, 'getCompletedTransactionByStripePaymentId', args);
            return undefined;
        },
        getStripePaymentCompletionOutputs: async (...args: unknown[]) => {
            record(calls, 'getStripePaymentCompletionOutputs', args);
            return completionOutputs;
        },
        getCheckoutFulfillmentStartedCartItemIds: async (
            ...args: unknown[]
        ) => {
            record(calls, 'getCheckoutFulfillmentStartedCartItemIds', args);
            return new Set<number>();
        },
        getCheckoutOperationMapping: async (...args: unknown[]) => {
            record(calls, 'getCheckoutOperationMapping', args);
            return null;
        },
        getCheckoutOperationMappings: async (...args: unknown[]) => {
            record(calls, 'getCheckoutOperationMappings', args);
            return new Map();
        },
        hasMatchingCheckoutPlantingPurchase: async (...args: unknown[]) => {
            record(calls, 'hasMatchingCheckoutPlantingPurchase', args);
            return false;
        },
        getDefaultShoppingCartScheduledDate: (...args: unknown[]) => {
            record(calls, 'getDefaultShoppingCartScheduledDate', args);
            return '2026-07-02';
        },
        getOutletOfferReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'getOutletOfferReservationForCartItem', args);
            return null;
        },
        getRaisedBed: async (...args: unknown[]) => {
            record(calls, 'getRaisedBed', args);
            return { status: 'active' };
        },
        getRaisedBedPlantingByEventAggregateId: async (...args: unknown[]) => {
            record(calls, 'getRaisedBedPlantingByEventAggregateId', args);
            return null;
        },
        getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
            record(calls, 'getRaisedBedFieldsWithEvents', args);
            return [...checkoutFieldsByPosition.values()];
        },
        getStripeCheckoutAttempt: async (...args: unknown[]) => {
            record(calls, 'getStripeCheckoutAttempt', args);
            return undefined;
        },
        getAccountUsers: async (...args: unknown[]) => {
            record(calls, 'getAccountUsers', args);
            return [{ userId: 'user-1' }];
        },
        getUser: async (...args: unknown[]) => {
            record(calls, 'getUser', args);
            return { userName: 'buyer@example.test' };
        },
        isCartItemDeliverable: async (...args: unknown[]) => {
            record(calls, 'isCartItemDeliverable', args);
            return false;
        },
        knownEvents: {
            accounts: {
                sunflowersEarnedV1: (aggregateId: string, data: unknown) => ({
                    type: 'accounts.sunflowersEarned',
                    aggregateId,
                    data,
                }),
            },
            operations: {
                scheduledV1: (aggregateId: string, data: unknown) => ({
                    type: 'operations.scheduled',
                    aggregateId,
                    data,
                }),
            },
            raisedBedFields: {
                plantPlaceV1: (aggregateId: string, data: unknown) => ({
                    type: 'raisedBedFields.plantPlace',
                    aggregateId,
                    data,
                }),
                plantUpdateV1: (aggregateId: string, data: unknown) => ({
                    type: 'raisedBedFields.plantUpdate',
                    aggregateId,
                    data,
                }),
            },
        },
        lockAndActivateRaisedBedForCheckoutPlanting: async (
            ...args: unknown[]
        ) => {
            record(calls, 'lockAndActivateRaisedBedForCheckoutPlanting', args);
            return { available: true, activatedAccountId: null };
        },
        lockShoppingCartForCheckout: async (...args: unknown[]) => {
            record(calls, 'lockShoppingCartForCheckout', args.slice(0, 1));
            return readShoppingCart(...args);
        },
        markCartPaidIfAllItemsPaid: async (cartId: unknown) => {
            record(calls, 'markCartPaidIfAllItemsPaid', [cartId]);
            if (typeof cartId === 'number') paidCartIds.add(cartId);
        },
        normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
            record(calls, 'normalizeShoppingCartInventoryUsage', args);
            return {
                id: args[0],
                items: [],
            };
        },
        normalizeShoppingCartScheduledDates: async (...args: unknown[]) => {
            record(calls, 'normalizeShoppingCartScheduledDates', args);
            return undefined;
        },
        processReferralRewardsForAccount: async (...args: unknown[]) => {
            record(calls, 'processReferralRewardsForAccount', args);
            return { rewarded: false, reason: 'no_referral' as const };
        },
        setCartItemPaid: async (...args: unknown[]) => {
            record(calls, 'setCartItemPaid', args);
        },
        releaseStripeCheckoutAttempt: async (...args: unknown[]) => {
            record(calls, 'releaseStripeCheckoutAttempt', args);
        },
        spendSunflowersBatch: async (...args: unknown[]) => {
            record(calls, 'spendSunflowersBatch', args);
            const items = Array.isArray(args[1])
                ? (args[1] as Array<{ amount: number; reason: string }>)
                : [];
            const options = args[3];
            const legacyCartSpend =
                isRecord(options) && isRecord(options.legacyCartSpend)
                    ? options.legacyCartSpend
                    : undefined;
            const paidCoveredItems = Array.isArray(
                legacyCartSpend?.coveredItems,
            )
                ? legacyCartSpend.coveredItems.filter(
                      (item) => isRecord(item) && item.paymentState === 'paid',
                  )
                : [];
            return {
                createdReasons: items.map((item) => item.reason),
                existingReasons: [],
                resolvedAmountsByReason: Object.fromEntries([
                    ...items.map((item) => [item.reason, item.amount]),
                    ...paidCoveredItems.flatMap((item) =>
                        isRecord(item) &&
                        typeof item.reason === 'string' &&
                        typeof item.amount === 'number'
                            ? [[item.reason, item.amount]]
                            : [],
                    ),
                ]),
            };
        },
        topUpSunflowerPackage: async (...args: unknown[]) => {
            record(calls, 'topUpSunflowerPackage', args);
            return {
                topUp: { status: 'created', entry: { id: 801 } },
                bonus: { status: 'created', entry: { id: 802 } },
            };
        },
        upsertRaisedBedField: async (...args: unknown[]) => {
            record(calls, 'upsertRaisedBedField', args);
            const field = args[0];
            if (
                isRecord(field) &&
                typeof field.positionIndex === 'number' &&
                !checkoutFieldsByPosition.has(field.positionIndex)
            ) {
                checkoutFieldsByPosition.set(field.positionIndex, {
                    id: 88 + field.positionIndex,
                    positionIndex: field.positionIndex,
                    active: false,
                    plantCycles: [],
                });
            }
        },
        withPlantingScheduleTaskTransaction: async (...args: unknown[]) => {
            record(
                calls,
                'withPlantingScheduleTaskTransaction',
                args.slice(0, 2),
            );
            const callback = args[2];
            if (typeof callback !== 'function') {
                throw new Error('Missing planting transaction callback.');
            }
            return callback({ transaction: 'planting-test' });
        },
        withPlantingScheduleTaskFootprintTransaction: async (
            ...args: unknown[]
        ) => {
            record(
                calls,
                'withPlantingScheduleTaskFootprintTransaction',
                args.slice(0, 2),
            );
            const callback = args[2];
            if (typeof callback !== 'function') {
                throw new Error('Missing planting footprint callback.');
            }
            return callback({ transaction: 'planting-footprint-test' });
        },
        withCheckoutCartItemLock: async (...args: unknown[]) => {
            record(calls, 'withCheckoutCartItemLock', args.slice(0, 1));
            const callback = args[1];
            if (typeof callback !== 'function') {
                throw new Error('Missing checkout cart item lock callback.');
            }
            return callback({ transaction: 'checkout-item-test' });
        },
        withCheckoutCartItemLocks: async (...args: unknown[]) => {
            record(calls, 'withCheckoutCartItemLocks', args.slice(0, 1));
            const callback = args[1];
            if (typeof callback !== 'function') {
                throw new Error('Missing checkout cart item locks callback.');
            }
            return callback({ transaction: 'checkout-items-test' });
        },
        withCheckoutCartItemProcessingLock: async (...args: unknown[]) => {
            record(
                calls,
                'withCheckoutCartItemProcessingLock',
                args.slice(0, 1),
            );
            const callback = args[1];
            if (typeof callback !== 'function') {
                throw new Error(
                    'Missing checkout cart item processing lock callback.',
                );
            }
            return callback();
        },
        withCheckoutCartItemProcessingLocks: async (...args: unknown[]) => {
            record(
                calls,
                'withCheckoutCartItemProcessingLocks',
                args.slice(0, 1),
            );
            const callback = args[1];
            if (typeof callback !== 'function') {
                throw new Error(
                    'Missing checkout cart item processing locks callback.',
                );
            }
            return callback();
        },
        withInventoryAccountTransaction: async (...args: unknown[]) => {
            record(calls, 'withInventoryAccountTransaction', args.slice(0, 1));
            const callback = args[1];
            if (typeof callback !== 'function') {
                throw new Error('Missing inventory transaction callback.');
            }
            return callback(
                args[2] ?? { transaction: 'inventory-account-test' },
            );
        },
        withStripePaymentProcessingLock: async (
            id: string,
            callback: Parameters<
                ProcessCheckoutSessionDependencies['withStripePaymentProcessingLock']
            >[1],
        ) => {
            record(calls, 'withStripePaymentProcessingLock', [id]);
            return callback({
                assertOwned: async () => undefined,
                claimToken: 'test-claim-token',
                signal: new AbortController().signal,
            });
        },
        verifyStripeCheckoutAttemptLiveCart: async (...args: unknown[]) => {
            record(calls, 'verifyStripeCheckoutAttemptLiveCart', args);
            return { accountId: 'account-1', items: [] };
        },
        getStripeCheckoutSession: async (...args: unknown[]) => {
            record(calls, 'getStripeCheckoutSession', args);
            return undefined;
        },
        isBillingAutomationEnabled: (...args: unknown[]) => {
            record(calls, 'isBillingAutomationEnabled', args);
            return false;
        },
        buildCheckoutInvoiceBillingSnapshot: (...args: unknown[]) => {
            record(calls, 'buildCheckoutInvoiceBillingSnapshot', args);
            return buildCheckoutInvoiceBillingSnapshot(
                args[0] as Parameters<
                    typeof buildCheckoutInvoiceBillingSnapshot
                >[0],
            );
        },
        buildCheckoutInvoiceLineItem: (...args: unknown[]) => {
            record(calls, 'buildCheckoutInvoiceLineItem', args);
            return buildCheckoutInvoiceLineItem(
                args[0] as Parameters<typeof buildCheckoutInvoiceLineItem>[0],
            );
        },
        getCartInfo: async (...args: unknown[]) => {
            record(calls, 'getCartInfo', args);
            return {
                allowPurchase: true,
                notes: [],
                items: [],
            };
        },
        calculateSunflowerAmount: (...args: unknown[]) => {
            record(calls, 'calculateSunflowerAmount', args);
            return 5000;
        },
        buildOrderConfirmationItems: (...args: unknown[]) => {
            record(calls, 'buildOrderConfirmationItems', args);
            return [];
        },
        getPostHogClient: async (...args: unknown[]) => {
            record(calls, 'getPostHogClient', args);
            return {
                capture: (...captureArgs: unknown[]) => {
                    record(calls, 'posthog.capture', captureArgs);
                },
            };
        },
        ...overrides,
        getShoppingCart: readShoppingCart,
    };

    return dependencies as unknown as ProcessCheckoutSessionDependencies;
}

function makeSession() {
    return {
        customerId: 'cus_1',
        id: 'cs_paid',
        status: 'complete',
        paymentStatus: 'paid',
        amountTotal: 2500,
        lineItems: {
            data: [
                {
                    id: 'li_1',
                    quantity: 1,
                    amount_total: 2500,
                    amount_subtotal: 2500,
                    price: {
                        product: {
                            id: 'prod_1',
                            name: 'Planting',
                            metadata: {
                                accountId: 'account-1',
                                cartId: '100',
                                cartItemId: '1',
                                entityId: '42',
                                entityTypeName: 'operation',
                                userId: 'user-1',
                                gardenId: '200',
                                raisedBedId: '300',
                                positionIndex: '2',
                                additionalData: JSON.stringify({
                                    scheduledDate: '2026-07-01',
                                }),
                            },
                        },
                    },
                },
            ],
        },
    };
}

function makeSnapshotMetadata() {
    return {
        checkoutAttemptId: '5fe9b460-9b8d-4dd0-90a9-d05e46a3b0d5',
        checkoutCartId: '100',
        checkoutSnapshotVersion: '1',
    };
}

function makeNoPaymentRequiredSnapshotSession(amountTotal = 0) {
    return {
        ...makeSession(),
        amountTotal,
        metadata: makeSnapshotMetadata(),
        paymentStatus: 'no_payment_required',
    };
}

function makePlantingSession() {
    const session = makeSession();
    const [lineItem] = session.lineItems.data;
    const product = lineItem?.price.product;
    if (!lineItem || !product) {
        throw new Error('Planting checkout fixture is invalid.');
    }

    return {
        ...session,
        lineItems: {
            data: [
                {
                    ...lineItem,
                    price: {
                        product: {
                            ...product,
                            metadata: {
                                ...product.metadata,
                                entityId: '101',
                                entityTypeName: 'plantSort',
                            },
                        },
                    },
                },
            ],
        },
    };
}

function makeMultiLinePlantingSession() {
    const operationSession = makeSession();
    const plantingSession = makePlantingSession();
    const operationLineItem = operationSession.lineItems.data[0];
    const plantingLineItem = plantingSession.lineItems.data[0];
    const plantingProduct = plantingLineItem?.price.product;
    if (!operationLineItem || !plantingLineItem || !plantingProduct) {
        throw new Error('Multi-line checkout fixture is invalid.');
    }

    return {
        ...operationSession,
        amountTotal: 5000,
        lineItems: {
            data: [
                operationLineItem,
                {
                    ...plantingLineItem,
                    id: 'li_2',
                    price: {
                        product: {
                            ...plantingProduct,
                            id: 'prod_2',
                            name: 'Seedling',
                            metadata: {
                                ...plantingProduct.metadata,
                                cartId: '200',
                                cartItemId: '2',
                            },
                        },
                    },
                },
            ],
        },
    };
}

function makeSunflowerPackageSession({
    amountTotal = 4999,
    lineAmountTotal = 4999,
    lineAmountSubtotal = 4999,
    productMetadata = {},
}: {
    amountTotal?: number;
    lineAmountTotal?: number;
    lineAmountSubtotal?: number;
    productMetadata?: Record<string, string>;
} = {}) {
    return {
        id: 'cs_package_paid',
        status: 'complete',
        paymentStatus: 'paid',
        amountTotal,
        lineItems: {
            data: [
                {
                    id: 'li_package_1',
                    quantity: 1,
                    amount_total: lineAmountTotal,
                    amount_subtotal: lineAmountSubtotal,
                    price: {
                        product: {
                            id: 'prod_package_1',
                            name: 'Puna gredica',
                            metadata: {
                                kind: 'sunflowerPackage',
                                accountId: 'account-1',
                                userId: 'user-1',
                                entityTypeName: 'sunflowerPackage',
                                entityId: '77',
                                packageCode: 'puna_gredica',
                                packageRole: 'initial_one_time',
                                sunflowers: '60000',
                                baseSunflowers: '50000',
                                bonusSunflowers: '10000',
                                priceCents: '4999',
                                currency: 'eur',
                                ...productMetadata,
                            },
                        },
                    },
                },
            ],
        },
    };
}

function makeSunflowerPackageData() {
    return {
        entityId: 77,
        code: 'puna_gredica',
        name: 'Puna gredica',
        tag: 'Jednokratna ponuda',
        descriptionShort: 'Početni paket.',
        descriptionLong: 'Početni paket za Gredice saldo.',
        cta: 'Kupi paket',
        displayOrder: 10,
        priceCents: 4999,
        priceEur: 49.99,
        currency: 'eur',
        sunflowers: 60000,
        baseSunflowers: 50000,
        bonusSunflowers: 10000,
        bonusPercentage: 20,
        role: 'initial_one_time',
        isActive: true,
        isOneTime: true,
        oneTimeScope: 'account',
        upsellTriggerCode: null,
        showInPrimaryList: false,
        eligible: true,
    };
}

function makeCart() {
    return {
        id: 100,
        accountId: 'account-1',
        items: [
            {
                id: 1,
                status: 'open',
                entityId: '42',
                entityTypeName: 'operation',
                raisedBedId: 300,
            },
        ],
    };
}

function makePlantingCart(status: 'open' | 'paid' = 'open') {
    return {
        id: 100,
        accountId: 'account-1',
        status: status === 'paid' ? 'paid' : 'new',
        items: [
            {
                id: 1,
                status,
                entityId: '101',
                entityTypeName: 'plantSort',
                raisedBedId: 300,
            },
        ],
    };
}

function makeDetailedPlantingCart() {
    const cart = makePlantingCart();
    const item = cart.items[0];
    if (!item) {
        throw new Error('Planting cart fixture is invalid.');
    }
    return {
        ...cart,
        items: [
            {
                ...item,
                additionalData: JSON.stringify({
                    scheduledDate: '2026-07-01',
                }),
                amount: 1,
                cartId: cart.id,
                createdAt: new Date('2026-07-01T09:00:00.000Z'),
                currency: 'eur',
                gardenId: 200,
                positionIndex: 2,
            },
        ],
    };
}

function makeSunflowerCartItem() {
    return {
        id: 2,
        status: 'open',
        currency: 'sunflower',
        entityId: '99',
        entityTypeName: 'operation',
        cartId: 100,
        gardenId: 200,
        raisedBedId: 300,
        positionIndex: 3,
        amount: 1,
        additionalData: null,
        createdAt: new Date('2026-07-01T10:00:00.000Z'),
        entityData: { attributes: { deliverable: false } },
        usesInventory: false,
        shopData: {
            price: 5,
            discountPrice: null,
        },
    };
}

function createGate() {
    let openGate: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
        openGate = resolve;
    });
    return {
        wait,
        open: () => openGate?.(),
    };
}

function createAsyncMutex() {
    let previous = Promise.resolve();

    return async function runLocked<T>(callback: () => Promise<T>) {
        let release: (() => void) | undefined;
        const current = new Promise<void>((resolve) => {
            release = resolve;
        });
        const waitForPrevious = previous;
        previous = current;
        await waitForPrevious;
        try {
            return await callback();
        } finally {
            release?.();
        }
    };
}

async function assertCheckoutPlantingRace({
    checkoutFirst,
    terminalWriter,
}: {
    checkoutFirst: boolean;
    terminalWriter: 'block' | 'completion';
}) {
    const calls: RecordedCall[] = [];
    const runLocked = createAsyncMutex();
    const checkoutReadStarted = createGate();
    const releaseCheckoutRead = createGate();
    const scheduleWriterStarted = createGate();
    const releaseScheduleWriter = createGate();
    let pauseCheckoutRead = checkoutFirst;
    let downstreamAutomationRuns = 0;
    const writtenEvents: Array<{
        aggregateId: string;
        data: unknown;
        type: string;
    }> = [];
    const plantCycle = {
        active: true,
        plantPlaceEventId: 400,
        plantSortId: 99,
        plantStatus: 'planned',
        purchase: {
            cartItemId: 999,
            currency: 'eur',
            euroAmountCents: 1000,
        },
    };

    const dependencies = makeDependencies(calls, {
        withPlantingScheduleTaskTransaction: async (...args: unknown[]) => {
            record(
                calls,
                'withPlantingScheduleTaskTransaction',
                args.slice(0, 2),
            );
            const callback = args[2];
            if (typeof callback !== 'function') {
                throw new Error('Missing planting transaction callback.');
            }
            return runLocked(() => callback({ transaction: 'race-test' }));
        },
        getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
            record(calls, 'getRaisedBedFieldsWithEvents', args);
            if (pauseCheckoutRead) {
                pauseCheckoutRead = false;
                checkoutReadStarted.open();
                await releaseCheckoutRead.wait;
            }
            return [
                {
                    id: 88,
                    positionIndex: 2,
                    active: true,
                    plantStatus: plantCycle.plantStatus,
                    plantCycles: [plantCycle],
                },
            ];
        },
        createEvent: async (...args: unknown[]) => {
            record(calls, 'createEvent', args);
            const event = args[0];
            if (!isRecordedEvent(event)) {
                throw new Error('Race writer created an invalid event.');
            }
            writtenEvents.push(event);
            downstreamAutomationRuns += 1;
            if (
                event.type === 'raisedBedFields.plantUpdate' &&
                isRecord(event.data) &&
                typeof event.data.status === 'string'
            ) {
                plantCycle.plantStatus = event.data.status;
            } else if (event.type === 'raisedBedFields.plantBlock') {
                plantCycle.plantStatus = 'blocked';
            }
        },
    });

    const writeTerminalState = () =>
        dependencies.withPlantingScheduleTaskTransaction(
            300,
            2,
            async (transaction) => {
                scheduleWriterStarted.open();
                if (!checkoutFirst) {
                    await releaseScheduleWriter.wait;
                }
                if (terminalWriter === 'completion') {
                    await dependencies.createEvent(
                        {
                            type: 'raisedBedFields.plantUpdate',
                            version: 1,
                            aggregateId: '300|2',
                            data: {
                                status: 'pendingVerification',
                                images: ['https://example.test/proof.webp'],
                            },
                        },
                        transaction,
                    );
                } else {
                    await dependencies.createEvent(
                        {
                            type: 'raisedBedFields.plantBlock',
                            version: 1,
                            aggregateId: '300|2',
                            data: {
                                reasonCode: 'weather',
                                images: ['https://example.test/blocker.webp'],
                            },
                        },
                        transaction,
                    );
                }
            },
        );

    const writeCheckoutPlanting = () =>
        processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 1,
                checkoutSessionId: 'cs_race',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

    if (checkoutFirst) {
        const checkoutPromise = writeCheckoutPlanting();
        await checkoutReadStarted.wait;
        const terminalPromise = writeTerminalState();
        releaseCheckoutRead.open();
        await assert.rejects(checkoutPromise, /active plant cycle/);
        await terminalPromise;
    } else {
        const terminalPromise = writeTerminalState();
        await scheduleWriterStarted.wait;
        const checkoutPromise = writeCheckoutPlanting();
        releaseScheduleWriter.open();
        await terminalPromise;
        await assert.rejects(checkoutPromise, /active plant cycle/);
    }

    assert.equal(writtenEvents.length, 1);
    assert.equal(
        writtenEvents.filter(
            (event) => event.type === 'raisedBedFields.plantPlace',
        ).length,
        0,
    );
    assert.equal(writtenEvents[0]?.aggregateId, '300|2');
    assert.equal(plantCycle.plantPlaceEventId, 400);
    assert.equal(
        plantCycle.plantStatus,
        terminalWriter === 'completion' ? 'pendingVerification' : 'blocked',
    );
    assert.equal(downstreamAutomationRuns, 1);
}

describe('processCheckoutSession', () => {
    it('suppresses fulfillment when a completed transaction already has both durable outputs', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return { id: 123 };
            },
            getStripePaymentCompletionOutputs: async (...args: unknown[]) => {
                record(calls, 'getStripePaymentCompletionOutputs', args);
                return {
                    orderConfirmationEmailMessageId: 11,
                    outputVersion: 1,
                    purchaseNotificationEmailMessageId: 12,
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callNames(calls), [
            'withStripePaymentProcessingLock',
            'getStripeCheckoutSession',
            'getCompletedTransactionByStripePaymentId',
            'getStripePaymentCompletionOutputs',
        ]);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
    });

    it('repairs outputs when a transaction commits after the migration snapshot without replaying side effects', async () => {
        const calls: RecordedCall[] = [];
        let claimStatus: 'missing' | 'processing' | 'completed' = 'missing';
        const dependencies = makeDependencies(calls, {
            withStripePaymentProcessingLock: async (
                id: string,
                callback: Parameters<
                    ProcessCheckoutSessionDependencies['withStripePaymentProcessingLock']
                >[1],
            ) => {
                record(calls, 'withStripePaymentProcessingLock', [id]);
                assert.equal(claimStatus, 'missing');
                claimStatus = 'processing';
                const result = await callback({
                    assertOwned: async () => undefined,
                    claimToken: 'post-snapshot-claim-token',
                    signal: new AbortController().signal,
                });
                claimStatus = 'completed';
                return result;
            },
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return {
                    accountId: 'account-1',
                    amount: 2500,
                    currency: 'eur',
                    id: 123,
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return {
                    ...cart,
                    items: cart.items.map((item) => ({
                        ...item,
                        status: 'paid',
                    })),
                    status: 'paid',
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(claimStatus, 'completed');
        assert.equal(
            callsNamed(calls, 'withStripePaymentProcessingLock').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'getCompletedTransactionByStripePaymentId')
                .length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            0,
        );
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureInvoiceForTransaction').length,
            0,
        );
        assert.equal(callsNamed(calls, 'posthog.capture').length, 0);
    });

    it('repairs zero-total completion outputs without attempt history or fulfillment replay', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeNoPaymentRequiredSnapshotSession();
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return {
                    accountId: 'account-1',
                    amount: 0,
                    currency: 'eur',
                    id: 123,
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return {
                    ...cart,
                    items: cart.items.map((item) => ({
                        ...item,
                        status: 'paid',
                    })),
                    status: 'paid',
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            1,
        );
        const output = callsNamed(
            calls,
            'ensureStripePaymentCompletionOutputs',
        )[0]?.args[0];
        assert.ok(isRecord(output));
        assert.ok(isRecord(output.orderConfirmation));
        assert.equal(output.orderConfirmation.totalAmountCents, 0);
        assert.ok(isRecord(output.purchaseNotification));
        assert.equal(output.purchaseNotification.amountTotal, 0);
        assert.equal(
            callsNamed(calls, 'releaseStripeCheckoutAttempt').length,
            0,
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
    });

    it('still requires attempt history for first fulfillment of a zero-total no-payment-required snapshot', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeNoPaymentRequiredSnapshotSession();
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'checkout_attempt_attempt_missing',
        );

        assert.equal(
            callsNamed(calls, 'withStripePaymentProcessingLock').length,
            1,
        );
        assert.equal(callsNamed(calls, 'getStripeCheckoutAttempt').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
    });

    it('rejects no-payment-required sessions without both a zero total and snapshot metadata', async () => {
        const rejectedSessions = [
            {
                ...makeNoPaymentRequiredSnapshotSession(1),
                id: 'cs_nonzero_no_payment_required',
            },
            {
                ...makeNoPaymentRequiredSnapshotSession(),
                id: 'cs_no_snapshot',
                metadata: undefined,
            },
        ];

        for (const session of rejectedSessions) {
            const calls: RecordedCall[] = [];
            const dependencies = makeDependencies(calls, {
                getStripeCheckoutSession: async (...args: unknown[]) => {
                    record(calls, 'getStripeCheckoutSession', args);
                    return session;
                },
            });

            await assert.rejects(
                processCheckoutSession(session.id, dependencies),
                (error: unknown) =>
                    error instanceof StripePaymentProcessingPermanentError &&
                    error.failureCode === 'checkout_session_unpaid',
            );

            assert.deepStrictEqual(callNames(calls), [
                'withStripePaymentProcessingLock',
                'getStripeCheckoutSession',
            ]);
        }
    });

    it('defers a complete unpaid session, then fulfills its paid state exactly once', async () => {
        const calls: RecordedCall[] = [];
        let paid = false;
        let completed = false;
        const dependencies = makeDependencies(calls, {
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ active: true, id: 88, positionIndex: 2 }];
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    paymentStatus: paid ? 'paid' : 'unpaid',
                };
            },
            withStripePaymentProcessingLock: async (
                id: string,
                callback: Parameters<
                    ProcessCheckoutSessionDependencies['withStripePaymentProcessingLock']
                >[1],
            ) => {
                record(calls, 'withStripePaymentProcessingLock', [id]);
                if (completed) return undefined;
                const result = await callback({
                    assertOwned: async () => undefined,
                    claimToken: 'deferred-test-claim-token',
                    signal: new AbortController().signal,
                });
                completed = true;
                return result;
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingDeferredError &&
                error.failureCode === 'checkout_session_payment_pending',
        );
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            0,
        );

        paid = true;
        await processCheckoutSession('cs_paid', dependencies);
        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            1,
        );
    });

    it('rejects an invalid paid-session amount before fulfillment', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return { ...makeSession(), amountTotal: null };
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'checkout_session_amount_invalid',
        );

        assert.equal(callsNamed(calls, 'getShoppingCart').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('does not retrieve Stripe for a terminal durable claim', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            withStripePaymentProcessingLock: async (id: string) => {
                record(calls, 'withStripePaymentProcessingLock', [id]);
                return undefined;
            },
        });

        await processCheckoutSession('cs_terminal', dependencies);

        assert.deepStrictEqual(callNames(calls), [
            'withStripePaymentProcessingLock',
        ]);
    });

    it('propagates claim contention to webhooks but suppresses it for reconciliation', async (t) => {
        t.mock.method(console, 'info', () => undefined);
        const calls: RecordedCall[] = [];
        const unavailable = new StripePaymentProcessingUnavailableError(
            'cs_inflight',
            'processing',
            new Date('2026-08-04T10:01:00.000Z'),
            2,
        );
        const dependencies = makeDependencies(calls, {
            withStripePaymentProcessingLock: async (id: string) => {
                record(calls, 'withStripePaymentProcessingLock', [id]);
                throw unavailable;
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_inflight', dependencies),
            (error: unknown) => error === unavailable,
        );
        await processCheckoutSessionForReconciliation(
            'cs_inflight',
            dependencies,
        );

        assert.deepStrictEqual(
            callsNamed(calls, 'withStripePaymentProcessingLock').map(
                (call) => call.args,
            ),
            [['cs_inflight'], ['cs_inflight']],
        );
        assert.equal(callsNamed(calls, 'getStripeCheckoutSession').length, 0);
    });

    it('classifies Stripe resource-missing as permanent but preserves transport timeouts as retryable', async () => {
        const missingCalls: RecordedCall[] = [];
        const missingDependencies = makeDependencies(missingCalls, {
            getStripeCheckoutSession: async () => {
                throw Object.assign(new Error('missing'), {
                    code: 'resource_missing',
                    statusCode: 404,
                });
            },
        });
        await assert.rejects(
            processCheckoutSession('cs_missing', missingDependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'checkout_session_missing',
        );

        const timeout = new Error('request timed out');
        timeout.name = 'StripeConnectionError';
        const timeoutDependencies = makeDependencies([], {
            getStripeCheckoutSession: async () => {
                throw timeout;
            },
        });
        await assert.rejects(
            processCheckoutSession('cs_timeout', timeoutDependencies),
            (error: unknown) => error === timeout,
        );
    });

    it('marks a Stripe-paid cart item paid, records the transaction, and awards sunflowers', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callNames(calls).filter((name) =>
                [
                    'setCartItemPaid',
                    'getOrCreateCheckoutOperation',
                    'earnSunflowersForPayment',
                    'markCartPaidIfAllItemsPaid',
                    'createTransaction',
                ].includes(name),
            ),
            [
                'earnSunflowersForPayment',
                'getOrCreateCheckoutOperation',
                'setCartItemPaid',
                'markCartPaidIfAllItemsPaid',
                'createTransaction',
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid')[0]?.args,
            [1],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemLock')[0]?.args,
            [1],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemProcessingLock')[0]?.args,
            [1],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            [
                'account-1',
                25,
                'shoppingCartItem:1',
                { transaction: 'checkout-item-test' },
                { legacyRewardAlreadyEarned: false },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'markCartPaidIfAllItemsPaid')[0]?.args,
            [100],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'createTransaction')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    amount: 2500,
                    stripePaymentId: 'cs_paid',
                    status: 'completed',
                    currency: 'eur',
                },
            ],
        );
        assert.equal(
            callsNamed(calls, 'ensureInvoiceForTransaction').length,
            0,
        );
    });

    it('uses captured sunflower amount when the catalog price changes while Stripe is open', async () => {
        const calls: RecordedCall[] = [];
        const createdAt = new Date('2026-07-01T09:00:00.000Z');
        const euroItem = {
            additionalData: null,
            amount: 1,
            cartId: 100,
            createdAt,
            currency: 'eur',
            entityId: '42',
            entityTypeName: 'operation',
            gardenId: 200,
            id: 1,
            isDeleted: false,
            positionIndex: 2,
            raisedBedId: 300,
            status: 'paid',
            updatedAt: createdAt,
        };
        const sunflowerItem = {
            ...euroItem,
            additionalData: JSON.stringify({
                scheduledDate: '2026-07-01',
            }),
            currency: 'sunflower',
            entityId: '99',
            id: 2,
            positionIndex: 3,
            status: 'new',
        };
        const cart = {
            accountId: 'account-1',
            createdAt,
            id: 100,
            isDeleted: false,
            items: [euroItem, sunflowerItem],
            status: 'new',
            updatedAt: createdAt,
        };
        const attempt = {
            sessionId: 'cs_snapshot_drift',
            snapshot: {
                attemptId: '5fe9b460-9b8d-4dd0-90a9-d05e46a3b0d5',
                cartId: 100,
                expectedNonStripeCartItemIds: [2],
                harvestDates: [],
                items: [
                    {
                        additionalDataFingerprint:
                            fingerprintStripeCheckoutValue(null),
                        amount: 1,
                        cartId: 100,
                        checkoutAdditionalDataFingerprint:
                            fingerprintStripeCheckoutValue({
                                scheduledDate: '2026-07-01',
                            }),
                        currency: 'eur',
                        entityId: '42',
                        entityTypeName: 'operation',
                        gardenId: 200,
                        id: 1,
                        paymentAmount: 2500,
                        paymentKind: 'stripe' as const,
                        positionIndex: 2,
                        raisedBedId: 300,
                        status: 'new' as const,
                    },
                    {
                        additionalDataFingerprint:
                            fingerprintStripeCheckoutValue(
                                sunflowerItem.additionalData,
                            ),
                        amount: 1,
                        cartId: 100,
                        checkoutAdditionalDataFingerprint:
                            fingerprintStripeCheckoutValue({
                                scheduledDate: '2026-07-01',
                            }),
                        currency: 'sunflower',
                        entityId: '99',
                        entityTypeName: 'operation',
                        gardenId: 200,
                        id: 2,
                        paymentAmount: 275,
                        paymentKind: 'sunflower' as const,
                        positionIndex: 3,
                        raisedBedId: 300,
                        status: 'new' as const,
                    },
                ],
                stripeSession: {
                    allowPromotionCodes: true,
                    customerFingerprint:
                        fingerprintStripeCheckoutValue('cus_1'),
                    expiresAt: '2026-08-04T00:00:00.000Z',
                    items: [
                        {
                            cartItemId: 1,
                            price: {
                                currency: 'eur' as const,
                                valueInCents: 2500,
                            },
                            product: { name: 'Planting' },
                            quantity: 1,
                        },
                    ],
                    returnUrls: {
                        cancel: 'https://example.test/cancel',
                        success: 'https://example.test/success',
                    },
                },
                userFingerprint: fingerprintStripeCheckoutValue('user-1'),
                version: 1 as const,
            },
        };
        const enrichedItems = [
            {
                ...euroItem,
                entityData: { attributes: { deliverable: false } },
                inventoryAvailable: 0,
                shopData: { price: 25 },
                usesInventory: false,
            },
            {
                ...sunflowerItem,
                entityData: { attributes: { deliverable: false } },
                inventoryAvailable: 0,
                // The live catalog has drifted from 0.275 to 999. The debit
                // must still use the amount captured before Stripe opened.
                shopData: { price: 999 },
                usesInventory: false,
            },
        ];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async () => ({
                ...makeSession(),
                id: 'cs_snapshot_drift',
                metadata: {
                    checkoutAttemptId: attempt.snapshot.attemptId,
                    checkoutCartId: '100',
                    checkoutSnapshotVersion: '1',
                    harvestDatesChunkCount: '0',
                    harvestDatesVersion: '1',
                    nonStripeCartItemIds0: '[2]',
                    nonStripeCartItemIdsChunkCount: '1',
                },
                lineItems: {
                    data: [
                        {
                            ...makeSession().lineItems.data[0],
                            price: {
                                ...makeSession().lineItems.data[0]?.price,
                                currency: 'eur',
                                unit_amount: 2500,
                            },
                        },
                    ],
                },
            }),
            getStripeCheckoutAttempt: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutAttempt', args);
                return attempt;
            },
            verifyStripeCheckoutAttemptLiveCart: async (...args: unknown[]) => {
                record(calls, 'verifyStripeCheckoutAttemptLiveCart', args);
                return { accountId: 'account-1', items: cart.items };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return cart;
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return cart;
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    // A live EUR catalog price can now fail the minimum-order
                    // validation, but it must not strand an already captured
                    // Stripe checkout snapshot.
                    allowPurchase: false,
                    notes: ['live catalog value is below the minimum'],
                    items: enrichedItems,
                };
            },
        });

        await processCheckoutSession('cs_snapshot_drift', dependencies);

        const spend = callsNamed(calls, 'spendSunflowersBatch')[0];
        assert.ok(spend);
        assert.deepStrictEqual(spend.args[1], [
            { amount: 275, reason: 'shoppingCartItem:2' },
        ]);
        assert.equal(callsNamed(calls, 'calculateSunflowerAmount').length, 0);
        assert.equal(
            callsNamed(calls, 'releaseStripeCheckoutAttempt').length,
            1,
        );
    });

    it('stops finalization when the durable Stripe claim is lost after fulfillment', async () => {
        const calls: RecordedCall[] = [];
        let ownershipChecks = 0;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            withStripePaymentProcessingLock: async (
                _stripePaymentId: string,
                callback: Parameters<
                    ProcessCheckoutSessionDependencies['withStripePaymentProcessingLock']
                >[1],
            ) =>
                callback({
                    assertOwned: async () => {
                        ownershipChecks += 1;
                        if (ownershipChecks === 7) {
                            throw new StripePaymentProcessingClaimLostError(
                                'cs_paid',
                            );
                        }
                    },
                    claimToken: 'lost-claim-token',
                    signal: new AbortController().signal,
                }),
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            StripePaymentProcessingClaimLostError,
        );
        assert.strictEqual(ownershipChecks, 7);
        assert.strictEqual(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        assert.strictEqual(
            callsNamed(calls, 'notifyOperationUpdate').length,
            0,
        );
        assert.strictEqual(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.strictEqual(callsNamed(calls, 'createTransaction').length, 0);
        assert.strictEqual(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            0,
        );
    });

    it('passes exact legacy planting evidence into the keyed payment reward', async () => {
        for (const legacyRewardAlreadyEarned of [false, true]) {
            const calls: RecordedCall[] = [];
            const plantingCart = makeDetailedPlantingCart();
            const dependencies = makeDependencies(calls, {
                getStripeCheckoutSession: async (...args: unknown[]) => {
                    record(calls, 'getStripeCheckoutSession', args);
                    return makePlantingSession();
                },
                getShoppingCart: async (...args: unknown[]) => {
                    record(calls, 'getShoppingCart', args);
                    return plantingCart;
                },
                getRaisedBed: async (...args: unknown[]) => {
                    record(calls, 'getRaisedBed', args);
                    return { status: 'active' };
                },
                hasMatchingCheckoutPlantingPurchase: async (
                    ...args: unknown[]
                ) => {
                    record(calls, 'hasMatchingCheckoutPlantingPurchase', args);
                    return legacyRewardAlreadyEarned;
                },
            });

            await processCheckoutSession('cs_paid', dependencies);

            assert.deepStrictEqual(
                callsNamed(calls, 'hasMatchingCheckoutPlantingPurchase')[0]
                    ?.args,
                [
                    {
                        cartItemId: 1,
                        euroAmountCents: 2_500,
                        plantSortId: '101',
                        positionIndex: 2,
                        raisedBedId: 300,
                    },
                    { transaction: 'checkout-item-test' },
                ],
            );
            assert.deepStrictEqual(
                callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
                [
                    'account-1',
                    25,
                    'shoppingCartItem:1',
                    { transaction: 'checkout-item-test' },
                    { legacyRewardAlreadyEarned },
                ],
            );
        }
    });

    it('fails before rewarding or fulfilling when legacy planting evidence conflicts', async () => {
        const calls: RecordedCall[] = [];
        const plantingCart = makeDetailedPlantingCart();
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makePlantingSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return plantingCart;
            },
            hasMatchingCheckoutPlantingPurchase: async (...args: unknown[]) => {
                record(calls, 'hasMatchingCheckoutPlantingPurchase', args);
                throw new Error('legacy planting purchase conflicts');
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /legacy planting purchase conflicts/,
        );

        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 0);
        assert.equal(callsNamed(calls, 'createEvent').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('rejects Stripe metadata that does not match the cart owner before any payment effect', async () => {
        const calls: RecordedCall[] = [];
        const session = makeSession();
        const lineItem = session.lineItems.data[0];
        const product = lineItem?.price.product;
        assert.ok(lineItem && product);
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...session,
                    lineItems: {
                        data: [
                            {
                                ...lineItem,
                                price: {
                                    product: {
                                        ...product,
                                        metadata: {
                                            ...product.metadata,
                                            accountId: 'different-account',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /metadata account does not own cart/u,
        );

        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('retries operation fulfillment before marking a Stripe-paid item complete', async () => {
        const calls: RecordedCall[] = [];
        let itemStatus = 'open';
        let operationAttempts = 0;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return {
                    ...makeCart(),
                    status: itemStatus === 'paid' ? 'paid' : 'new',
                    items: [{ ...makeCart().items[0], status: itemStatus }],
                };
            },
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                operationAttempts += 1;
                if (operationAttempts === 1) {
                    throw new Error('transient schedule transaction failure');
                }
                return { created: true, operationId: 501 };
            },
            setCartItemPaid: async (...args: unknown[]) => {
                record(calls, 'setCartItemPaid', args);
                itemStatus = 'paid';
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /transient schedule transaction failure/,
        );
        assert.strictEqual(itemStatus, 'open');
        assert.strictEqual(callsNamed(calls, 'createTransaction').length, 0);

        await processCheckoutSession('cs_paid', dependencies);
        assert.strictEqual(itemStatus, 'paid');
        assert.strictEqual(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            2,
        );
        assert.strictEqual(callsNamed(calls, 'setCartItemPaid').length, 1);
        assert.strictEqual(callsNamed(calls, 'createTransaction').length, 1);
    });

    it('keeps a Stripe-paid operation open when its raised bed was deleted', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return null;
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /raised_bed_unavailable/,
        );

        assert.equal(callsNamed(calls, 'getRaisedBed').length, 1);
        assert.equal(callsNamed(calls, 'upsertRaisedBedField').length, 0);
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            0,
        );
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('finishes a mapped Stripe operation after its raised bed is abandoned', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getCheckoutOperationMapping: async (...args: unknown[]) => {
                record(calls, 'getCheckoutOperationMapping', args);
                return {
                    operationId: 501,
                    accountId: 'account-1',
                    entityId: 42,
                    entityTypeName: 'operation',
                    farmId: null,
                    gardenId: 200,
                    raisedBedId: 300,
                    raisedBedFieldId: 88,
                    operationTimestamp: null,
                    paymentCurrency: 'eur',
                    delivery: null,
                    scheduledDate: '2026-07-01T00:00:00.000Z',
                    accepted: false,
                };
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'abandoned' };
            },
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                return { created: false, operationId: 501 };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(
            callsNamed(calls, 'getCheckoutOperationMapping').length,
            1,
        );
        assert.equal(callsNamed(calls, 'getRaisedBed').length, 0);
        assert.equal(callsNamed(calls, 'isRaisedBedAbandoned').length, 0);
        assert.deepEqual(callsNamed(calls, 'setCartItemPaid')[0]?.args, [1]);
        const operationCall = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        )[0];
        assert.ok(operationCall);
        const operationInput = operationCall.args[1];
        assert.ok(isRecord(operationInput));
        assert.equal(operationInput.raisedBedFieldId, 88);
        const operationOptions = operationCall.args[2];
        assert.ok(isRecord(operationOptions));
        assert.ok(operationOptions.scheduledDate instanceof Date);
        assert.equal(
            operationOptions.scheduledDate.toISOString(),
            '2026-07-01T00:00:00.000Z',
        );
    });

    it('generates an invoice from mapped Stripe line items when billing automation is enabled', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            isBillingAutomationEnabled: (...args: unknown[]) => {
                record(calls, 'isBillingAutomationEnabled', args);
                return true;
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'ensureInvoiceForTransaction')[0]?.args,
            [
                {
                    transactionId: 901,
                    billingSnapshot: {
                        billToCountry: 'Hrvatska',
                        billToEmail: 'buyer@example.test',
                        billToName: undefined,
                        notes: 'Generirano iz plaćene Gredice checkout transakcije.',
                    },
                    items: [
                        {
                            description: 'Planting',
                            entityId: '42',
                            entityTypeName: 'operation',
                            quantity: 1,
                            unitPriceCents: 2500,
                            totalPriceCents: 2500,
                        },
                    ],
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'issueReceiptForPaidInvoice')[0]?.args,
            [
                {
                    invoiceId: 601,
                    paymentReference: 'cs_paid',
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'fiscalizeReceipt')[0]?.args,
            [701],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'notifyBillingDocumentsEmail')[0]?.args,
            [
                {
                    to: 'buyer@example.test',
                    cartIds: [100],
                    checkoutSessionId: 'cs_paid',
                    invoiceId: 601,
                    invoiceNumber: 'PON-2026-0001',
                    receiptId: 701,
                    receiptNumber: '2026-1',
                },
            ],
        );
        const billingCallOrder = callNames(calls);
        assert.ok(
            billingCallOrder.indexOf('createTransaction') <
                billingCallOrder.indexOf(
                    'ensureStripePaymentCompletionOutputs',
                ),
        );
        assert.ok(
            billingCallOrder.indexOf('ensureStripePaymentCompletionOutputs') <
                billingCallOrder.indexOf('ensureInvoiceForTransaction'),
        );
    });

    it('fulfills a paid sunflower package without cart processing or loyalty earning', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSunflowerPackageSession();
            },
            getSunflowerPackageByCode: async (...args: unknown[]) => {
                record(calls, 'getSunflowerPackageByCode', args);
                return makeSunflowerPackageData();
            },
            isBillingAutomationEnabled: (...args: unknown[]) => {
                record(calls, 'isBillingAutomationEnabled', args);
                return true;
            },
        });

        await processCheckoutSession('cs_package_paid', dependencies);

        assert.equal(callsNamed(calls, 'getShoppingCart').length, 0);
        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 0);
        assert.deepStrictEqual(
            callsNamed(calls, 'topUpSunflowerPackage')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    packageCode: 'puna_gredica',
                    packageEntityId: 77,
                    sunflowers: 60000,
                    bonusSunflowers: 10000,
                    priceCents: 4999,
                    idempotencyKey:
                        'stripe:cs_package_paid:sunflowerPackage:puna_gredica',
                    enforceOneTime: true,
                    sourceType: 'stripeCheckoutSession',
                    sourceId: 'cs_package_paid',
                    reason: 'sunflowerPackage:puna_gredica',
                    metadata: {
                        checkoutSessionId: 'cs_package_paid',
                        lineItemId: 'li_package_1',
                        packageRole: 'initial_one_time',
                        catalogPriceCents: 4999,
                        paidAmountCents: 4999,
                    },
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'createTransaction')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    amount: 4999,
                    stripePaymentId: 'cs_package_paid',
                    status: 'completed',
                    currency: 'eur',
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'ensureInvoiceForTransaction')[0]?.args,
            [
                {
                    transactionId: 901,
                    billingSnapshot: {
                        billToCountry: 'Hrvatska',
                        billToEmail: 'buyer@example.test',
                        billToName: undefined,
                        notes: 'Generirano iz plaćene Gredice checkout transakcije.',
                    },
                    items: [
                        {
                            description: 'Puna gredica',
                            quantity: 1,
                            unitPriceCents: 4999,
                            totalPriceCents: 4999,
                            entityId: '77',
                            entityTypeName: 'sunflowerPackage',
                        },
                    ],
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs')[0]?.args,
            [
                {
                    claimToken: 'test-claim-token',
                    orderConfirmation: {
                        cartId: null,
                        currency: 'eur',
                        items: [
                            {
                                amountSubtotal: 4999,
                                currency: 'eur',
                                name: 'Puna gredica',
                                quantity: 1,
                            },
                        ],
                        manageUrl: 'https://vrt.gredice.com',
                        to: 'buyer@example.test',
                        totalAmountCents: 4999,
                    },
                    purchaseNotification: {
                        accountId: 'account-1',
                        amountTotal: 4999,
                        checkoutSessionId: 'cs_package_paid',
                        currency: 'eur',
                        customerEmail: 'buyer@example.test',
                        items: [
                            {
                                amountSubtotal: 4999,
                                name: 'Puna gredica',
                                quantity: 1,
                            },
                        ],
                    },
                    stripePaymentId: 'cs_package_paid',
                },
            ],
        );
        const packageCallOrder = callNames(calls);
        assert.ok(
            packageCallOrder.indexOf('createTransaction') <
                packageCallOrder.indexOf(
                    'ensureStripePaymentCompletionOutputs',
                ),
        );
        assert.ok(
            packageCallOrder.indexOf('ensureStripePaymentCompletionOutputs') <
                packageCallOrder.indexOf('ensureInvoiceForTransaction'),
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'posthog.capture').at(-1)?.args,
            [
                {
                    distinctId: 'account-1',
                    event: 'sunflower_package_fulfilled',
                    properties: {
                        checkout_session_id: 'cs_package_paid',
                        transaction_id: 901,
                        package_code: 'puna_gredica',
                        package_role: 'initial_one_time',
                        price_cents: 4999,
                        paid_amount_cents: 4999,
                        sunflowers: 60000,
                        bonus_sunflowers: 10000,
                        duplicate_one_time_purchase: false,
                        ledger_entry_ids: [801, 802],
                    },
                },
            ],
        );
    });

    it('fulfills a discounted paid sunflower package with the actual paid amount', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSunflowerPackageSession({
                    amountTotal: 3999,
                    lineAmountTotal: 3999,
                    lineAmountSubtotal: 4999,
                });
            },
            getSunflowerPackageByCode: async (...args: unknown[]) => {
                record(calls, 'getSunflowerPackageByCode', args);
                return makeSunflowerPackageData();
            },
        });

        await processCheckoutSession('cs_package_paid', dependencies);

        const topUpInput = callsNamed(calls, 'topUpSunflowerPackage')[0]
            ?.args[0];
        assert.ok(isRecord(topUpInput));
        assert.equal(topUpInput.priceCents, 3999);
        assert.deepStrictEqual(
            callsNamed(calls, 'createTransaction')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    amount: 3999,
                    stripePaymentId: 'cs_package_paid',
                    status: 'completed',
                    currency: 'eur',
                },
            ],
        );
        const outputInput = callsNamed(
            calls,
            'ensureStripePaymentCompletionOutputs',
        )[0]?.args[0];
        assert.ok(isRecord(outputInput));
        assert.ok(isRecord(outputInput.orderConfirmation));
        assert.equal(outputInput.orderConfirmation.totalAmountCents, 3999);
        assert.ok(isRecord(outputInput.purchaseNotification));
        assert.equal(outputInput.purchaseNotification.amountTotal, 3999);
        assert.equal(
            callsNamed(calls, 'posthog.capture').some((call) => {
                const event = call.args[0];
                return (
                    isRecord(event) &&
                    event.event === 'sunflower_package_fulfillment_failed'
                );
            }),
            false,
        );
    });

    it('repairs sunflower package outputs from the Stripe snapshot after catalog retirement or change', async () => {
        for (const catalogValue of [
            null,
            { ...makeSunflowerPackageData(), name: 'Preimenovani paket' },
        ]) {
            const calls: RecordedCall[] = [];
            const dependencies = makeDependencies(calls, {
                getStripeCheckoutSession: async (...args: unknown[]) => {
                    record(calls, 'getStripeCheckoutSession', args);
                    return makeSunflowerPackageSession();
                },
                getCompletedTransactionByStripePaymentId: async (
                    ...args: unknown[]
                ) => {
                    record(
                        calls,
                        'getCompletedTransactionByStripePaymentId',
                        args,
                    );
                    return {
                        accountId: 'account-1',
                        amount: 4999,
                        currency: 'eur',
                        id: 902,
                    };
                },
                getSunflowerPackageByCode: async (...args: unknown[]) => {
                    record(calls, 'getSunflowerPackageByCode', args);
                    return catalogValue;
                },
            });

            await processCheckoutSession('cs_package_paid', dependencies);

            assert.equal(
                callsNamed(calls, 'getSunflowerPackageByCode').length,
                0,
            );
            assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 0);
            assert.equal(callsNamed(calls, 'createTransaction').length, 0);
            assert.equal(
                callsNamed(calls, 'ensureInvoiceForTransaction').length,
                0,
            );
            assert.equal(
                callsNamed(calls, 'ensureStripePaymentCompletionOutputs')
                    .length,
                1,
            );
            const output = callsNamed(
                calls,
                'ensureStripePaymentCompletionOutputs',
            )[0]?.args[0];
            assert.ok(isRecord(output));
            assert.ok(isRecord(output.orderConfirmation));
            assert.deepStrictEqual(output.orderConfirmation.items, [
                {
                    amountSubtotal: 4999,
                    currency: 'eur',
                    name: 'Puna gredica',
                    quantity: 1,
                },
            ]);
            assert.equal(callsNamed(calls, 'posthog.capture').length, 0);
        }
    });

    it('rejects sunflower package output repair when the completed transaction identity differs', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async () => makeSunflowerPackageSession(),
            getCompletedTransactionByStripePaymentId: async () => ({
                accountId: 'different-account',
                amount: 4999,
                currency: 'eur',
                id: 902,
            }),
        });

        await assert.rejects(
            processCheckoutSession('cs_package_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'transaction_identity_conflict',
        );

        assert.equal(callsNamed(calls, 'getSunflowerPackageByCode').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            0,
        );
        assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 0);
    });

    it('rejects internally inconsistent sunflower package snapshot repair', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async () =>
                makeSunflowerPackageSession({
                    productMetadata: { sunflowers: '60001' },
                }),
            getCompletedTransactionByStripePaymentId: async () => ({
                accountId: 'account-1',
                amount: 4999,
                currency: 'eur',
                id: 902,
            }),
        });

        await assert.rejects(
            processCheckoutSession('cs_package_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'sunflower_package_metadata_mismatch',
        );

        assert.equal(callsNamed(calls, 'getSunflowerPackageByCode').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            0,
        );
        assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 0);
    });

    it('does not credit a sunflower package when Stripe metadata mismatches current package data', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSunflowerPackageSession();
            },
            getSunflowerPackageByCode: async (...args: unknown[]) => {
                record(calls, 'getSunflowerPackageByCode', args);
                return {
                    ...makeSunflowerPackageData(),
                    priceCents: 5999,
                };
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_package_paid', dependencies),
            (error: unknown) =>
                error instanceof StripePaymentProcessingPermanentError &&
                error.failureCode === 'sunflower_package_metadata_mismatch',
        );

        assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.deepStrictEqual(callsNamed(calls, 'posthog.capture')[0]?.args, [
            {
                distinctId: 'account-1',
                event: 'sunflower_package_fulfillment_failed',
                properties: {
                    checkout_session_id: 'cs_package_paid',
                    package_code: 'puna_gredica',
                    reason: 'metadata_mismatch:price_cents',
                },
            },
        ]);
    });

    it('credits paid base sunflowers when a duplicate one-time session was already purchased', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSunflowerPackageSession();
            },
            getSunflowerPackageByCode: async (...args: unknown[]) => {
                record(calls, 'getSunflowerPackageByCode', args);
                return makeSunflowerPackageData();
            },
            topUpSunflowerPackage: async (...args: unknown[]) => {
                record(calls, 'topUpSunflowerPackage', args);
                const input = args[0];
                if (isRecord(input) && input.enforceOneTime === true) {
                    throw new SunflowerPackageAlreadyPurchasedError(
                        'account-1',
                        'puna_gredica',
                    );
                }
                return {
                    topUp: { status: 'created', entry: { id: 803 } },
                    bonus: null,
                };
            },
        });

        await processCheckoutSession('cs_package_paid', dependencies);

        assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 2);
        const duplicateTopUpInput = callsNamed(
            calls,
            'topUpSunflowerPackage',
        )[1]?.args[0];
        assert.ok(isRecord(duplicateTopUpInput));
        assert.equal(duplicateTopUpInput.sunflowers, 50000);
        assert.equal(duplicateTopUpInput.bonusSunflowers, 0);
        assert.equal(duplicateTopUpInput.enforceOneTime, false);
        assert.equal(
            duplicateTopUpInput.idempotencyKey,
            'stripe:cs_package_paid:sunflowerPackage:puna_gredica:duplicate_paid_base',
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'createTransaction')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    amount: 4999,
                    stripePaymentId: 'cs_package_paid',
                    status: 'completed',
                    currency: 'eur',
                },
            ],
        );
        assert.equal(
            callsNamed(calls, 'posthog.capture').some((call) => {
                const event = call.args[0];
                return (
                    isRecord(event) &&
                    event.event === 'sunflower_package_fulfillment_failed'
                );
            }),
            false,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'posthog.capture').at(-1)?.args,
            [
                {
                    distinctId: 'account-1',
                    event: 'sunflower_package_fulfilled',
                    properties: {
                        checkout_session_id: 'cs_package_paid',
                        transaction_id: 901,
                        package_code: 'puna_gredica',
                        package_role: 'initial_one_time',
                        price_cents: 4999,
                        paid_amount_cents: 4999,
                        sunflowers: 50000,
                        bonus_sunflowers: 0,
                        duplicate_one_time_purchase: true,
                        ledger_entry_ids: [803],
                    },
                },
            ],
        );
    });

    it('omits receipt links from billing email when checkout fiscalization fails', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            isBillingAutomationEnabled: (...args: unknown[]) => {
                record(calls, 'isBillingAutomationEnabled', args);
                return true;
            },
            fiscalizeReceipt: async (...args: unknown[]) => {
                record(calls, 'fiscalizeReceipt', args);
                return {
                    status: 'failed',
                    reason: 'cis_rejected',
                    receiptId: 701,
                    message: 'CIS says no',
                    zki: 'zki-123',
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'notifyBillingDocumentsEmail')[0]?.args,
            [
                {
                    to: 'buyer@example.test',
                    cartIds: [100],
                    checkoutSessionId: 'cs_paid',
                    invoiceId: 601,
                    invoiceNumber: 'PON-2026-0001',
                    receiptId: null,
                    receiptNumber: null,
                },
            ],
        );
    });

    it('continues checkout side effects when invoice generation fails', async () => {
        const calls: RecordedCall[] = [];
        let getShoppingCartCount = 0;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                getShoppingCartCount += 1;
                return {
                    ...makeCart(),
                    status: getShoppingCartCount > 1 ? 'paid' : 'new',
                };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            getUser: async (...args: unknown[]) => {
                record(calls, 'getUser', args);
                return { userName: 'buyer@example.test' };
            },
            isBillingAutomationEnabled: (...args: unknown[]) => {
                record(calls, 'isBillingAutomationEnabled', args);
                return true;
            },
            ensureInvoiceForTransaction: async (...args: unknown[]) => {
                record(calls, 'ensureInvoiceForTransaction', args);
                throw new Error('invoice db unavailable');
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(
            callsNamed(calls, 'ensureInvoiceForTransaction').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'ensureStripePaymentCompletionOutputs').length,
            1,
        );
        assert.equal(callsNamed(calls, 'issueReceiptForPaidInvoice').length, 0);
        assert.equal(
            callsNamed(calls, 'notifyBillingDocumentsEmail').length,
            0,
        );
    });

    it('records both durable completion outputs after the cart is marked paid', async () => {
        const calls: RecordedCall[] = [];
        let getShoppingCartCount = 0;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                getShoppingCartCount += 1;
                return {
                    ...makeCart(),
                    status: getShoppingCartCount > 1 ? 'paid' : 'new',
                };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            getUser: async (...args: unknown[]) => {
                record(calls, 'getUser', args);
                return { userName: 'buyer@example.test' };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callsNamed(calls, 'getUser')[0]?.args, [
            'user-1',
        ]);
        const outputInput = callsNamed(
            calls,
            'ensureStripePaymentCompletionOutputs',
        )[0]?.args[0];
        assert.ok(isRecord(outputInput));
        assert.equal(outputInput.claimToken, 'test-claim-token');
        assert.equal(outputInput.stripePaymentId, 'cs_paid');
        assert.deepStrictEqual(outputInput.orderConfirmation, {
            cartId: 100,
            currency: 'eur',
            items: [
                {
                    amountSubtotal: 2500,
                    currency: 'eur',
                    name: 'Planting',
                    quantity: 1,
                },
            ],
            manageUrl: 'https://vrt.gredice.com',
            to: 'buyer@example.test',
            totalAmountCents: 2500,
        });
        assert.deepStrictEqual(outputInput.purchaseNotification, {
            accountId: 'account-1',
            amountTotal: 2500,
            checkoutSessionId: 'cs_paid',
            currency: 'eur',
            customerEmail: 'buyer@example.test',
            items: [
                {
                    amountSubtotal: 2500,
                    name: 'Planting',
                    quantity: 1,
                },
            ],
        });
    });

    it('fails closed when completion output lacks a recipient or paid cart', async () => {
        for (const failure of [
            {
                code: 'completion_recipient_missing',
                missingRecipient: true,
                paidCartMissing: false,
            },
            {
                code: 'completion_paid_cart_missing',
                missingRecipient: false,
                paidCartMissing: true,
            },
        ] as const) {
            const calls: RecordedCall[] = [];
            const dependencies = makeDependencies(calls, {
                getStripeCheckoutSession: async () => makeSession(),
                getShoppingCart: async () => makeCart(),
                getUser: async () =>
                    failure.missingRecipient
                        ? null
                        : { userName: 'buyer@example.test' },
                ...(failure.paidCartMissing
                    ? {
                          markCartPaidIfAllItemsPaid: async (
                              ...args: unknown[]
                          ) => {
                              record(calls, 'markCartPaidIfAllItemsPaid', args);
                          },
                      }
                    : {}),
            });

            await assert.rejects(
                processCheckoutSession('cs_paid', dependencies),
                (error: unknown) =>
                    error instanceof StripePaymentProcessingPermanentError &&
                    error.failureCode === failure.code,
            );
            assert.equal(
                callsNamed(calls, 'ensureStripePaymentCompletionOutputs')
                    .length,
                0,
            );
        }
    });

    it('replays a paid planting after a crash without duplicating the cycle, reward, or outlet analytics', async () => {
        const calls: RecordedCall[] = [];
        let cartItemStatus: 'open' | 'paid' = 'open';
        let failOutletAnalytics = true;
        let raisedBedStatus = 'new';
        let activePlantCycle:
            | {
                  active: boolean;
                  plantPlaceEventId: number;
                  plantSortId: number;
                  plantStatus: string;
                  purchase: {
                      cartItemId: number;
                      currency: 'eur';
                      euroAmountCents: number;
                  };
              }
            | undefined;
        let nextEventId = 1;

        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makePlantingSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makePlantingCart(cartItemStatus);
            },
            getOutletOfferReservationForCartItem: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getOutletOfferReservationForCartItem', args);
                return {
                    id: 71,
                    outletOfferId: 72,
                    outletOffer: { plantSortId: 101 },
                    heldSowingDate: new Date('2026-06-15T00:00:00.000Z'),
                    heldInitialPlantStatus: 'sprouted',
                };
            },
            convertOutletReservationForCartItem: async (...args: unknown[]) => {
                record(calls, 'convertOutletReservationForCartItem', args);
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 88,
                        positionIndex: 2,
                        active: Boolean(activePlantCycle?.active),
                        plantCycles: activePlantCycle ? [activePlantCycle] : [],
                    },
                ];
            },
            createEvent: async (...args: unknown[]) => {
                record(calls, 'createEvent', args);
                const event = args[0];
                if (!isRecordedEvent(event)) {
                    return;
                }
                if (event.type === 'raisedBedFields.plantPlace') {
                    assert.ok(isRecord(event.data));
                    assert.ok(isRecord(event.data.purchase));
                    activePlantCycle = {
                        active: true,
                        plantPlaceEventId: nextEventId,
                        plantSortId: Number(event.data.plantSortId),
                        plantStatus: 'new',
                        purchase: {
                            cartItemId: Number(event.data.purchase.cartItemId),
                            currency: 'eur',
                            euroAmountCents: Number(
                                event.data.purchase.euroAmountCents,
                            ),
                        },
                    };
                    nextEventId += 1;
                } else if (
                    event.type === 'raisedBedFields.plantUpdate' &&
                    activePlantCycle &&
                    isRecord(event.data) &&
                    typeof event.data.status === 'string'
                ) {
                    activePlantCycle.plantStatus = event.data.status;
                    nextEventId += 1;
                }
            },
            lockAndActivateRaisedBedForCheckoutPlanting: async (
                ...args: unknown[]
            ) => {
                record(
                    calls,
                    'lockAndActivateRaisedBedForCheckoutPlanting',
                    args,
                );
                const activatedAccountId =
                    raisedBedStatus === 'active' ? null : 'account-1';
                raisedBedStatus = 'active';
                return { available: true, activatedAccountId };
            },
            getPostHogClient: async (...args: unknown[]) => {
                record(calls, 'getPostHogClient', args);
                return {
                    capture: (...captureArgs: unknown[]) => {
                        const capture = captureArgs[0];
                        if (
                            failOutletAnalytics &&
                            isRecord(capture) &&
                            capture.event === 'outlet_reservation_converted'
                        ) {
                            failOutletAnalytics = false;
                            throw new Error(
                                'simulated crash after planting commit',
                            );
                        }
                        record(calls, 'posthog.capture', captureArgs);
                    },
                };
            },
            setCartItemPaid: async (...args: unknown[]) => {
                record(calls, 'setCartItemPaid', args);
                cartItemStatus = 'paid';
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /simulated crash after planting commit/,
        );
        assert.equal(cartItemStatus, 'open');
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);

        await processCheckoutSession('cs_paid', dependencies);

        const writtenEvents = callsNamed(calls, 'createEvent')
            .map((call) => call.args[0])
            .filter(isRecordedEvent);
        assert.equal(
            writtenEvents.filter(
                (event) => event.type === 'raisedBedFields.plantPlace',
            ).length,
            1,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment').map(
                (call) => call.args[2],
            ),
            ['shoppingCartItem:1', 'shoppingCartItem:1'],
        );
        assert.equal(activePlantCycle?.plantStatus, 'sprouted');
        assert.equal(raisedBedStatus, 'active');
        assert.equal(
            callsNamed(calls, 'lockAndActivateRaisedBedForCheckoutPlanting')
                .length,
            2,
        );
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount').length,
            1,
        );
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        assert.equal(
            callsNamed(calls, 'posthog.capture').filter((call) => {
                const capture = call.args[0];
                return (
                    isRecord(capture) &&
                    capture.event === 'outlet_reservation_converted'
                );
            }).length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'convertOutletReservationForCartItem').length,
            2,
        );
    });

    it('keeps a paid planting open when abandonment commits before the parent lock', async () => {
        const calls: RecordedCall[] = [];
        const transaction = { transaction: 'abandoned-before-parent-lock' };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makePlantingSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makePlantingCart();
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'active' };
            },
            withCheckoutCartItemLock: async (...args: unknown[]) => {
                record(calls, 'checkoutItemLock.enter', args.slice(0, 1));
                const callback = args[1];
                if (typeof callback !== 'function') {
                    throw new Error(
                        'Missing checkout cart item lock callback.',
                    );
                }
                try {
                    return await callback({
                        transaction: 'checkout-item-test',
                    });
                } finally {
                    record(calls, 'checkoutItemLock.exit', args.slice(0, 1));
                }
            },
            withPlantingScheduleTaskTransaction: async (
                _raisedBedId: number,
                _positionIndex: number,
                callback: (value: unknown) => Promise<unknown>,
            ) => callback(transaction),
            lockAndActivateRaisedBedForCheckoutPlanting: async (
                ...args: unknown[]
            ) => {
                record(
                    calls,
                    'lockAndActivateRaisedBedForCheckoutPlanting',
                    args,
                );
                assert.equal(args[1], transaction);
                return { available: false, reason: 'abandoned' as const };
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /raised bed is unavailable \(abandoned\)/,
        );

        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'markCartPaidIfAllItemsPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'upsertRaisedBedField').length, 0);
        assert.equal(callsNamed(calls, 'createEvent').length, 0);
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'createNotificationWithStatus').length,
            1,
        );
        const incident = callsNamed(calls, 'createNotificationWithStatus')[0]
            ?.args[0];
        assert.ok(isRecord(incident));
        assert.equal(incident.type, 'checkout_planting_raised_bed_unavailable');
        assert.ok(
            callNames(calls).indexOf('earnSunflowersForPayment') <
                callNames(calls).indexOf('checkoutItemLock.exit'),
        );
        assert.ok(
            callNames(calls).indexOf('checkoutItemLock.exit') <
                callNames(calls).indexOf('createNotificationWithStatus'),
        );
    });

    it('keeps an initially abandoned paid planting recoverable and fulfills it after reactivation', async () => {
        const calls: RecordedCall[] = [];
        const durableIncidentKeys = new Set<string>();
        let cartItemStatus: 'open' | 'paid' = 'open';
        let completedTransactionId: number | undefined;
        let raisedBedStatus: 'abandoned' | 'active' = 'abandoned';
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makePlantingSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makePlantingCart(cartItemStatus);
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return completedTransactionId
                    ? { id: completedTransactionId }
                    : undefined;
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: raisedBedStatus };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 88,
                        positionIndex: 2,
                        active: false,
                        plantCycles: [],
                    },
                ];
            },
            createNotificationWithStatus: async (...args: unknown[]) => {
                record(calls, 'createNotificationWithStatus', args);
                const options = args[1];
                if (
                    isRecord(options) &&
                    typeof options.idempotencyKey === 'string'
                ) {
                    durableIncidentKeys.add(options.idempotencyKey);
                }
                return {
                    notificationId: 'checkout-raised-bed-unavailable',
                    created: true,
                };
            },
            setCartItemPaid: async (...args: unknown[]) => {
                record(calls, 'setCartItemPaid', args);
                cartItemStatus = 'paid';
            },
            createTransaction: async (...args: unknown[]) => {
                record(calls, 'createTransaction', args);
                completedTransactionId = 901;
                return completedTransactionId;
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /raised bed is unavailable \(abandoned\)/,
        );

        assert.equal(cartItemStatus, 'open');
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(
            callsNamed(calls, 'createNotificationWithStatus').length,
            1,
        );
        assert.deepStrictEqual(
            [...durableIncidentKeys],
            ['checkout-planting-raised-bed-unavailable:cs_paid:1'],
        );
        const incident = callsNamed(calls, 'createNotificationWithStatus')[0]
            ?.args[0];
        assert.ok(isRecord(incident));
        assert.equal(incident.type, 'checkout_planting_raised_bed_unavailable');
        assert.equal(incident.priority, 'critical');
        assert.ok(isRecord(incident.metadata));
        assert.equal(incident.metadata.fulfillmentStatus, 'open');
        assert.equal(incident.metadata.reason, 'abandoned');

        raisedBedStatus = 'active';
        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(cartItemStatus, 'paid');
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter((event) => event.type === 'raisedBedFields.plantPlace')
                .length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'createNotificationWithStatus').length,
            1,
        );

        await processCheckoutSession('cs_paid', dependencies);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter((event) => event.type === 'raisedBedFields.plantPlace')
                .length,
            1,
        );
    });

    it('keeps a paid planting order open and escalates when its target has an active cycle', async () => {
        const calls: RecordedCall[] = [];
        const durableIncidentKeys = new Set<string>();
        let operatorAlertSent = false;
        let failFirstOperatorAlert = true;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makePlantingSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makePlantingCart();
            },
            getOutletOfferReservationForCartItem: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getOutletOfferReservationForCartItem', args);
                return {
                    id: 71,
                    outletOfferId: 72,
                    outletOffer: { plantSortId: 101 },
                    heldSowingDate: new Date('2026-06-15T00:00:00.000Z'),
                    heldInitialPlantStatus: 'sprouted',
                };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 88,
                        positionIndex: 2,
                        active: true,
                        plantCycles: [
                            {
                                active: true,
                                plantPlaceEventId: 400,
                                plantSortId: 99,
                                plantStatus: 'planned',
                                purchase: {
                                    cartItemId: 999,
                                    currency: 'eur',
                                    euroAmountCents: 1000,
                                },
                            },
                        ],
                    },
                ];
            },
            createNotificationWithStatus: async (...args: unknown[]) => {
                record(calls, 'createNotificationWithStatus', args);
                const options = args[1];
                let created = false;
                if (
                    isRecord(options) &&
                    typeof options.idempotencyKey === 'string'
                ) {
                    created = !durableIncidentKeys.has(options.idempotencyKey);
                    durableIncidentKeys.add(options.idempotencyKey);
                }
                return {
                    notificationId: 'checkout-planting-incident',
                    created,
                };
            },
            deliverNotificationOperatorAlert: async (...args: unknown[]) => {
                record(
                    calls,
                    'deliverNotificationOperatorAlert',
                    args.slice(0, 1),
                );
                if (operatorAlertSent) {
                    return { attempted: false, status: 'already_sent' };
                }
                const deliver = args[1];
                if (typeof deliver !== 'function') {
                    throw new Error(
                        'Missing operator alert delivery callback.',
                    );
                }
                try {
                    await deliver();
                    operatorAlertSent = true;
                    return { attempted: true, status: 'sent' };
                } catch (error) {
                    return { attempted: true, status: 'failed', error };
                }
            },
            notifyCheckoutFulfillmentIncident: async (...args: unknown[]) => {
                record(calls, 'notifyCheckoutFulfillmentIncident', args);
                if (failFirstOperatorAlert) {
                    failFirstOperatorAlert = false;
                    throw new Error('transient Slack failure');
                }
            },
        });

        for (let attempt = 0; attempt < 2; attempt += 1) {
            await assert.rejects(
                processCheckoutSession('cs_paid', dependencies),
                /active plant cycle/,
            );
        }

        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'markCartPaidIfAllItemsPaid').length, 0);
        assert.equal(callsNamed(calls, 'createEvent').length, 0);
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'convertOutletReservationForCartItem').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'createNotificationWithStatus').length,
            2,
        );
        assert.equal(durableIncidentKeys.size, 1);
        assert.equal(
            durableIncidentKeys.has(
                'checkout-planting-target-conflict:cs_paid:1',
            ),
            true,
        );
        const incident = callsNamed(calls, 'createNotificationWithStatus')[0]
            ?.args[0];
        assert.ok(isRecord(incident));
        assert.equal(incident.type, 'checkout_planting_target_conflict');
        assert.equal(incident.priority, 'critical');
        assert.ok(isRecord(incident.metadata));
        assert.equal(incident.metadata.fulfillmentStatus, 'open');
        assert.equal(incident.metadata.operatorOwner, 'farm_operations');
        assert.equal(
            callsNamed(calls, 'notifyCheckoutFulfillmentIncident').length,
            2,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'notifyCheckoutFulfillmentIncident')[1]?.args,
            [
                {
                    accountId: 'account-1',
                    cartItemId: 1,
                    checkoutSessionId: 'cs_paid',
                    incidentId: 'checkout-planting-incident',
                    positionIndex: 2,
                    raisedBedId: 300,
                },
            ],
        );
        assert.equal(
            callsNamed(calls, 'deliverNotificationOperatorAlert').length,
            2,
        );
        assert.equal(operatorAlertSent, true);
        const conflictCaptures = callsNamed(calls, 'posthog.capture').filter(
            (call) => {
                const capture = call.args[0];
                return (
                    isRecord(capture) &&
                    capture.event === 'checkout_planting_target_conflict'
                );
            },
        );
        assert.equal(conflictCaptures.length, 2);
    });

    it('maps canonical placement collisions into the paid planting incident path', async () => {
        for (const code of [
            'layout_collision',
            'legacy_layout_unknown',
            'plant_operation_conflict',
            'planting_limit',
        ] as const) {
            const calls: RecordedCall[] = [];
            const dependencies = makeDependencies(calls, {
                createRaisedBedPlanting: async (...args: unknown[]) => {
                    record(calls, 'createRaisedBedPlanting', args);
                    throw new RaisedBedPlantingError(
                        code,
                        `Canonical planting conflict: ${code}`,
                    );
                },
            });

            await assert.rejects(
                processItem(
                    {
                        accountId: 'account-1',
                        advancedSowingAuthorization:
                            advancedSowingAuthorization({
                                anchorPositionIndex: 2,
                                selectedDistanceCm: 15,
                            }),
                        amount_total: 2500,
                        additionalData: { scheduledDate: '2026-07-01' },
                        cartId: 100,
                        cartItemId: 1,
                        checkoutSessionId: `cs_${code}`,
                        currency: 'eur',
                        entityId: '101',
                        entityTypeName: 'plantSort',
                        gardenId: 200,
                        positionIndex: 2,
                        raisedBedId: 300,
                    },
                    dependencies,
                ),
                (error) =>
                    error instanceof RaisedBedPlantingError &&
                    error.code === code,
            );

            assert.equal(
                callsNamed(calls, 'createNotificationWithStatus').length,
                1,
            );
            const incident = callsNamed(
                calls,
                'createNotificationWithStatus',
            )[0]?.args[0];
            assert.ok(isRecord(incident));
            assert.equal(incident.type, 'checkout_planting_target_conflict');
            assert.equal(
                callsNamed(calls, 'notifyCheckoutFulfillmentIncident').length,
                1,
            );
            assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);

            const captures = callsNamed(calls, 'posthog.capture');
            assert.equal(captures.length, 1);
            const capture = captures[0]?.args[0];
            assert.deepEqual(capture, {
                distinctId: 'advanced-sowing-checkout',
                event: 'advanced_sowing_checkout_conflict',
                properties: { reason_code: code },
            });
            assert.ok(isRecord(capture));
            const properties = capture.properties;
            assert.ok(isRecord(properties));
            for (const forbiddenProperty of [
                '$insert_id',
                'account_id',
                'cart_item_id',
                'checkout_session_id',
                'garden_id',
                'position_index',
                'raised_bed_id',
                'sort_id',
            ]) {
                assert.equal(
                    Object.hasOwn(properties, forbiddenProperty),
                    false,
                );
            }
        }
    });

    it('continues later paid lines after an earlier failure and rebuilds finalization on retry', async () => {
        const calls: RecordedCall[] = [];
        let operationItemStatus: 'open' | 'paid' = 'open';
        let plantingItemStatus: 'open' | 'paid' = 'open';
        let targetOccupied = true;
        const cartForId = (cartId: number) =>
            cartId === 100
                ? {
                      id: 100,
                      accountId: 'account-1',
                      status: operationItemStatus === 'paid' ? 'paid' : 'new',
                      items: [
                          {
                              id: 1,
                              status: operationItemStatus,
                              entityId: '42',
                              entityTypeName: 'operation',
                              raisedBedId: 300,
                          },
                      ],
                  }
                : {
                      id: 200,
                      accountId: 'account-1',
                      status: plantingItemStatus === 'paid' ? 'paid' : 'new',
                      items: [
                          {
                              id: 2,
                              status: plantingItemStatus,
                              entityId: '101',
                              entityTypeName: 'plantSort',
                              raisedBedId: 300,
                          },
                      ],
                  };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                const session = makeMultiLinePlantingSession();
                return {
                    ...session,
                    lineItems: {
                        data: [...session.lineItems.data].reverse(),
                    },
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return cartForId(Number(args[0]));
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 88,
                        positionIndex: 2,
                        active: targetOccupied,
                        plantCycles: targetOccupied
                            ? [
                                  {
                                      active: true,
                                      plantPlaceEventId: 400,
                                      plantSortId: 99,
                                      plantStatus: 'planned',
                                      purchase: {
                                          cartItemId: 999,
                                          currency: 'eur',
                                          euroAmountCents: 1000,
                                      },
                                  },
                              ]
                            : [],
                    },
                ];
            },
            setCartItemPaid: async (...args: unknown[]) => {
                record(calls, 'setCartItemPaid', args);
                if (args[0] === 1) {
                    operationItemStatus = 'paid';
                }
                if (args[0] === 2) {
                    plantingItemStatus = 'paid';
                }
            },
            isBillingAutomationEnabled: (...args: unknown[]) => {
                record(calls, 'isBillingAutomationEnabled', args);
                return true;
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /active plant cycle/,
        );
        assert.equal(operationItemStatus, 'paid');
        assert.equal(plantingItemStatus, 'open');
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);

        targetOccupied = false;
        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(operationItemStatus, 'paid');
        assert.equal(plantingItemStatus, 'paid');
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'markCartPaidIfAllItemsPaid')
                .slice(-2)
                .map((call) => call.args[0]),
            [200, 100],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        const invoiceInput = callsNamed(calls, 'ensureInvoiceForTransaction')[0]
            ?.args[0];
        assert.ok(isRecord(invoiceInput));
        assert.ok(Array.isArray(invoiceInput.items));
        assert.deepStrictEqual(
            invoiceInput.items.map((item) =>
                isRecord(item) ? item.entityTypeName : null,
            ),
            ['plantSort', 'operation'],
        );
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter(
                    (event) =>
                        event.type === 'raisedBedFields.plantPlace' ||
                        event.type === 'accounts.sunflowersEarned',
                ).length,
            1,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment').map(
                (call) => call.args[2],
            ),
            ['shoppingCartItem:2', 'shoppingCartItem:1', 'shoppingCartItem:2'],
        );
        const billingEmailInput = callsNamed(
            calls,
            'notifyBillingDocumentsEmail',
        )[0]?.args[0];
        assert.ok(isRecord(billingEmailInput));
        assert.deepStrictEqual(billingEmailInput.cartIds, [200, 100]);
    });

    it('keeps finalization retryable when an earlier paid line cannot be resolved', async () => {
        const calls: RecordedCall[] = [];
        const baseSession = makeSession();
        const validLine = baseSession.lineItems.data[0];
        const validProduct = validLine?.price.product;
        assert.ok(validLine && validProduct);

        let repairedMalformedLine = false;
        const itemStatuses = new Map<number, 'open' | 'paid'>([
            [1, 'open'],
            [2, 'open'],
        ]);
        const repairedLine = {
            ...validLine,
            id: 'li_repaired',
            price: {
                product: {
                    ...validProduct,
                    id: 'prod_repaired',
                    metadata: {
                        ...validProduct.metadata,
                        cartId: '200',
                        cartItemId: '2',
                        entityId: '43',
                    },
                },
            },
        };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...baseSession,
                    amountTotal: 5000,
                    lineItems: {
                        data: [
                            repairedMalformedLine
                                ? repairedLine
                                : {
                                      ...repairedLine,
                                      price: { product: 'prod_repaired' },
                                  },
                            validLine,
                        ],
                    },
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cartId = Number(args[0]);
                const itemId = cartId === 100 ? 1 : 2;
                return {
                    id: cartId,
                    accountId: 'account-1',
                    status:
                        itemStatuses.get(itemId) === 'paid' ? 'paid' : 'new',
                    items: [
                        {
                            id: itemId,
                            status: itemStatuses.get(itemId) ?? 'open',
                            entityId: itemId === 1 ? '42' : '43',
                            entityTypeName: 'operation',
                            raisedBedId: 300,
                        },
                    ],
                };
            },
            setCartItemPaid: async (...args: unknown[]) => {
                record(calls, 'setCartItemPaid', args);
                itemStatuses.set(Number(args[0]), 'paid');
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /unexpanded product/,
        );
        assert.equal(itemStatuses.get(1), 'paid');
        assert.equal(itemStatuses.get(2), 'open');
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);

        repairedMalformedLine = true;
        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(itemStatuses.get(1), 'paid');
        assert.equal(itemStatuses.get(2), 'paid');
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        assert.equal(
            callsNamed(calls, 'getCompletedTransactionByStripePaymentId')
                .length,
            2,
        );
    });

    it('keeps checkout retryable when sunflower spending fails for non-Stripe cart items', async () => {
        const calls: RecordedCall[] = [];
        const sunflowerItem = makeSunflowerCartItem();
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return { ...cart, items: [...cart.items, sunflowerItem] };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return {
                    id: 100,
                    items: [sunflowerItem],
                };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [sunflowerItem],
                };
            },
            spendSunflowersBatch: async (...args: unknown[]) => {
                record(calls, 'spendSunflowersBatch', args);
                throw new Error('insufficient sunflowers');
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /insufficient sunflowers/,
        );

        assert.deepStrictEqual(
            callsNamed(calls, 'spendSunflowersBatch')[0]?.args,
            [
                'account-1',
                [{ amount: 5000, reason: 'shoppingCartItem:2' }],
                { transaction: 'checkout-items-test' },
                {
                    existingCheckoutItemAmountsAreAuthoritative: true,
                    legacyCartSpend: {
                        reason: 'shoppingCart:100',
                        coveredItems: [
                            {
                                amount: 5000,
                                cartItemId: 2,
                                createdAt: new Date('2026-07-01T10:00:00.000Z'),
                                paymentState: 'pending',
                                reason: 'shoppingCartItem:2',
                            },
                        ],
                    },
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemLocks')[0]?.args,
            [[2]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemProcessingLocks')[0]?.args,
            [[2]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('rejects malformed non-Stripe additional data before committing its payment marker', async () => {
        const calls: RecordedCall[] = [];
        const malformedItem = {
            ...makeSunflowerCartItem(),
            additionalData: '[',
        };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [],
                        [malformedItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return { ...cart, items: [...cart.items, malformedItem] };
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return { id: 100, items: [malformedItem] };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [malformedItem],
                };
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            (error) => error instanceof SyntaxError,
        );

        assert.equal(callsNamed(calls, 'spendSunflowersBatch').length, 0);
        assert.equal(callsNamed(calls, 'consumeInventoryItem').length, 0);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('resumes a direct-currency item that already has a durable checkout effect', async () => {
        const calls: RecordedCall[] = [];
        const sunflowerItem = {
            ...makeSunflowerCartItem(),
            entityData: { attributes: { deliverable: false } },
        };
        let cartInfoCalls = 0;
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [],
                        [sunflowerItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return { ...cart, items: [...cart.items, sunflowerItem] };
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return { id: 100, items: [sunflowerItem] };
            },
            getCheckoutFulfillmentStartedCartItemIds: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCheckoutFulfillmentStartedCartItemIds', args);
                return new Set([sunflowerItem.id]);
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                cartInfoCalls += 1;
                return {
                    allowPurchase: cartInfoCalls > 1,
                    notes:
                        cartInfoCalls > 1
                            ? []
                            : ['raised bed is temporarily unavailable'],
                    items: [sunflowerItem],
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(callsNamed(calls, 'getCartInfo').length, 2);
        const recoveryOptions = callsNamed(calls, 'getCartInfo')[1]?.args[2];
        assert.ok(isRecord(recoveryOptions));
        assert.ok(recoveryOptions.resumableCartItemIds instanceof Set);
        assert.equal(
            recoveryOptions.resumableCartItemIds.has(sunflowerItem.id),
            true,
        );
        assert.equal(callsNamed(calls, 'spendSunflowersBatch').length, 1);
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1, 2],
        );
    });

    it('covers paid and pending legacy sunflower items and fulfills with the durable resolved amount', async () => {
        const calls: RecordedCall[] = [];
        const paidSunflowerItem = {
            ...makeSunflowerCartItem(),
            shopData: { discountPrice: 0, price: 5 },
            status: 'paid',
        };
        const pendingSunflowerItem = {
            ...makeSunflowerCartItem(),
            createdAt: new Date('2026-07-01T10:05:00.000Z'),
            entityId: '101',
            entityTypeName: 'plantSort',
            id: 3,
            positionIndex: 4,
            shopData: { discountPrice: 7, price: 7 },
        };
        const allCartItems = [
            ...makeCart().items,
            paidSunflowerItem,
            pendingSunflowerItem,
        ];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [],
                        [paidSunflowerItem.id, pendingSunflowerItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return {
                    ...makeCart(),
                    status: 'new',
                    items: allCartItems,
                };
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return {
                    id: 100,
                    items: [paidSunflowerItem, pendingSunflowerItem],
                };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [paidSunflowerItem, pendingSunflowerItem],
                };
            },
            calculateSunflowerAmount: (...args: unknown[]) => {
                record(calls, 'calculateSunflowerAmount', args);
                return 7_000;
            },
            spendSunflowersBatch: async (...args: unknown[]) => {
                record(calls, 'spendSunflowersBatch', args);
                return {
                    createdReasons: [],
                    existingReasons: ['shoppingCartItem:3'],
                    resolvedAmountsByReason: {
                        'shoppingCartItem:2': 4_500,
                        'shoppingCartItem:3': 6_000,
                    },
                };
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'active' };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 87,
                        positionIndex: 2,
                        active: false,
                        plantCycles: [],
                    },
                    {
                        id: 88,
                        positionIndex: 3,
                        active: false,
                        plantCycles: [],
                    },
                    {
                        id: 89,
                        positionIndex: 4,
                        active: true,
                        plantCycles: [],
                    },
                ];
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemLocks')[0]?.args,
            [[2, 3]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'spendSunflowersBatch')[0]?.args,
            [
                'account-1',
                [{ amount: 7_000, reason: 'shoppingCartItem:3' }],
                { transaction: 'checkout-items-test' },
                {
                    existingCheckoutItemAmountsAreAuthoritative: true,
                    legacyCartSpend: {
                        reason: 'shoppingCart:100',
                        coveredItems: [
                            {
                                amount: 5_000,
                                cartItemId: 2,
                                createdAt: new Date('2026-07-01T10:00:00.000Z'),
                                paymentState: 'paid',
                                reason: 'shoppingCartItem:2',
                            },
                            {
                                amount: 7_000,
                                cartItemId: 3,
                                createdAt: new Date('2026-07-01T10:05:00.000Z'),
                                paymentState: 'pending',
                                reason: 'shoppingCartItem:3',
                            },
                        ],
                    },
                },
            ],
        );
        const plantingEvent = callsNamed(calls, 'createEvent')
            .map((call) => call.args[0])
            .find(
                (event) =>
                    isRecordedEvent(event) &&
                    event.type === 'raisedBedFields.plantPlace',
            );
        assert.ok(isRecordedEvent(plantingEvent));
        assert.deepStrictEqual(plantingEvent.data, {
            plantSortId: '101',
            scheduledDate: '2026-07-02',
            sowingLocation: undefined,
            purchase: {
                cartItemId: 3,
                currency: 'sunflower',
                sunflowerAmount: 6_000,
            },
        });
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1, 3],
        );
        const confirmationCall = callsNamed(
            calls,
            'buildOrderConfirmationItems',
        ).at(-1);
        assert.deepStrictEqual(confirmationCall?.args[0], [
            paidSunflowerItem,
            pendingSunflowerItem,
        ]);
        const resolveSunflowerAmount = confirmationCall?.args[1];
        assert.equal(typeof resolveSunflowerAmount, 'function');
        if (typeof resolveSunflowerAmount !== 'function') {
            throw new Error('Missing sunflower confirmation resolver.');
        }
        assert.equal(resolveSunflowerAmount(paidSunflowerItem), 4_500);
        assert.equal(resolveSunflowerAmount(pendingSunflowerItem), 6_000);
    });

    it('commits inventory consumption inside the short cart-item gate before fulfillment', async () => {
        const calls: RecordedCall[] = [];
        const inventoryItem = {
            ...makeSunflowerCartItem(),
            currency: 'inventory',
            entityData: { attributes: { deliverable: false } },
            inventoryAvailable: 1,
            usesInventory: true,
        };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [],
                        [inventoryItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return { ...cart, items: [...cart.items, inventoryItem] };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    { id: 88, positionIndex: 2, active: true },
                    { id: 89, positionIndex: 3, active: true },
                ];
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return { id: 100, items: [inventoryItem] };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [inventoryItem],
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemProcessingLock').at(-1)
                ?.args,
            [2],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemLock').at(-1)?.args,
            [2],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withInventoryAccountTransaction')[0]?.args,
            ['account-1'],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'consumeInventoryItem')[0]?.args,
            [
                'account-1',
                {
                    entityTypeName: 'operation',
                    entityId: '99',
                    amount: 1,
                    source: 'shoppingCartItem:2',
                },
                { transaction: 'checkout-item-test' },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1, 2],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
    });

    it('blocks finalization when an expected non-Stripe item is missing', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata([], [2]),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return { id: 100, items: [] };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return { allowPurchase: true, notes: [], items: [] };
            },
        });

        await assert.rejects(
            processCheckoutSession('cs_paid', dependencies),
            /Expected non-Stripe cart items are missing before fulfillment: 2/,
        );

        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
    });

    it('accepts an expected non-Stripe item that was already paid on replay', async () => {
        const calls: RecordedCall[] = [];
        const paidSunflowerItem = {
            ...makeSunflowerCartItem(),
            status: 'paid',
        };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [],
                        [paidSunflowerItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return {
                    ...cart,
                    items: [...cart.items, paidSunflowerItem],
                };
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return { id: 100, items: [paidSunflowerItem] };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: false,
                    notes: ['historical cart state changed'],
                    items: [paidSunflowerItem],
                };
            },
            spendSunflowersBatch: async (...args: unknown[]) => {
                record(calls, 'spendSunflowersBatch', args);
                return {
                    createdReasons: [],
                    existingReasons: [],
                    resolvedAmountsByReason: {
                        [`shoppingCartItem:${paidSunflowerItem.id.toString()}`]: 4_500,
                    },
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1],
        );
        assert.equal(callsNamed(calls, 'spendSunflowersBatch').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
        const confirmationCall = callsNamed(
            calls,
            'buildOrderConfirmationItems',
        ).at(-1);
        assert.deepStrictEqual(confirmationCall?.args[0], [paidSunflowerItem]);
        const resolveSunflowerAmount = confirmationCall?.args[1];
        assert.equal(typeof resolveSunflowerAmount, 'function');
        if (typeof resolveSunflowerAmount !== 'function') {
            throw new Error('Missing sunflower confirmation resolver.');
        }
        assert.equal(resolveSunflowerAmount(paidSunflowerItem), 4_500);
    });

    it('uses the canonical harvest date for a mixed checkout and ignores a later non-Stripe cart item', async () => {
        const calls: RecordedCall[] = [];
        const canonicalHarvestDate = '2026-07-24T00:00:00.000Z';
        const harvestEntityData = {
            attributes: {
                deliverable: true,
                stage: {
                    information: {
                        name: 'harvest',
                    },
                },
            },
        };
        const expectedSunflowerItem = {
            ...makeSunflowerCartItem(),
            additionalData: JSON.stringify({
                scheduledDate: '2026-07-25T00:00:00.000Z',
            }),
            entityData: harvestEntityData,
        };
        const laterSunflowerItem = {
            ...makeSunflowerCartItem(),
            id: 3,
            entityId: '100',
            positionIndex: 4,
            entityData: harvestEntityData,
        };
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return {
                    ...makeSession(),
                    metadata: encodeHarvestDatesMetadata(
                        [
                            {
                                cartItemId: expectedSunflowerItem.id,
                                scheduledDate: canonicalHarvestDate,
                            },
                        ],
                        [expectedSunflowerItem.id],
                    ),
                };
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                const cart = makeCart();
                return {
                    ...cart,
                    items: [
                        ...cart.items,
                        expectedSunflowerItem,
                        laterSunflowerItem,
                    ],
                };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    { id: 88, positionIndex: 2, active: true },
                    { id: 89, positionIndex: 3, active: true },
                    { id: 90, positionIndex: 4, active: true },
                ];
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return {
                    id: 100,
                    items: [expectedSunflowerItem, laterSunflowerItem],
                };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [expectedSunflowerItem, laterSunflowerItem],
                };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callsNamed(calls, 'spendSunflowersBatch')[0]?.args,
            [
                'account-1',
                [{ amount: 5000, reason: 'shoppingCartItem:2' }],
                { transaction: 'checkout-items-test' },
                {
                    existingCheckoutItemAmountsAreAuthoritative: true,
                    legacyCartSpend: {
                        reason: 'shoppingCart:100',
                        coveredItems: [
                            {
                                amount: 5000,
                                cartItemId: 2,
                                createdAt: new Date('2026-07-01T10:00:00.000Z'),
                                paymentState: 'pending',
                                reason: 'shoppingCartItem:2',
                            },
                        ],
                    },
                },
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemLocks')[0]?.args,
            [[2]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'withCheckoutCartItemProcessingLocks')[0]?.args,
            [[2]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'getCheckoutOperationMapping').at(-1)?.args,
            [2],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1, 2],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'getOrCreateCheckoutOperation').map((call) =>
                isRecord(call.args[1]) ? call.args[1].entityId : undefined,
            ),
            [42, 99],
        );

        const scheduledOperations = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        );
        assert.equal(scheduledOperations.length, 2);
        assert.ok(
            scheduledOperations.some(
                (call) =>
                    isRecord(call.args[2]) &&
                    call.args[2].scheduledDate instanceof Date &&
                    call.args[2].scheduledDate.toISOString() ===
                        new Date(canonicalHarvestDate).toISOString(),
            ),
        );
        assert.equal(
            callsNamed(calls, 'setCartItemPaid').some(
                (call) => call.args[0] === laterSunflowerItem.id,
            ),
            false,
        );
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').some(
                (call) =>
                    isRecord(call.args[1]) &&
                    call.args[1].entityId ===
                        Number(laterSunflowerItem.entityId),
            ),
            false,
        );
    });
});

describe('processItem', () => {
    it('skips processing for an abandoned raised bed', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'abandoned' };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: null,
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(callNames(calls), [
            'getCheckoutOperationMapping',
            'getRaisedBed',
            'isRaisedBedAbandoned',
        ]);
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            0,
        );
    });

    it('does not recreate an operation field below a deleted raised bed', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return null;
            },
        });

        const result = await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: null,
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(result, {
            status: 'not_fulfilled',
            reason: 'raised_bed_unavailable',
        });
        assert.deepStrictEqual(callNames(calls), [
            'getCheckoutOperationMapping',
            'getRaisedBed',
        ]);
        assert.equal(callsNamed(calls, 'upsertRaisedBedField').length, 0);
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            0,
        );
    });

    it('uses greenhouse sowing location from scheduled plant additional data', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls);

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-01',
                    sowingLocation: 'greenhouse',
                },
                cartId: 100,
                cartItemId: 1,
                currency: 'sunflower',
                entityId: '42',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(callsNamed(calls, 'createEvent')[0]?.args[0], {
            type: 'raisedBedFields.plantPlace',
            aggregateId: '300|2',
            data: {
                plantSortId: '42',
                scheduledDate: '2026-07-01',
                sowingLocation: 'greenhouse',
                purchase: {
                    cartItemId: 1,
                    currency: 'sunflower',
                    sunflowerAmount: 2500,
                },
            },
        });
    });

    it('reuses an empty mapping snapshot on a first-attempt operation', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls);

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 5000,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 2,
                checkoutOperationMapping: null,
                currency: 'sunflower',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.equal(
            callsNamed(calls, 'getCheckoutOperationMapping').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        const operationInput = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        )[0]?.args[1];
        assert.ok(isRecord(operationInput));
        assert.equal(operationInput.raisedBedFieldId, 88);
        assert.deepStrictEqual(
            callsNamed(calls, 'upsertRaisedBedField')[0]?.args[0],
            { positionIndex: 2, raisedBedId: 300 },
        );
    });

    it('creates an operation target for a field that has never held a plant', async () => {
        const calls: RecordedCall[] = [];
        let fieldCreated = false;
        const dependencies = makeDependencies(calls, {
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return fieldCreated
                    ? [
                          {
                              id: 89,
                              positionIndex: 2,
                              active: false,
                              plantCycles: [],
                          },
                      ]
                    : [];
            },
            upsertRaisedBedField: async (...args: unknown[]) => {
                record(calls, 'upsertRaisedBedField', args);
                fieldCreated = true;
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 5000,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 2,
                checkoutOperationMapping: null,
                currency: 'sunflower',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(
            callsNamed(calls, 'upsertRaisedBedField')[0]?.args[0],
            { positionIndex: 2, raisedBedId: 300 },
        );
        const operationInput = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        )[0]?.args[1];
        assert.ok(isRecord(operationInput));
        assert.equal(operationInput.raisedBedFieldId, 89);
    });

    it('keeps an operation retryable until its payment reward is durably earned', async () => {
        const calls: RecordedCall[] = [];
        let rewardAttempts = 0;
        const dependencies = makeDependencies(calls, {
            earnSunflowersForPayment: async (...args: unknown[]) => {
                record(calls, 'earnSunflowersForPayment', args);
                rewardAttempts += 1;
                if (rewardAttempts === 1) {
                    throw new Error('sunflower ledger unavailable');
                }
            },
        });

        const item = {
            accountId: 'account-1',
            amount_total: 2500,
            additionalData: {
                scheduledDate: '2026-07-01',
            },
            cartId: 100,
            cartItemId: 1,
            currency: 'eur',
            entityId: '42',
            entityTypeName: 'operation',
            gardenId: 200,
            positionIndex: null,
            raisedBedId: null,
        };

        await assert.rejects(
            processItem(item, dependencies),
            /sunflower ledger unavailable/,
        );
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            0,
        );

        assert.deepStrictEqual(await processItem(item, dependencies), {
            status: 'fulfilled',
        });

        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 2);
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25, 'shoppingCartItem:1'],
        );
    });

    it('reuses a checkout operation while replaying its idempotent reward', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                return { created: false, operationId: 501 };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: null,
                raisedBedId: null,
            },
            dependencies,
        );

        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            1,
        );
        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 1);
        assert.equal(callsNamed(calls, 'notifyOperationUpdate').length, 0);
    });

    it('reuses mapped operation state after the field changes and bed is abandoned', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getCheckoutOperationMapping: async (...args: unknown[]) => {
                record(calls, 'getCheckoutOperationMapping', args);
                return {
                    operationId: 501,
                    accountId: 'account-1',
                    entityId: 42,
                    entityTypeName: 'operation',
                    farmId: null,
                    gardenId: 200,
                    raisedBedId: 300,
                    raisedBedFieldId: 701,
                    operationTimestamp: null,
                    paymentCurrency: 'eur',
                    delivery: null,
                    scheduledDate: '2026-07-01T00:00:00.000Z',
                    accepted: false,
                };
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 702,
                        positionIndex: 2,
                        active: true,
                    },
                ];
            },
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'abandoned' };
            },
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                return { created: false, operationId: 501 };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-09T00:00:00.000Z',
                },
                cartId: 100,
                cartItemId: 1,
                currency: 'sunflower',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.equal(
            callsNamed(calls, 'getCheckoutOperationMapping').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'getRaisedBedFieldsWithEvents').length,
            0,
        );
        assert.equal(callsNamed(calls, 'getRaisedBed').length, 0);
        assert.equal(callsNamed(calls, 'isRaisedBedAbandoned').length, 0);
        const operationInput = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        )[0]?.args[1];
        assert.ok(isRecord(operationInput));
        assert.equal(operationInput.raisedBedFieldId, 701);
        const operationOptions = callsNamed(
            calls,
            'getOrCreateCheckoutOperation',
        )[0]?.args[2];
        assert.ok(isRecord(operationOptions));
        assert.ok(operationOptions.scheduledDate instanceof Date);
        assert.equal(
            operationOptions.scheduledDate.toISOString(),
            '2026-07-01T00:00:00.000Z',
        );
    });

    it('reuses a delivery request without repeating its notifications', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                return { created: false, operationId: 501 };
            },
            isCartItemDeliverable: async (...args: unknown[]) => {
                record(calls, 'isCartItemDeliverable', args);
                return true;
            },
            getOrCreateDeliveryRequest: async (...args: unknown[]) => {
                record(calls, 'getOrCreateDeliveryRequest', args);
                return {
                    created: false,
                    requestId: 'delivery-request-701',
                };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-01',
                },
                cartId: 100,
                cartItemId: 1,
                checkoutOperationMapping: {
                    accepted: false,
                    accountId: 'account-1',
                    delivery: {
                        addressId: null,
                        locationId: 4,
                        mode: 'pickup',
                        notes: null,
                        slotId: 9,
                    },
                    entityId: 42,
                    entityTypeName: 'operation',
                    farmId: null,
                    gardenId: 200,
                    operationId: 501,
                    operationTimestamp: null,
                    paymentCurrency: 'sunflower',
                    raisedBedFieldId: null,
                    raisedBedId: null,
                    scheduledDate: '2026-07-01T00:00:00.000Z',
                },
                currency: 'sunflower',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: null,
                raisedBedId: null,
            },
            dependencies,
        );

        assert.equal(callsNamed(calls, 'getOrCreateDeliveryRequest').length, 1);
        assert.deepStrictEqual(
            callsNamed(calls, 'getOrCreateDeliveryRequest')[0]?.args[0],
            {
                accountId: 'account-1',
                addressId: undefined,
                locationId: 4,
                mode: 'pickup',
                notes: undefined,
                operationId: 501,
                slotId: 9,
            },
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'getOrCreateDeliveryRequest')[0]?.args[1],
            { checkoutNotificationScope: 'cart:100' },
        );
    });

    it('retries delivery creation without blocking on notification providers', async () => {
        const calls: RecordedCall[] = [];
        let operationAttempt = 0;
        let deliveryAttempt = 0;
        let mappingAttempt = 0;
        const dependencies = makeDependencies(calls, {
            getCheckoutOperationMapping: async (...args: unknown[]) => {
                record(calls, 'getCheckoutOperationMapping', args);
                mappingAttempt += 1;
                return mappingAttempt === 1
                    ? null
                    : {
                          accepted: false,
                          accountId: 'account-1',
                          delivery: {
                              addressId: null,
                              locationId: 4,
                              mode: 'pickup',
                              notes: null,
                              slotId: 9,
                          },
                          entityId: 42,
                          entityTypeName: 'operation',
                          farmId: null,
                          gardenId: 200,
                          operationId: 501,
                          operationTimestamp: null,
                          paymentCurrency: 'eur',
                          raisedBedFieldId: null,
                          raisedBedId: null,
                          scheduledDate: '2026-07-01T00:00:00.000Z',
                      };
            },
            getOrCreateCheckoutOperation: async (...args: unknown[]) => {
                record(calls, 'getOrCreateCheckoutOperation', args);
                operationAttempt += 1;
                return {
                    created: operationAttempt === 1,
                    operationId: 501,
                };
            },
            isCartItemDeliverable: async (...args: unknown[]) => {
                record(calls, 'isCartItemDeliverable', args);
                return true;
            },
            getOrCreateDeliveryRequest: async (...args: unknown[]) => {
                record(calls, 'getOrCreateDeliveryRequest', args);
                deliveryAttempt += 1;
                if (deliveryAttempt === 1) {
                    throw new Error('transient delivery database failure');
                }
                return {
                    created: true,
                    requestId: 'delivery-request-701',
                };
            },
        });
        const providerCalls: string[] = [];
        for (const providerName of [
            'notifyDeliveryRequestEvent',
            'notifyDeliveryScheduled',
            'notifyOperationUpdate',
            'notifyScheduledDeliveryEmailOnce',
        ]) {
            Reflect.set(dependencies, providerName, async () => {
                providerCalls.push(providerName);
                throw new Error(
                    'Provider must not run in checkout fulfillment',
                );
            });
        }
        const item = {
            accountId: 'account-1',
            amount_total: 2500,
            additionalData: {
                scheduledDate: '2026-07-01',
                delivery: {
                    slotId: 9,
                    mode: 'pickup' as const,
                    locationId: 4,
                },
            },
            cartId: 100,
            cartItemId: 1,
            currency: 'eur',
            entityId: '42',
            entityTypeName: 'operation',
            gardenId: 200,
            positionIndex: null,
            raisedBedId: null,
        };

        const first = await processItem(item, dependencies);
        const retry = await processItem(
            {
                ...item,
                additionalData: { scheduledDate: '2026-07-01' },
            },
            dependencies,
        );

        assert.deepStrictEqual(first, {
            status: 'not_fulfilled',
            reason: 'delivery_request_failed',
        });
        assert.deepStrictEqual(retry, { status: 'fulfilled' });
        assert.equal(
            callsNamed(calls, 'getOrCreateCheckoutOperation').length,
            2,
        );
        assert.equal(callsNamed(calls, 'earnSunflowersForPayment').length, 2);
        assert.equal(callsNamed(calls, 'getOrCreateDeliveryRequest').length, 2);
        assert.deepStrictEqual(providerCalls, []);
    });

    it('places planned greenhouse sowing when requested in additional data', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'active' };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-01',
                    sowingLocation: 'greenhouse',
                },
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        const plantPlaceEvents = callsNamed(calls, 'createEvent')
            .map((call) => call.args[0])
            .filter(isRecordedEvent)
            .filter((event) => event.type === 'raisedBedFields.plantPlace');

        assert.equal(plantPlaceEvents.length, 1);
        assert.deepStrictEqual(plantPlaceEvents[0], {
            type: 'raisedBedFields.plantPlace',
            aggregateId: '300|2',
            data: {
                plantSortId: '101',
                scheduledDate: '2026-07-01',
                sowingLocation: 'greenhouse',
                purchase: {
                    cartItemId: 1,
                    currency: 'eur',
                    euroAmountCents: 2500,
                },
            },
        });
    });

    it('creates one selected planting for a paid one-field density snapshot', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls);

        const result = await processItem(
            {
                accountId: 'account-1',
                advancedSowingAuthorization: advancedSowingAuthorization({
                    anchorPositionIndex: 2,
                    selectedDistanceCm: 15,
                }),
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-01',
                    sowingLocation: 'greenhouse',
                },
                cartId: 100,
                cartItemId: 1,
                checkoutSessionId: 'cs_advanced_density',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(result, { status: 'fulfilled' });
        assert.deepStrictEqual(
            callsNamed(calls, 'withPlantingScheduleTaskFootprintTransaction')[0]
                ?.args,
            [300, [2]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'upsertRaisedBedField').map(
                (call) => call.args[0],
            ),
            [{ positionIndex: 2, raisedBedId: 300 }],
        );
        assert.equal(
            callsNamed(calls, 'acquirePlantingScheduleTaskLock').length,
            0,
        );
        assert.equal(callsNamed(calls, 'createRaisedBedPlanting').length, 1);
        assert.equal(
            callsNamed(calls, 'createLegacyRaisedBedPlantPlaceWithProjection')
                .length,
            0,
        );
        const createInput = callsNamed(calls, 'createRaisedBedPlanting')[0]
            ?.args[0];
        assert.ok(isRecord(createInput));
        assert.equal(createInput.configurationSource, 'selected');
        assert.equal(
            createInput.eventAggregateId,
            'raised-bed-planting:cart-item:1',
        );
        assert.equal(createInput.plantSortId, 101);
        assert.equal(createInput.plantsPerAxis, 2);
        assert.equal(createInput.plantCount, 4);
        assert.deepStrictEqual(createInput.memberships, [
            {
                isAnchor: true,
                raisedBedFieldId: 88,
                relativeColumn: 0,
                relativeRow: 0,
            },
        ]);
        assert.ok(isRecord(createInput.lifecycleStarted));
        assert.equal(
            createInput.lifecycleStarted.scheduledDate,
            '2026-07-01T00:00:00.000Z',
        );
        assert.equal(createInput.lifecycleStarted.sowingLocation, 'greenhouse');
        assert.deepStrictEqual(createInput.lifecycleStarted.purchase, {
            cartItemId: 1,
            currency: 'eur',
            euroAmountCents: 2500,
        });
        assert.equal(
            callsNamed(calls, 'lockAndActivateRaisedBedForCheckoutPlanting')
                .length,
            1,
        );
    });

    it('creates selected plantings from direct sunflower and inventory checkout inputs', async () => {
        for (const checkout of [
            {
                amountTotal: 40,
                cartItemId: 4,
                currency: 'sunflower',
                expectedPurchase: {
                    cartItemId: 4,
                    currency: 'sunflower',
                    sunflowerAmount: 40,
                },
            },
            {
                amountTotal: 0,
                cartItemId: 5,
                currency: 'inventory',
                expectedPurchase: {
                    cartItemId: 5,
                    currency: 'inventory',
                },
            },
        ] as const) {
            const calls: RecordedCall[] = [];
            const fulfillmentTransaction = {
                transaction: `direct-${checkout.currency}`,
            } as never;
            const withPlantingScheduleTaskFootprintTransaction: ProcessCheckoutSessionDependencies['withPlantingScheduleTaskFootprintTransaction'] =
                async (
                    _raisedBedId,
                    _positionIndices,
                    callback,
                    transaction,
                ) => {
                    assert.equal(transaction, fulfillmentTransaction);
                    return callback(fulfillmentTransaction);
                };
            const dependencies = makeDependencies(calls, {
                withPlantingScheduleTaskFootprintTransaction,
            });

            await processItem(
                {
                    accountId: 'account-1',
                    advancedSowingAuthorization: advancedSowingAuthorization({
                        anchorPositionIndex: 2,
                        selectedDistanceCm: 15,
                    }),
                    amount_total: checkout.amountTotal,
                    additionalData: { scheduledDate: '2026-07-01' },
                    cartId: 100,
                    cartItemId: checkout.cartItemId,
                    checkoutSessionId: 'direct-checkout',
                    currency: checkout.currency,
                    entityId: '101',
                    entityTypeName: 'plantSort',
                    gardenId: 200,
                    fulfillmentTransaction,
                    positionIndex: 2,
                    raisedBedId: 300,
                },
                dependencies,
            );

            const createInput = callsNamed(calls, 'createRaisedBedPlanting')[0]
                ?.args[0];
            assert.ok(isRecord(createInput));
            assert.ok(isRecord(createInput.lifecycleStarted));
            assert.deepStrictEqual(
                createInput.lifecycleStarted.purchase,
                checkout.expectedPurchase,
            );
            assert.equal(
                callsNamed(
                    calls,
                    'createLegacyRaisedBedPlantPlaceWithProjection',
                ).length,
                0,
            );
        }
    });

    it('locks and creates a paid 2x2 snapshot as one logical planting', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [0, 1, 3, 4].map((positionIndex) => ({
                    active: false,
                    id: 100 + positionIndex,
                    plantCycles: [],
                    positionIndex,
                }));
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                advancedSowingAuthorization: advancedSowingAuthorization({
                    anchorPositionIndex: 4,
                    selectedDistanceCm: 60,
                }),
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 2,
                checkoutSessionId: 'cs_advanced_2x2',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 4,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(
            callsNamed(calls, 'withPlantingScheduleTaskFootprintTransaction')[0]
                ?.args,
            [300, [0, 1, 3, 4]],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'upsertRaisedBedField').map(
                (call) => call.args[0],
            ),
            [0, 1, 3, 4].map((positionIndex) => ({
                positionIndex,
                raisedBedId: 300,
            })),
        );
        const createInput = callsNamed(calls, 'createRaisedBedPlanting')[0]
            ?.args[0];
        assert.ok(isRecord(createInput));
        assert.equal(
            createInput.eventAggregateId,
            'raised-bed-planting:cart-item:2',
        );
        assert.equal(createInput.spanRows, 2);
        assert.equal(createInput.spanColumns, 2);
        assert.equal(createInput.plantCount, 1);
        assert.deepStrictEqual(createInput.memberships, [
            {
                isAnchor: true,
                raisedBedFieldId: 104,
                relativeColumn: 0,
                relativeRow: 0,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 103,
                relativeColumn: 1,
                relativeRow: 0,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 101,
                relativeColumn: 0,
                relativeRow: 1,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 100,
                relativeColumn: 1,
                relativeRow: 1,
            },
        ]);
        assert.equal(callsNamed(calls, 'createRaisedBedPlanting').length, 1);
        assert.equal(
            callsNamed(calls, 'createLegacyRaisedBedPlantPlaceWithProjection')
                .length,
            0,
        );
        assert.ok(
            callNames(calls).indexOf('createRaisedBedPlanting') <
                callNames(calls).indexOf(
                    'lockAndActivateRaisedBedForCheckoutPlanting',
                ),
        );
    });

    it('replays a selected planting identity before touching a deleted bed', async () => {
        const calls: RecordedCall[] = [];
        const existingPlanting = {
            memberships: [
                {
                    raisedBedField: {
                        id: 88,
                        positionIndex: 2,
                    },
                },
            ],
        };
        const dependencies = makeDependencies(calls, {
            createRaisedBedPlanting: async (...args: unknown[]) => {
                record(calls, 'createRaisedBedPlanting', args);
                return { created: false, planting: existingPlanting };
            },
            getRaisedBedPlantingByEventAggregateId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getRaisedBedPlantingByEventAggregateId', args);
                return existingPlanting;
            },
        });

        const result = await processItem(
            {
                accountId: 'account-1',
                advancedSowingAuthorization: advancedSowingAuthorization({
                    anchorPositionIndex: 2,
                    selectedDistanceCm: 15,
                }),
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 3,
                checkoutSessionId: 'cs_advanced_replay',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(result, { status: 'fulfilled' });
        assert.deepStrictEqual(
            callsNamed(
                calls,
                'getRaisedBedPlantingByEventAggregateId',
            )[0]?.args.slice(0, 1),
            ['raised-bed-planting:cart-item:3'],
        );
        assert.equal(callsNamed(calls, 'createRaisedBedPlanting').length, 1);
        assert.equal(callsNamed(calls, 'upsertRaisedBedField').length, 0);
        assert.equal(
            callsNamed(calls, 'getRaisedBedFieldsWithEvents').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'lockAndActivateRaisedBedForCheckoutPlanting')
                .length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount').length,
            0,
        );
    });

    it('finds the same checkout planting after its cycle moves and its sort is replaced', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [
                    {
                        id: 88,
                        positionIndex: 2,
                        active: false,
                        plantCycles: [],
                    },
                    {
                        id: 89,
                        positionIndex: 5,
                        active: true,
                        plantCycles: [
                            {
                                active: true,
                                plantPlaceEventId: 400,
                                plantSortId: 202,
                                plantStatus: 'planned',
                                purchase: {
                                    cartItemId: 1,
                                    currency: 'eur',
                                    euroAmountCents: 2500,
                                },
                            },
                        ],
                    },
                ];
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 1,
                checkoutSessionId: 'cs_moved',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.equal(callsNamed(calls, 'createEvent').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureLegacyRaisedBedPlantingProjection').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'notifyCheckoutFulfillmentIncident').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'lockAndActivateRaisedBedForCheckoutPlanting')
                .length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'withPlantingScheduleTaskTransaction').length,
            1,
        );
    });

    it('restores a field deleted before the checkout lock in the same planting transaction', async () => {
        const calls: RecordedCall[] = [];
        const transaction = { transaction: 'delete-before-checkout-lock' };
        let fieldDeleted = true;
        let restoredDeletedRow = false;
        const dependencies = makeDependencies(calls, {
            withPlantingScheduleTaskTransaction: async (
                _raisedBedId: number,
                _positionIndex: number,
                callback: (value: unknown) => Promise<unknown>,
            ) => callback(transaction),
            upsertRaisedBedField: async (...args: unknown[]) => {
                record(calls, 'upsertRaisedBedField', args);
                assert.equal(args[1], transaction);
                restoredDeletedRow = fieldDeleted;
                fieldDeleted = false;
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                assert.equal(args[1], transaction);
                return fieldDeleted
                    ? []
                    : [
                          {
                              id: 88,
                              positionIndex: 2,
                              active: false,
                              plantCycles: [],
                          },
                      ];
            },
            createEvent: async (...args: unknown[]) => {
                record(calls, 'createEvent', args);
                assert.equal(args[1], transaction);
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 1,
                checkoutSessionId: 'cs_delete_before_lock',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.equal(restoredDeletedRow, true);
        assert.equal(fieldDeleted, false);
        assert.equal(callsNamed(calls, 'upsertRaisedBedField').length, 1);
        assert.equal(
            callsNamed(calls, 'getRaisedBedFieldsWithEvents').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter((event) => event.type === 'raisedBedFields.plantPlace')
                .length,
            1,
        );
    });

    it('lets abandonment win after checkout commits its locked planting', async () => {
        const calls: RecordedCall[] = [];
        const runParentLocked = createAsyncMutex();
        const checkoutHasParentLock = createGate();
        const releaseCheckout = createGate();
        const abandonmentAttempted = createGate();
        const transaction = { transaction: 'checkout-parent-lock' };
        let raisedBedStatus = 'new';
        const dependencies = makeDependencies(calls, {
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: raisedBedStatus };
            },
            withPlantingScheduleTaskTransaction: async (
                _raisedBedId: number,
                _positionIndex: number,
                callback: (value: unknown) => Promise<unknown>,
            ) => runParentLocked(() => callback(transaction)),
            lockAndActivateRaisedBedForCheckoutPlanting: async (
                ...args: unknown[]
            ) => {
                record(
                    calls,
                    'lockAndActivateRaisedBedForCheckoutPlanting',
                    args,
                );
                assert.equal(args[1], transaction);
                assert.equal(raisedBedStatus, 'new');
                raisedBedStatus = 'active';
                checkoutHasParentLock.open();
                await releaseCheckout.wait;
                return {
                    available: true,
                    activatedAccountId: 'account-1',
                };
            },
        });

        const checkoutPromise = processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: { scheduledDate: '2026-07-01' },
                cartId: 100,
                cartItemId: 1,
                checkoutSessionId: 'cs_checkout_first',
                currency: 'eur',
                entityId: '101',
                entityTypeName: 'plantSort',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );
        await checkoutHasParentLock.wait;

        const abandonmentPromise = (async () => {
            abandonmentAttempted.open();
            return runParentLocked(async () => {
                raisedBedStatus = 'abandoned';
            });
        })();
        await abandonmentAttempted.wait;
        assert.equal(raisedBedStatus, 'active');

        releaseCheckout.open();
        await Promise.all([checkoutPromise, abandonmentPromise]);

        assert.equal(raisedBedStatus, 'abandoned');
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount').length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'processReferralRewardsForAccount')[0]?.args[1],
            transaction,
        );
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter((event) => event.type === 'raisedBedFields.plantPlace')
                .length,
            1,
        );
        assert.equal(
            callsNamed(calls, 'createEvent')
                .map((call) => call.args[0])
                .filter(isRecordedEvent)
                .filter((event) => event.type === 'accounts.sunflowersEarned')
                .length,
            0,
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25, 'shoppingCartItem:1'],
        );
    });

    it('serializes checkout replacement after completion without splitting the plant cycle', async () => {
        await assertCheckoutPlantingRace({
            checkoutFirst: false,
            terminalWriter: 'completion',
        });
    });

    it('serializes completion after checkout replacement without splitting the plant cycle', async () => {
        await assertCheckoutPlantingRace({
            checkoutFirst: true,
            terminalWriter: 'completion',
        });
    });

    it('serializes checkout replacement after a blocker without splitting the plant cycle', async () => {
        await assertCheckoutPlantingRace({
            checkoutFirst: false,
            terminalWriter: 'block',
        });
    });

    it('serializes a blocker after checkout replacement without splitting the plant cycle', async () => {
        await assertCheckoutPlantingRace({
            checkoutFirst: true,
            terminalWriter: 'block',
        });
    });
});

describe('processCheckoutSession test utilities', () => {
    it('parses additional data values consistently', () => {
        const objectValue = { scheduledDate: '2026-07-01' };

        assert.deepStrictEqual(
            __testUtils.parseAdditionalDataValue(
                '{"scheduledDate":"2026-07-01"}',
            ),
            objectValue,
        );
        assert.equal(__testUtils.parseAdditionalDataValue('{'), null);
        assert.equal(
            __testUtils.parseAdditionalDataValue(objectValue),
            objectValue,
        );
        assert.equal(
            __testUtils.parseAdditionalDataValue(undefined),
            undefined,
        );
    });
});
