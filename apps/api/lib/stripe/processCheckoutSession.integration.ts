import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
    assignStripeCustomerId,
    bindStripeCheckoutAttempt,
    completeSelectedRaisedBedPlantingTask,
    createAttributeDefinition,
    createEntity,
    createPickupLocation,
    createStripeCheckoutAttempt,
    createTimeSlot,
    deliveryRequests,
    emailMessages,
    events,
    getCheckoutOperationMapping,
    getCheckoutOperationMappings,
    getOrCreateCheckoutOperation,
    getOrCreateDeliveryRequest,
    getOrCreateShoppingCart,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    getStripeCheckoutAttempt,
    getStripePaymentCompletionOutputs,
    getStripePaymentProcessingClaim,
    knownEventTypes,
    operations,
    type StripePaymentProcessingClaimControl,
    StripePaymentProcessingClaimLostError,
    StripePaymentProcessingUnavailableError,
    setCartItemPaid,
    shoppingCartItems,
    storage,
    transactions,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
    withStripePaymentProcessingLock,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createSelectedTaskFixture } from '../../../../packages/storage/tests/helpers/selectedPlantingFixture';
import { createTestDb } from '../../../../packages/storage/tests/testDb';
import {
    buildStripeCheckoutAttemptSnapshot,
    buildStripeCheckoutReplayInput,
} from '../checkout/stripeCheckoutSnapshot';
import {
    __testUtils,
    type ProcessCheckoutSessionDependencies,
    processCheckoutSession,
} from './processCheckoutSession';

const priceCents = 2500;
const purchasedDate = '2099-09-15T10:30:00+02:00';
const scheduleIso = new Date(purchasedDate).toISOString();

// Catalog data is synthetic. Every economic, fulfillment, snapshot, completion
// and claim repository below remains the production implementation.
const catalog: ProcessCheckoutSessionDependencies['getCartInfo'] = async (
    items,
) => ({
    notes: [],
    allowPurchase: true,
    items: items.map((item) => ({
        ...item,
        usesInventory: false,
        inventoryAvailable: 0,
        outlet: undefined,
        entityData: { id: Number(item.entityId) },
        shopData: {
            name: 'Synthetic operation',
            price: priceCents / 100,
            description: undefined,
            image: undefined,
            discountPrice: undefined,
            discountDescription: undefined,
        },
    })),
});

async function fixture() {
    createTestDb();
    assert.notEqual(
        process.env.GREDICE_TEST_DB_PROVIDER,
        'pglite',
        'This regression requires PostgreSQL multiconnection lease semantics',
    );
    const f = await createSelectedTaskFixture();
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...f.task.identity,
        actor: { role: 'admin', userId: f.adminId },
        commandId: randomUUID(),
    });
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed?.gardenId);
    const gardenId = bed.gardenId;
    await upsertRaisedBedField({
        raisedBedId: f.raisedBedId,
        positionIndex: 1,
    });
    const field = (await getRaisedBedFieldsWithEvents(f.raisedBedId)).find(
        (candidate) => candidate.positionIndex === 1,
    );
    assert.ok(field);
    await upsertEntityType({ name: 'operation', label: 'Operation' });
    const application = await createAttributeDefinition({
        category: 'attributes',
        name: 'application',
        label: 'Application',
        entityTypeName: 'operation',
        dataType: 'text',
    });
    const entityId = await createEntity('operation');
    await upsertAttributeValue({
        attributeDefinitionId: application,
        entityTypeName: 'operation',
        entityId,
        value: 'plant',
    });
    await updateEntity({ id: entityId, state: 'published' });
    const locationId = await createPickupLocation({
        name: 'Synthetic pickup',
        street1: 'Fixture',
        city: 'Fixture',
        postalCode: '00000',
    });
    const slotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt: new Date('2099-09-16T10:00:00Z'),
        endAt: new Date('2099-09-16T12:00:00Z'),
    });
    const delivery = {
        slotId,
        mode: 'pickup',
        locationId,
    } satisfies Pick<
        Parameters<typeof getOrCreateDeliveryRequest>[0],
        'slotId' | 'mode' | 'locationId'
    >;
    const cart = await getOrCreateShoppingCart(f.accountId);
    assert.ok(cart);
    const items = await storage()
        .insert(shoppingCartItems)
        .values(
            Array.from({ length: 9 }, (_, index) => ({
                cartId: cart.id,
                entityId: String(entityId),
                entityTypeName: 'operation',
                gardenId,
                raisedBedId: f.raisedBedId,
                positionIndex: index < 5 ? 1 : null,
                amount: 1,
                currency: 'eur',
                additionalData: JSON.stringify({
                    scheduledDate: purchasedDate,
                    delivery,
                    requestNote: `Synthetic purchased item ${index}`,
                    ...(index < 5
                        ? {}
                        : { plantingTarget: completed.task.identity }),
                }),
            })),
        )
        .returning();
    assert.equal(items.length, 9);
    const customerId = `cus_fixture_${randomUUID()}`;
    await assignStripeCustomerId(f.accountId, customerId);
    const additionalData = new Map(
        items.map((item) => {
            const value: unknown = JSON.parse(item.additionalData ?? '{}');
            return [item.id, value];
        }),
    );
    const snapshot = buildStripeCheckoutAttemptSnapshot({
        advancedSowingAuthorizationsByCartItemId: new Map(),
        cartId: cart.id,
        checkoutAdditionalDataByCartItemId: additionalData,
        customerId,
        harvestDates: [],
        items: (await catalog(items, f.accountId)).items,
        returnUrls: {
            success: 'https://example.test/success',
            cancel: 'https://example.test/cancel',
        },
        userId: f.owner.userId,
    });
    const sessionId = `cs_fixture_${randomUUID()}`;
    await createStripeCheckoutAttempt(snapshot, { accountId: f.accountId });
    const attempt = await bindStripeCheckoutAttempt({
        cartId: cart.id,
        attemptId: snapshot.attemptId,
        sessionId,
    });
    const replay = buildStripeCheckoutReplayInput({
        accountId: f.accountId,
        attempt,
        checkoutAdditionalDataByCartItemId: additionalData,
        customerId,
        userId: f.owner.userId,
    });
    const session: NonNullable<
        Awaited<
            ReturnType<
                ProcessCheckoutSessionDependencies['getStripeCheckoutSession']
            >
        >
    > = {
        id: sessionId,
        customerId,
        status: 'complete',
        paymentId: undefined,
        paymentStatus: 'paid',
        amountTotal: priceCents * 9,
        url: null,
        metadata: Object.fromEntries(
            Object.entries(replay.data.metadata ?? {}).map(([key, value]) => [
                key,
                String(value),
            ]),
        ),
        lineItems: {
            lastResponse: {
                headers: {},
                requestId: 'fixture',
                statusCode: 200,
            },
            object: 'list',
            has_more: false,
            url: '/synthetic/line_items',
            data: replay.data.items.map((item, index) => ({
                id: `li_fixture_${index}`,
                object: 'item',
                adjustable_quantity: null,
                amount_discount: 0,
                amount_subtotal: priceCents,
                amount_tax: 0,
                amount_total: priceCents,
                currency: 'eur',
                description: null,
                metadata: null,
                quantity: item.quantity,
                price: {
                    id: `price_fixture_${index}`,
                    object: 'price',
                    active: true,
                    billing_scheme: 'per_unit',
                    created: 0,
                    currency: 'eur',
                    custom_unit_amount: null,
                    livemode: false,
                    lookup_key: null,
                    metadata: {},
                    nickname: null,
                    recurring: null,
                    tax_behavior: null,
                    tiers_mode: null,
                    transform_quantity: null,
                    type: 'one_time',
                    unit_amount: priceCents,
                    unit_amount_decimal: null,
                    product: {
                        id: `prod_fixture_${index}`,
                        object: 'product',
                        active: true,
                        created: 0,
                        description: null,
                        images: [],
                        livemode: false,
                        marketing_features: [],
                        metadata: Object.fromEntries(
                            Object.entries(item.product.metadata ?? {})
                                .filter((entry) => entry[1] !== null)
                                .map(([key, value]) => [key, String(value)]),
                        ),
                        name: item.product.name,
                        package_dimensions: null,
                        shippable: null,
                        tax_details: null,
                        type: 'service',
                        updated: 0,
                        url: null,
                    },
                },
            })),
        },
    };
    // The checkout was frozen while all nine items were new. Five field items
    // subsequently completed, as in a partially fulfilled captured payment.
    for (const item of items.slice(0, 5)) {
        const result = await getOrCreateCheckoutOperation(
            item.id,
            {
                accountId: f.accountId,
                entityId,
                entityTypeName: 'operation',
                gardenId,
                raisedBedId: f.raisedBedId,
                raisedBedFieldId: field.id,
            },
            {
                paymentCurrency: 'eur',
                scheduledDate: new Date(purchasedDate),
                delivery: { ...delivery, addressId: null, notes: null },
                requestNote: `Synthetic purchased item ${items.indexOf(item)}`,
            },
        );
        await getOrCreateDeliveryRequest(
            {
                operationId: result.operationId,
                accountId: f.accountId,
                ...delivery,
            },
            { checkoutNotificationScope: `session:${sessionId}` },
        );
        await __testUtils.realDependencies.earnSunflowersForPayment(
            f.accountId,
            priceCents / 100,
            `shoppingCartItem:${item.id}`,
        );
        await setCartItemPaid(item.id);
    }
    return { ...f, cartId: cart.id, items, session, snapshot, gardenId };
}

async function effects(accountId: string) {
    return {
        operations: await storage()
            .select()
            .from(operations)
            .where(eq(operations.accountId, accountId))
            .orderBy(operations.id),
        // This database belongs exclusively to this suite, so include all
        // schedules, mappings, rewards, deliveries and durable output intents.
        events: await storage().select().from(events).orderBy(events.id),
        deliveries: await storage()
            .select()
            .from(deliveryRequests)
            .orderBy(deliveryRequests.id),
        notifications: await storage()
            .select()
            .from(emailMessages)
            .orderBy(emailMessages.id),
        transactions: await storage()
            .select()
            .from(transactions)
            .where(eq(transactions.accountId, accountId))
            .orderBy(transactions.id),
    };
}

function rewardEvents(
    rows: Awaited<ReturnType<typeof effects>>['events'],
    accountId: string,
) {
    return rows.filter(
        (row) =>
            row.type === knownEventTypes.accounts.earnSunflowers &&
            row.aggregateId === accountId &&
            row.data != null &&
            typeof row.data === 'object' &&
            'reason' in row.data &&
            typeof row.data.reason === 'string' &&
            row.data.reason.startsWith('payment:shoppingCartItem:'),
    );
}

function deferred() {
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

test('frozen selected dates survive rollback, partial progress, claim retry and concurrent replay', {
    timeout: 60_000,
}, async () => {
    const f = await fixture();
    const before = await effects(f.accountId);
    assert.equal(before.operations.length, 5);
    const originalRewards = rewardEvents(before.events, f.accountId);
    assert.equal(originalRewards.length, 5);
    const originalMappings = await getCheckoutOperationMappings(
        f.items.slice(0, 5).map((item) => item.id),
    );
    const failureItem = f.items[6];
    assert.ok(failureItem);
    const entered = deferred();
    const release = deferred();
    const injectedFailure = new Error(
        'Synthetic transient operation transaction failure',
    );
    let injectFailure = true;
    let rolledBackOperationId: number | undefined;
    let clock = new Date();
    const controls: StripePaymentProcessingClaimControl[] = [];
    let providerReads = 0;
    const selectedDates: Date[] = [];
    const failUnexpectedProvider = async () => {
        throw new Error('Unexpected provider call');
    };
    const dependencies: ProcessCheckoutSessionDependencies = {
        ...__testUtils.realDependencies,
        getCartInfo: catalog,
        getStripeCheckoutSession: async () => {
            providerReads++;
            return f.session;
        },
        getPostHogClient: async () => ({ capture: () => undefined }),
        isBillingAutomationEnabled: () => false,
        fiscalizeReceipt: failUnexpectedProvider,
        issueReceiptForPaidInvoice: failUnexpectedProvider,
        notifyBillingDocumentsEmail: failUnexpectedProvider,
        notifyCheckoutFulfillmentIncident: failUnexpectedProvider,
        deliverNotificationOperatorAlert: failUnexpectedProvider,
        isCartItemDeliverable: async () => true,
        withStripePaymentProcessingLock: (id, callback) =>
            withStripePaymentProcessingLock(
                id,
                async (control) => {
                    controls.push(control);
                    return callback(control);
                },
                { now: () => clock },
            ),
        getOrCreateCheckoutOperation: async (id, input, options, db) => {
            const persist = async (transaction = db) => {
                const result = await getOrCreateCheckoutOperation(
                    id,
                    input,
                    options,
                    transaction,
                );
                if (input.plantingId) {
                    // Inspect the value accepted by the real repository. This
                    // seam never normalizes or repairs the production input.
                    assert.ok(options.scheduledDate instanceof Date);
                    assert.equal(
                        options.scheduledDate.toISOString(),
                        scheduleIso,
                    );
                    selectedDates.push(options.scheduledDate);
                }
                return result;
            };
            if (id === failureItem.id && injectFailure) {
                injectFailure = false;
                return storage().transaction(async (tx) => {
                    const created = await persist(tx);
                    rolledBackOperationId = created.operationId;
                    entered.resolve();
                    await release.promise;
                    throw injectedFailure;
                });
            }
            return persist();
        },
    };
    const first = processCheckoutSession(f.session.id, dependencies);
    // Attach a rejection handler before waiting at the deterministic race gate.
    const firstOutcome = first.catch((error: unknown) => error);
    try {
        await Promise.race([
            entered.promise,
            firstOutcome.then((error) => {
                throw error ?? new Error('Failure gate was not reached');
            }),
        ]);
        const owned = await getStripePaymentProcessingClaim(f.session.id);
        assert.equal(owned?.status, 'processing');
        assert.equal(owned.attemptCount, 1);
        await assert.rejects(
            processCheckoutSession(f.session.id, dependencies),
            StripePaymentProcessingUnavailableError,
        );
        assert.equal(
            providerReads,
            1,
            'the concurrent caller must not reach Stripe',
        );
    } finally {
        release.resolve();
    }
    assert.equal(await firstOutcome, injectedFailure);
    const partial = await effects(f.accountId);
    assert.equal(partial.operations.length, 8);
    assert.equal(partial.deliveries.length, 8);
    assert.equal(partial.transactions.length, 0);
    assert.deepEqual(partial.operations.slice(0, 5), before.operations);
    assert.deepEqual(
        rewardEvents(partial.events, f.accountId).slice(0, 5),
        originalRewards,
    );
    const rewards = rewardEvents(partial.events, f.accountId);
    assert.equal(rewards.length, 9);
    assert.equal(
        rewards.reduce((sum, event) => {
            assert.ok(
                event.data &&
                    typeof event.data === 'object' &&
                    'amount' in event.data &&
                    typeof event.data.amount === 'number',
            );
            return sum + event.data.amount;
        }, 0),
        9 * 250,
    );
    assert.equal(await getCheckoutOperationMapping(failureItem.id), null);
    assert.ok(rolledBackOperationId);
    assert.equal(
        partial.events.filter(
            (row) => row.aggregateId === String(rolledBackOperationId),
        ).length,
        0,
    );
    assert.equal(
        partial.notifications.some(
            (row) => row.metadata?.operationId === rolledBackOperationId,
        ),
        false,
    );
    assert.equal(await getStripePaymentCompletionOutputs(f.session.id), null);
    assert.equal(
        (await getShoppingCart(f.cartId))?.items.filter(
            (item) => item.status === 'paid',
        ).length,
        8,
    );
    const failed = await getStripePaymentProcessingClaim(f.session.id);
    assert.equal(failed?.status, 'retryable');
    assert.equal(failed.attemptCount, 1);
    assert.ok(failed.nextAttemptAt);
    await assert.rejects(
        processCheckoutSession(f.session.id, dependencies),
        StripePaymentProcessingUnavailableError,
    );
    const firstControl = controls[0];
    assert.ok(firstControl);
    await assert.rejects(
        firstControl.assertOwned(),
        StripePaymentProcessingClaimLostError,
    );
    const partialMappings = await getCheckoutOperationMappings(
        f.items.map((item) => item.id),
    );
    // Advance only the repository's supported clock seam, preserving the real
    // backoff, lifetime attempt budget, token rotation and fencing behavior.
    clock = failed.nextAttemptAt;
    await processCheckoutSession(f.session.id, dependencies);
    assert.equal(selectedDates.length, 5);
    const complete = await effects(f.accountId);
    assert.equal(complete.operations.length, 9);
    assert.equal(complete.deliveries.length, 9);
    assert.deepEqual(
        complete.operations.filter((row) =>
            partial.operations.some((previous) => previous.id === row.id),
        ),
        partial.operations,
    );
    assert.deepEqual(rewardEvents(complete.events, f.accountId), rewards);
    const mappings = await getCheckoutOperationMappings(
        f.items.map((item) => item.id),
    );
    assert.equal(mappings.size, 9);
    for (const [itemId, mapping] of partialMappings)
        assert.deepEqual(mappings.get(itemId), mapping);
    for (const [itemId, mapping] of originalMappings)
        assert.deepEqual(mappings.get(itemId), mapping);
    for (const item of f.items) {
        const mapping = mappings.get(item.id);
        assert.ok(mapping);
        assert.equal(mapping.scheduledDate, scheduleIso);
        assert.equal(
            mapping.plantingId ?? null,
            item.positionIndex === null ? f.plantingId : null,
        );
        assert.equal(
            mapping.requestNote,
            `Synthetic purchased item ${f.items.indexOf(item)}`,
        );
        assert.equal(
            complete.deliveries.filter(
                (row) => row.operationId === mapping.operationId,
            ).length,
            1,
        );
        const operationIntents = complete.notifications.filter(
            (row) => row.metadata?.operationId === mapping.operationId,
        );
        assert.equal(operationIntents.length, 1);
        assert.equal(operationIntents[0]?.status, 'queued');
        assert.equal(
            rewards.filter((row) => {
                return (
                    row.data &&
                    typeof row.data === 'object' &&
                    'reason' in row.data &&
                    row.data.reason === `payment:shoppingCartItem:${item.id}`
                );
            }).length,
            1,
        );
        assert.equal(
            complete.events.filter(
                (row) =>
                    row.type === knownEventTypes.checkout.operationCreated &&
                    row.aggregateId === `shoppingCartItem:${item.id}`,
            ).length,
            1,
        );
        const schedules = complete.events.filter(
            (row) =>
                row.type === knownEventTypes.operations.schedule &&
                row.aggregateId === String(mapping.operationId),
        );
        assert.equal(schedules.length, 1);
        assert.ok(
            schedules[0]?.data &&
                typeof schedules[0].data === 'object' &&
                'scheduledDate' in schedules[0].data,
        );
        assert.equal(schedules[0].data.scheduledDate, scheduleIso);
    }
    const outputs = await getStripePaymentCompletionOutputs(f.session.id);
    assert.ok(outputs);
    assert.notEqual(
        outputs.orderConfirmationEmailMessageId,
        outputs.purchaseNotificationEmailMessageId,
    );
    assert.equal(
        complete.notifications.filter(
            (row) => row.metadata?.stripePaymentId === f.session.id,
        ).length,
        2,
    );
    for (const id of [
        outputs.orderConfirmationEmailMessageId,
        outputs.purchaseNotificationEmailMessageId,
    ]) {
        const intent = complete.notifications.find((row) => row.id === id);
        assert.ok(intent);
        assert.equal(intent.status, 'queued');
        assert.equal(intent.metadata?.stripePaymentId, f.session.id);
    }
    assert.equal(complete.transactions.length, 1);
    const transaction = complete.transactions[0];
    assert.ok(transaction);
    assert.equal(transaction.stripePaymentId, f.session.id);
    assert.equal(transaction.amount, priceCents * 9);
    assert.equal(transaction.status, 'completed');
    const claim = await getStripePaymentProcessingClaim(f.session.id);
    assert.equal(claim?.status, 'completed');
    assert.equal(claim.attemptCount, 2);
    assert.equal(claim.completedTransactionId, transaction.id);
    assert.notEqual(controls[0]?.claimToken, controls[1]?.claimToken);
    assert.equal((await getShoppingCart(f.cartId))?.status, 'paid');
    const frozen = await getStripeCheckoutAttempt(
        f.cartId,
        f.snapshot.attemptId,
    );
    assert.deepEqual(frozen?.snapshot, f.snapshot);
    await Promise.all(
        Array.from({ length: 3 }, () =>
            processCheckoutSession(f.session.id, dependencies),
        ),
    );
    assert.deepEqual(await effects(f.accountId), complete);
    assert.deepEqual(
        await getStripePaymentCompletionOutputs(f.session.id),
        outputs,
    );
    assert.deepEqual(
        await getStripePaymentProcessingClaim(f.session.id),
        claim,
    );
    assert.equal(
        providerReads,
        2,
        'completed duplicates must stop before provider access',
    );
    await assert.rejects(
        firstControl.assertOwned(),
        StripePaymentProcessingClaimLostError,
    );
});
