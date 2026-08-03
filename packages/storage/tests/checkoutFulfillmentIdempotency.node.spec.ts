import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    addInventoryItem,
    CheckoutDeliveryRequestConflictError,
    CheckoutOperationConflictError,
    consumeInventoryItem,
    createAccount,
    createDeliveryRequest,
    createOperation,
    createPickupLocation,
    createTimeSlot,
    deliveryRequests,
    events,
    getCheckoutInventoryConsumptions,
    getInventory,
    getOrCreateCheckoutOperation,
    getOrCreateDeliveryRequest,
    InventoryConsumptionSourceConflictError,
    knownEventTypes,
    operations,
    storage,
    TimeSlotStatuses,
    timeSlots,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

function uniqueCartItemId() {
    return randomInt(1_000_000_000, 2_000_000_000);
}

test('checkout operation ensure atomically maps one scheduled operation and rejects changed fingerprints', async () => {
    createTestDb();
    const accountId = await createAccount();
    const cartItemId = uniqueCartItemId();
    const scheduledDate = new Date('2099-04-05T00:00:00.000Z');
    const operationInput = {
        accountId,
        entityId: 17,
        entityTypeName: 'operation',
        gardenId: 23,
        raisedBedId: 29,
        raisedBedFieldId: 31,
    };

    const results = await Promise.all([
        getOrCreateCheckoutOperation(cartItemId, operationInput, {
            scheduledDate,
        }),
        getOrCreateCheckoutOperation(cartItemId, operationInput, {
            scheduledDate,
        }),
    ]);
    assert.equal(new Set(results.map((result) => result.operationId)).size, 1);
    assert.deepEqual(results.map((result) => result.created).sort(), [
        false,
        true,
    ]);

    const operationId = results[0].operationId;
    const [storedOperation] = await storage()
        .select()
        .from(operations)
        .where(eq(operations.id, operationId));
    assert.equal(storedOperation?.accountId, accountId);
    const scheduleEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.operations.schedule),
            eq(events.aggregateId, operationId.toString()),
        ),
    });
    assert.equal(scheduleEvents.length, 1);
    const mappingEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.checkout.operationCreated),
            eq(events.aggregateId, `shoppingCartItem:${cartItemId.toString()}`),
        ),
    });
    assert.equal(mappingEvents.length, 1);

    await acceptOperation(operationId);
    const acceptedRetry = await getOrCreateCheckoutOperation(
        cartItemId,
        operationInput,
        { scheduledDate },
    );
    assert.deepEqual(acceptedRetry, { operationId, created: false });

    await assert.rejects(
        getOrCreateCheckoutOperation(cartItemId, operationInput, {
            scheduledDate: new Date('2099-04-06T00:00:00.000Z'),
        }),
        CheckoutOperationConflictError,
    );
});

test('checkout operation mapping rolls back with operation and schedule', async () => {
    createTestDb();
    const accountId = await createAccount();
    const cartItemId = uniqueCartItemId();

    await assert.rejects(
        storage().transaction(async (tx) => {
            await getOrCreateCheckoutOperation(
                cartItemId,
                {
                    accountId,
                    entityId: 37,
                    entityTypeName: 'operation',
                },
                { scheduledDate: new Date('2099-04-07T00:00:00.000Z') },
                tx,
            );
            throw new Error('force rollback');
        }),
        /force rollback/,
    );

    const mappingEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.checkout.operationCreated),
            eq(events.aggregateId, `shoppingCartItem:${cartItemId.toString()}`),
        ),
    });
    assert.equal(mappingEvents.length, 0);
    const storedOperations = await storage().query.operations.findMany({
        where: and(
            eq(operations.accountId, accountId),
            eq(operations.entityId, 37),
        ),
    });
    assert.equal(storedOperations.length, 0);
});

test('checkout delivery ensure reuses one owned request after its slot closes while ordinary create rejects duplicates', async () => {
    createTestDb();
    const accountId = await createAccount();
    const operationId = await createOperation({
        accountId,
        entityId: 41,
        entityTypeName: 'operation',
    });
    const locationId = await createPickupLocation({
        name: `Checkout retry ${randomUUID()}`,
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const startAt = new Date('2099-05-01T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        status: TimeSlotStatuses.SCHEDULED,
    });
    const input = {
        operationId,
        slotId,
        mode: 'pickup' as const,
        locationId,
        accountId,
    };

    const results = await Promise.all([
        getOrCreateDeliveryRequest(input),
        getOrCreateDeliveryRequest(input),
    ]);
    assert.equal(new Set(results.map((result) => result.requestId)).size, 1);
    assert.deepEqual(results.map((result) => result.created).sort(), [
        false,
        true,
    ]);
    await assert.rejects(
        createDeliveryRequest(input),
        /Operation already has a delivery request/,
    );

    await storage()
        .update(timeSlots)
        .set({ status: TimeSlotStatuses.CLOSED })
        .where(eq(timeSlots.id, slotId));
    const retried = await getOrCreateDeliveryRequest(input);
    assert.equal(retried.requestId, results[0].requestId);
    assert.equal(retried.created, false);
    await assert.rejects(
        getOrCreateDeliveryRequest({ ...input, notes: 'changed' }),
        CheckoutDeliveryRequestConflictError,
    );

    const requests = await storage()
        .select({ id: deliveryRequests.id })
        .from(deliveryRequests)
        .where(eq(deliveryRequests.operationId, operationId));
    assert.equal(requests.length, 1);
});

test('checkout delivery ensure closes and rejects an expired new slot without nested locking', async () => {
    createTestDb();
    const accountId = await createAccount();
    const operationId = await createOperation({
        accountId,
        entityId: 43,
        entityTypeName: 'operation',
    });
    const locationId = await createPickupLocation({
        name: `Expired checkout slot ${randomUUID()}`,
        street1: 'Testna 2',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const startAt = new Date('2099-05-02T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        closesAt: new Date('2026-01-01T00:00:00.000Z'),
        status: TimeSlotStatuses.SCHEDULED,
    });

    await assert.rejects(
        getOrCreateDeliveryRequest({
            operationId,
            slotId,
            mode: 'pickup',
            locationId,
            accountId,
        }),
        /Time slot is not available for booking/,
    );
    const slot = await storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, slotId),
    });
    assert.equal(slot?.status, TimeSlotStatuses.CLOSED);
});

test('checkout inventory consumption is source-idempotent under concurrency and rejects conflicts', async () => {
    createTestDb();
    const accountId = await createAccount();
    const cartItemId = uniqueCartItemId();
    const source = `shoppingCartItem:${cartItemId.toString()}`;
    const payload = {
        entityTypeName: 'block',
        entityId: 'checkout-retry-block',
        amount: 1,
        source,
    };
    await addInventoryItem(accountId, {
        entityTypeName: payload.entityTypeName,
        entityId: payload.entityId,
        amount: 2,
        source: 'test',
    });

    await Promise.all([
        consumeInventoryItem(accountId, payload),
        consumeInventoryItem(accountId, payload),
    ]);
    const inventory = await getInventory(accountId);
    assert.equal(
        inventory.find(
            (item) =>
                item.entityTypeName === payload.entityTypeName &&
                item.entityId === payload.entityId,
        )?.amount,
        1,
    );
    assert.deepEqual(
        await getCheckoutInventoryConsumptions(accountId, [cartItemId]),
        [
            {
                cartItemId,
                source,
                entityTypeName: payload.entityTypeName,
                entityId: payload.entityId,
                amount: payload.amount,
            },
        ],
    );
    await assert.rejects(
        consumeInventoryItem(accountId, { ...payload, amount: 2 }),
        InventoryConsumptionSourceConflictError,
    );
});

test('checkout inventory lookup surfaces malformed requested source rows', async () => {
    createTestDb();
    const accountId = await createAccount();
    const cartItemId = uniqueCartItemId();
    const source = `shoppingCartItem:${cartItemId.toString()}`;
    await storage()
        .insert(events)
        .values({
            type: knownEventTypes.inventory.consume,
            version: 1,
            aggregateId: `inventory:${accountId}`,
            data: {
                entityTypeName: 'block',
                entityId: 'malformed-checkout-consumption',
                amount: 'one',
                source,
            },
        });

    await assert.rejects(
        getCheckoutInventoryConsumptions(accountId, [cartItemId]),
        InventoryConsumptionSourceConflictError,
    );
});
