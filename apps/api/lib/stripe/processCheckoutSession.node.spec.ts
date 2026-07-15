import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SunflowerPackageAlreadyPurchasedError } from '@gredice/storage';
import {
    buildCheckoutInvoiceBillingSnapshot,
    buildCheckoutInvoiceLineItem,
} from '../billing/checkoutInvoiceDraft';
import {
    __testUtils,
    type ProcessCheckoutSessionDependencies,
    processCheckoutSession,
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
    const dependencies = {
        isRaisedBedAbandoned: (status: unknown) => {
            record(calls, 'isRaisedBedAbandoned', [status]);
            return status === 'abandoned';
        },
        notifyDeliveryRequestEvent: async (...args: unknown[]) => {
            record(calls, 'notifyDeliveryRequestEvent', args);
        },
        notifyCheckoutFulfillmentIncident: async (...args: unknown[]) => {
            record(calls, 'notifyCheckoutFulfillmentIncident', args);
        },
        notifyOperationUpdate: async (...args: unknown[]) => {
            record(calls, 'notifyOperationUpdate', args);
        },
        notifyPurchase: async (...args: unknown[]) => {
            record(calls, 'notifyPurchase', args);
        },
        consumeInventoryItem: async (...args: unknown[]) => {
            record(calls, 'consumeInventoryItem', args);
        },
        convertOutletReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'convertOutletReservationForCartItem', args);
        },
        createDeliveryRequest: async (...args: unknown[]) => {
            record(calls, 'createDeliveryRequest', args);
            return 701;
        },
        createEvent: async (...args: unknown[]) => {
            record(calls, 'createEvent', args);
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
        createOperation: async (...args: unknown[]) => {
            record(calls, 'createOperation', args);
            return 501;
        },
        createTransaction: async (...args: unknown[]) => {
            record(calls, 'createTransaction', args);
            return 901;
        },
        earnSunflowersForPayment: async (...args: unknown[]) => {
            record(calls, 'earnSunflowersForPayment', args);
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
        getDefaultShoppingCartScheduledDate: (...args: unknown[]) => {
            record(calls, 'getDefaultShoppingCartScheduledDate', args);
            return '2026-07-02';
        },
        getInventory: async (...args: unknown[]) => {
            record(calls, 'getInventory', args);
            return [];
        },
        getOutletOfferReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'getOutletOfferReservationForCartItem', args);
            return null;
        },
        getRaisedBed: async (...args: unknown[]) => {
            record(calls, 'getRaisedBed', args);
            return null;
        },
        getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
            record(calls, 'getRaisedBedFieldsWithEvents', args);
            return [];
        },
        getShoppingCart: async (...args: unknown[]) => {
            record(calls, 'getShoppingCart', args);
            return null;
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
        markCartPaidIfAllItemsPaid: async (cartId: unknown) => {
            record(calls, 'markCartPaidIfAllItemsPaid', [cartId]);
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
        spendSunflowers: async (...args: unknown[]) => {
            record(calls, 'spendSunflowers', args);
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
        withStripePaymentProcessingLock: async (
            id: string,
            callback: () => Promise<unknown>,
        ) => {
            record(calls, 'withStripePaymentProcessingLock', [id]);
            return callback();
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
        notifyOrderConfirmationEmail: async (...args: unknown[]) => {
            record(calls, 'notifyOrderConfirmationEmail', args);
        },
        notifyDeliveryScheduled: async (...args: unknown[]) => {
            record(calls, 'notifyDeliveryScheduled', args);
        },
        notifyScheduledDeliveryEmailOnce: async (...args: unknown[]) => {
            record(calls, 'notifyScheduledDeliveryEmailOnce', args);
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
    };

    return dependencies as unknown as ProcessCheckoutSessionDependencies;
}

function makeSession() {
    return {
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
    it('skips an already completed transaction without processing items again', async () => {
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
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callNames(calls), [
            'getStripeCheckoutSession',
            'withStripePaymentProcessingLock',
            'getCompletedTransactionByStripePaymentId',
        ]);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
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
                    'createOperation',
                    'earnSunflowersForPayment',
                    'markCartPaidIfAllItemsPaid',
                    'createTransaction',
                ].includes(name),
            ),
            [
                'setCartItemPaid',
                'createOperation',
                'earnSunflowersForPayment',
                'markCartPaidIfAllItemsPaid',
                'createTransaction',
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid')[0]?.args,
            [1],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25],
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
            callsNamed(calls, 'notifyOrderConfirmationEmail')[0]?.args,
            [
                {
                    to: 'buyer@example.test',
                    cartId: null,
                    checkoutSessionId: 'cs_package_paid',
                    items: [
                        {
                            name: 'Puna gredica',
                            quantity: 1,
                            amountSubtotal: 4999,
                            currency: 'eur',
                        },
                    ],
                    totalAmountCents: 4999,
                    currency: 'eur',
                },
            ],
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
        assert.deepStrictEqual(
            callsNamed(calls, 'notifyOrderConfirmationEmail')[0]?.args,
            [
                {
                    to: 'buyer@example.test',
                    cartId: null,
                    checkoutSessionId: 'cs_package_paid',
                    items: [
                        {
                            name: 'Puna gredica',
                            quantity: 1,
                            amountSubtotal: 3999,
                            currency: 'eur',
                        },
                    ],
                    totalAmountCents: 3999,
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
    });

    it('replays sunflower package fulfillment through idempotent ledger top-up without a duplicate transaction', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSunflowerPackageSession();
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return { id: 902 };
            },
            getSunflowerPackageByCode: async (...args: unknown[]) => {
                record(calls, 'getSunflowerPackageByCode', args);
                return makeSunflowerPackageData();
            },
        });

        await processCheckoutSession('cs_package_paid', dependencies);

        assert.equal(callsNamed(calls, 'topUpSunflowerPackage').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(
            callsNamed(calls, 'ensureInvoiceForTransaction').length,
            0,
        );
        assert.equal(
            callsNamed(calls, 'notifyOrderConfirmationEmail').length,
            0,
        );
        assert.equal(callsNamed(calls, 'notifyPurchase').length, 0);
        assert.equal(callsNamed(calls, 'posthog.capture').length, 0);
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

        await processCheckoutSession('cs_package_paid', dependencies);

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
            callsNamed(calls, 'notifyOrderConfirmationEmail').length,
            1,
        );
        assert.equal(callsNamed(calls, 'issueReceiptForPaidInvoice').length, 0);
        assert.equal(
            callsNamed(calls, 'notifyBillingDocumentsEmail').length,
            0,
        );
    });

    it('sends an order confirmation email after the cart is marked paid', async () => {
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
        assert.deepStrictEqual(
            callsNamed(calls, 'notifyOrderConfirmationEmail')[0]?.args,
            [
                {
                    to: 'buyer@example.test',
                    cartId: 100,
                    checkoutSessionId: 'cs_paid',
                    items: [
                        {
                            name: 'Planting',
                            quantity: 1,
                            amountSubtotal: 2500,
                            currency: 'eur',
                        },
                    ],
                    totalAmountCents: 2500,
                    currency: 'eur',
                },
            ],
        );
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
        assert.equal(
            writtenEvents.filter(
                (event) => event.type === 'accounts.sunflowersEarned',
            ).length,
            1,
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
                return [];
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

    it('rebuilds all invoice lines and cart finalization after a later planting item retries', async () => {
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
                return makeMultiLinePlantingSession();
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
        assert.equal(callsNamed(calls, 'createOperation').length, 1);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);

        targetOccupied = false;
        await processCheckoutSession('cs_paid', dependencies);

        assert.equal(operationItemStatus, 'paid');
        assert.equal(plantingItemStatus, 'paid');
        assert.equal(callsNamed(calls, 'createOperation').length, 1);
        assert.deepStrictEqual(
            callsNamed(calls, 'markCartPaidIfAllItemsPaid')
                .slice(-2)
                .map((call) => call.args[0]),
            [100, 200],
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
            ['operation', 'plantSort'],
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
            2,
        );
        const billingEmailInput = callsNamed(
            calls,
            'notifyBillingDocumentsEmail',
        )[0]?.args[0];
        assert.ok(isRecord(billingEmailInput));
        assert.deepStrictEqual(billingEmailInput.cartIds, [100, 200]);
    });

    it('continues when sunflower spending fails for non-Stripe cart items but leaves them unpaid', async () => {
        const calls: RecordedCall[] = [];
        const sunflowerItem = makeSunflowerCartItem();
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
            spendSunflowers: async (...args: unknown[]) => {
                record(calls, 'spendSunflowers', args);
                throw new Error('insufficient sunflowers');
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callsNamed(calls, 'spendSunflowers')[0]?.args, [
            'account-1',
            5000,
            'shoppingCart:100',
        ]);
        // Characterization: see plan 006 — this silent-swallow behavior is slated to change.
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
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
            'getRaisedBed',
            'isRaisedBedAbandoned',
        ]);
        assert.equal(callsNamed(calls, 'createOperation').length, 0);
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

    it('continues operation processing when earning sunflowers fails', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            earnSunflowersForPayment: async (...args: unknown[]) => {
                record(calls, 'earnSunflowersForPayment', args);
                throw new Error('sunflower ledger unavailable');
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
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: null,
                raisedBedId: null,
            },
            dependencies,
        );

        assert.deepStrictEqual(
            callNames(calls).filter((name) =>
                [
                    'createOperation',
                    'earnSunflowersForPayment',
                    'createEvent',
                    'notifyOperationUpdate',
                    'isCartItemDeliverable',
                ].includes(name),
            ),
            [
                'createOperation',
                'earnSunflowersForPayment',
                'createEvent',
                'notifyOperationUpdate',
                'isCartItemDeliverable',
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25],
        );
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

    it('finds the same checkout planting after its cycle moves to another field', async () => {
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
                                plantSortId: 101,
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
            1,
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
