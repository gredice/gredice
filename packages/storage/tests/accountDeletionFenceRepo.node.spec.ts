import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    accountDeletionStartedEventType,
    accounts,
    addGardenBoxInventoryItem,
    addInventoryItem,
    createAccount,
    createEntity,
    createEvent,
    createGardenBlock,
    createOutletOffer,
    deleteAccountWithDependencies,
    deleteGardenBlock,
    events,
    fenceAccountShoppingCartsForDeletion,
    getAccount,
    getGardenBoxInventoryAggregateId,
    getInventoryAggregateId,
    getOrCreateShoppingCart,
    getShoppingCart,
    knownEvents,
    knownEventTypes,
    markAccountDeletionStarted,
    raisedBeds,
    softDeleteNewRaisedBedOnce,
    storage,
    updateEntity,
    upsertEntityType,
    withAccountDeletionFenceTransaction,
} from '@gredice/storage';
import { and, eq, inArray } from 'drizzle-orm';
import {
    accountInvitations,
    accountUsers,
    aiAccountLimitOverrides,
    aiChatConversations,
    aiChatMessages,
    aiUsageLedger,
    deliveryAddresses,
    deliveryRequests,
    deliveryRunStops,
    deliveryRuns,
    gardenBlocks,
    gardens,
    gardenVisitStates,
    harvestTraceLinks,
    harvestTraceScans,
    invoiceItems,
    invoices,
    notificationEmailLog,
    notifications,
    operations,
    outletOfferReservations,
    pickupLocations,
    raisedBedFields,
    receipts,
    shoppingCartItems,
    shoppingCarts,
    sunflowerLedgerEntries,
    timeSlots,
    transactions,
    users,
} from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function getDeletionMarkers(accountId: string) {
    return storage().query.events.findMany({
        where: and(
            eq(events.aggregateId, accountId),
            eq(events.type, accountDeletionStartedEventType),
        ),
    });
}

test('account deletion fence remains durable until final account cleanup', async () => {
    createTestDb();
    const accountId = randomUUID();
    await storage().insert(accounts).values({ id: accountId });
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);

    assert.equal(await fenceAccountShoppingCartsForDeletion(accountId), true);
    assert.equal(await getShoppingCart(cart.id), undefined);
    assert.equal((await getDeletionMarkers(accountId)).length, 1);

    await assert.rejects(
        () => getOrCreateShoppingCart(accountId),
        (error) => {
            assert.ok(error instanceof AccountDeletionInProgressError);
            assert.equal(error.accountId, accountId);
            return true;
        },
    );

    assert.equal(await fenceAccountShoppingCartsForDeletion(accountId), true);
    assert.equal((await getDeletionMarkers(accountId)).length, 1);

    await deleteAccountWithDependencies(accountId, 'missing-test-user');
    assert.equal(
        await storage().query.accounts.findFirst({
            where: eq(accounts.id, accountId),
        }),
        undefined,
    );
    assert.equal((await getDeletionMarkers(accountId)).length, 0);
});

test('account deletion fence transactions serialize one account row', async () => {
    createTestDb();
    const accountId = randomUUID();
    await storage().insert(accounts).values({ id: accountId });
    const events: string[] = [];
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    let firstDidStart = () => {};
    const firstStarted = new Promise<void>((resolve) => {
        firstDidStart = resolve;
    });

    const first = withAccountDeletionFenceTransaction(accountId, async () => {
        events.push('first-start');
        firstDidStart();
        await firstMayFinish;
        events.push('first-end');
    });
    await firstStarted;
    const second = withAccountDeletionFenceTransaction(accountId, async () => {
        events.push('second-start');
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(events, ['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
});

test('account deletion fence transaction reuses an injected transaction', async () => {
    createTestDb();
    const accountId = randomUUID();
    await storage()
        .insert(accounts)
        .values({ id: accountId, addressCity: 'Before rollback' });

    await assert.rejects(
        storage().transaction((transaction) =>
            withAccountDeletionFenceTransaction(
                accountId,
                async (fenceTransaction) => {
                    assert.equal(fenceTransaction, transaction);
                    await fenceTransaction
                        .update(accounts)
                        .set({ addressCity: 'Uncommitted city' })
                        .where(eq(accounts.id, accountId));
                    throw new Error('reject fenced mutation');
                },
                transaction,
            ),
        ),
        /reject fenced mutation/u,
    );

    assert.equal((await getAccount(accountId))?.addressCity, 'Before rollback');
});

test('account deletion fence transaction rejects missing and deleting accounts', async () => {
    createTestDb();
    const missingAccountId = randomUUID();
    await assert.rejects(
        withAccountDeletionFenceTransaction(
            missingAccountId,
            async () => undefined,
        ),
        (error) => {
            assert.ok(error instanceof AccountNotFoundError);
            assert.equal(error.accountId, missingAccountId);
            return true;
        },
    );

    const deletingAccountId = randomUUID();
    await storage().insert(accounts).values({ id: deletingAccountId });
    await storage().transaction((transaction) =>
        markAccountDeletionStarted(deletingAccountId, transaction),
    );
    await assert.rejects(
        withAccountDeletionFenceTransaction(
            deletingAccountId,
            async () => undefined,
        ),
        (error) => {
            assert.ok(error instanceof AccountDeletionInProgressError);
            assert.equal(error.accountId, deletingAccountId);
            return true;
        },
    );
});

test('account deletion detaches a recycled soft-deleted raised bed before removing its garden', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await storage().transaction(async (transaction) => {
        assert.equal(
            await softDeleteNewRaisedBedOnce(raisedBedId, transaction),
            true,
        );
    });

    await deleteAccountWithDependencies(accountId, 'missing-test-user');

    const recycledBed = await storage().query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, raisedBedId),
    });
    assert.ok(recycledBed);
    assert.equal(recycledBed.isDeleted, true);
    assert.equal(recycledBed.status, 'abandoned');
    assert.equal(recycledBed.accountId, null);
    assert.equal(recycledBed.gardenId, null);
    assert.equal(recycledBed.blockId, null);
    assert.equal(await getAccount(accountId), undefined);
});

test('account deletion erases only exact owned garden and inventory event families', async () => {
    createTestDb();
    const accountId = await createAccount();
    const otherAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const gardenBoxBlockId = await createGardenBlock(gardenId, 'GardenBox');
    const raisedBedBlockId = await createGardenBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        raisedBedBlockId,
    );
    const backpackAggregateId = getInventoryAggregateId(accountId);
    const gardenBoxAggregateId = getGardenBoxInventoryAggregateId({
        accountId,
        gardenId,
        blockId: gardenBoxBlockId,
    });
    const otherAccountGardenBoxAggregateId = getGardenBoxInventoryAggregateId({
        accountId: otherAccountId,
        gardenId,
        blockId: gardenBoxBlockId,
    });

    await addInventoryItem(accountId, {
        amount: 1,
        entityId: 'owned-backpack-item',
        entityTypeName: 'block',
        source: 'account-deletion-test',
    });
    await addGardenBoxInventoryItem(accountId, gardenId, gardenBoxBlockId, {
        amount: 1,
        entityId: 'owned-box-item',
        entityTypeName: 'block',
        source: 'account-deletion-test',
    });
    await deleteGardenBlock(gardenId, gardenBoxBlockId);
    await createEvent(
        knownEvents.gardens.renamedV1(gardenId.toString(), {
            name: 'Owned garden event',
        }),
    );

    const retainedEvents = await storage()
        .insert(events)
        .values([
            {
                aggregateId: gardenId.toString(),
                data: {},
                type: knownEventTypes.transactions.create,
                version: 1,
            },
            {
                aggregateId: backpackAggregateId,
                data: {},
                type: knownEventTypes.operations.schedule,
                version: 1,
            },
            {
                aggregateId: gardenBoxAggregateId,
                data: {},
                type: knownEventTypes.transactions.update,
                version: 1,
            },
            {
                aggregateId: otherAccountGardenBoxAggregateId,
                data: {
                    amount: 1,
                    entityId: 'other-account-box-item',
                    entityTypeName: 'block',
                },
                type: knownEventTypes.inventory.add,
                version: 1,
            },
            {
                aggregateId: raisedBedId.toString(),
                data: {
                    blockId: raisedBedBlockId,
                    gardenId,
                },
                type: knownEventTypes.raisedBeds.create,
                version: 1,
            },
        ])
        .returning({ id: events.id });

    await deleteAccountWithDependencies(accountId, 'missing-test-user');

    const erasedEvents = await storage().query.events.findMany({
        where: and(
            inArray(events.type, [
                ...Object.values(knownEventTypes.gardens),
                ...Object.values(knownEventTypes.inventory),
            ]),
            inArray(events.aggregateId, [
                gardenId.toString(),
                backpackAggregateId,
                gardenBoxAggregateId,
            ]),
        ),
    });
    assert.deepEqual(erasedEvents, []);

    const retainedEventIds = retainedEvents.map((event) => event.id);
    const survivingEvents = await storage().query.events.findMany({
        where: inArray(events.id, retainedEventIds),
    });
    assert.deepEqual(
        survivingEvents
            .map((event) => event.id)
            .sort((left, right) => left - right),
        retainedEventIds.sort((left, right) => left - right),
    );
});

test('account deletion clears hard FK families while retaining detached commercial history', async () => {
    createTestDb();
    const fixtureId = randomUUID();
    const accountId = await createAccount();
    const userId = `account-delete-user-${fixtureId}`;
    const driverUserId = `account-delete-driver-${fixtureId}`;
    await storage()
        .insert(users)
        .values([
            {
                id: userId,
                role: 'user',
                userName: `account-delete-${fixtureId}`,
            },
            {
                id: driverUserId,
                role: 'admin',
                userName: `account-delete-driver-${fixtureId}`,
            },
        ]);
    await storage().insert(accountUsers).values({ accountId, userId });

    const farmId = await ensureFarmId();
    const activeGardenId = await createTestGarden({ accountId, farmId });
    const deletedGardenId = await createTestGarden({ accountId, farmId });
    const activeBlockId = await createTestBlock(activeGardenId, 'Raised_Bed');
    const deletedBlockId = await createTestBlock(deletedGardenId, 'Raised_Bed');
    const activeRaisedBedId = await createTestRaisedBed(
        activeGardenId,
        accountId,
        activeBlockId,
    );
    const deletedRaisedBedId = await createTestRaisedBed(
        deletedGardenId,
        accountId,
        deletedBlockId,
    );
    await storage()
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, deletedGardenId));
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, deletedRaisedBedId));

    const [raisedBedField] = await storage()
        .insert(raisedBedFields)
        .values({ raisedBedId: activeRaisedBedId, positionIndex: 0 })
        .returning({ id: raisedBedFields.id });
    assert.ok(raisedBedField);

    const entityTypeName = `account-delete-plant-sort-${fixtureId}`;
    await upsertEntityType({
        label: 'Account deletion plant sort',
        name: entityTypeName,
    });
    const plantSortId = await createEntity(entityTypeName);
    await updateEntity({
        entityTypeName,
        id: plantSortId,
        state: 'published',
    });
    const outletOfferId = await createOutletOffer({
        adminNotes: null,
        comparePriceCents: null,
        endAt: new Date('2027-01-02T00:00:00.000Z'),
        imageUrls: [],
        initialPlantStatus: 'sprouted',
        outletPriceCents: 199,
        plantSortId,
        quantity: 2,
        sowingDate: new Date('2026-08-01T00:00:00.000Z'),
        startAt: new Date('2026-08-01T00:00:00.000Z'),
        status: 'published',
    });

    const [newCart] = await storage()
        .insert(shoppingCarts)
        .values({ accountId, status: 'new' })
        .returning({ id: shoppingCarts.id });
    const [newCartItem] = await storage()
        .insert(shoppingCartItems)
        .values({
            amount: 199,
            cartId: newCart.id,
            currency: 'eur',
            entityId: plantSortId.toString(),
            entityTypeName,
            gardenId: activeGardenId,
            raisedBedId: activeRaisedBedId,
            status: 'new',
        })
        .returning({ id: shoppingCartItems.id });
    await storage()
        .insert(outletOfferReservations)
        .values({
            accountId,
            cartId: newCart.id,
            cartItemId: newCartItem.id,
            heldComparePriceCents: null,
            heldInitialPlantStatus: 'sprouted',
            heldOutletPriceCents: 199,
            heldSowingDate: new Date('2026-08-01T00:00:00.000Z'),
            holdExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
            outletOfferId,
            quantity: 1,
            status: 'held',
        });

    const [paidCart] = await storage()
        .insert(shoppingCarts)
        .values({ accountId, status: 'paid' })
        .returning({ id: shoppingCarts.id });
    const [paidCartItem] = await storage()
        .insert(shoppingCartItems)
        .values({
            amount: 199,
            cartId: paidCart.id,
            currency: 'eur',
            entityId: plantSortId.toString(),
            entityTypeName,
            gardenId: deletedGardenId,
            raisedBedId: deletedRaisedBedId,
            status: 'paid',
        })
        .returning({ id: shoppingCartItems.id });

    const [transaction] = await storage()
        .insert(transactions)
        .values({
            accountId,
            amount: 199,
            currency: 'eur',
            gardenId: activeGardenId,
            status: 'paid',
            stripePaymentId: `pi-account-delete-${fixtureId}`,
        })
        .returning({ id: transactions.id });
    const [invoice] = await storage()
        .insert(invoices)
        .values({
            accountId,
            billToEmail: `account-delete-${fixtureId}@example.test`,
            currency: 'eur',
            dueDate: new Date('2026-09-01T00:00:00.000Z'),
            invoiceNumber: `account-delete-invoice-${fixtureId}`,
            issueDate: new Date('2026-08-30T00:00:00.000Z'),
            status: 'paid',
            subtotal: '1.99',
            taxAmount: '0.00',
            totalAmount: '1.99',
            transactionId: transaction.id,
        })
        .returning({ id: invoices.id });
    await storage().insert(invoiceItems).values({
        description: 'Account deletion invoice item',
        invoiceId: invoice.id,
        quantity: '1.00',
        totalPrice: '1.99',
        unitPrice: '1.99',
    });
    const [receipt] = await storage()
        .insert(receipts)
        .values({
            cisStatus: 'confirmed',
            currency: 'eur',
            invoiceId: invoice.id,
            paymentMethod: 'card',
            receiptNumber: `account-delete-receipt-${fixtureId}`,
            subtotal: '1.99',
            taxAmount: '0.00',
            totalAmount: '1.99',
            yearReceiptNumber: `2026-account-delete-${fixtureId}`,
        })
        .returning({ id: receipts.id });
    await storage()
        .insert(sunflowerLedgerEntries)
        .values({
            accountId,
            amount: -50,
            availableBalanceAfter: 50,
            availableDelta: -50,
            entryType: 'debit',
            idempotencyKey: `account-delete-ledger-${fixtureId}`,
            invoiceId: invoice.id,
            receiptId: receipt.id,
            reservedBalanceAfter: 0,
            reservedDelta: 0,
            totalBalanceAfter: 50,
            transactionId: transaction.id,
        });

    const conversationId = `account-delete-conversation-${fixtureId}`;
    await storage().insert(aiChatConversations).values({
        accountId,
        gardenId: activeGardenId,
        id: conversationId,
        raisedBedId: activeRaisedBedId,
        status: 'active',
        userId,
    });
    await storage()
        .insert(aiChatMessages)
        .values({
            conversationId,
            id: `account-delete-message-${fixtureId}`,
            parts: [{ type: 'text', text: 'Delete me' }],
            role: 'user',
        });
    await storage()
        .insert(aiUsageLedger)
        .values({
            accountId,
            conversationId,
            id: `account-delete-usage-${fixtureId}`,
            model: 'test-model',
            requestId: `account-delete-request-${fixtureId}`,
            status: 'completed',
            usageDate: '2026-08-30',
            userId,
        });
    await storage().insert(aiAccountLimitOverrides).values({
        accountId,
        disabled: true,
        updatedByUserId: userId,
    });
    await storage()
        .insert(gardenVisitStates)
        .values([
            { accountId, gardenId: activeGardenId, userId },
            { accountId, gardenId: deletedGardenId, userId },
        ]);
    await storage().insert(deliveryAddresses).values({
        accountId,
        city: 'Zagreb',
        contactName: 'Delete Me',
        countryCode: 'HR',
        label: 'Home',
        phone: '+385000000',
        postalCode: '10000',
        street1: 'Delete Street 1',
    });
    await storage()
        .insert(accountInvitations)
        .values({
            accountId,
            email: `invite-${fixtureId}@example.test`,
            expiresAt: new Date('2027-01-01T00:00:00.000Z'),
            invitedByUserId: userId,
            token: `account-delete-invite-${fixtureId}`,
        });

    const notificationId = `account-delete-notification-${fixtureId}`;
    await storage()
        .insert(notifications)
        .values({
            accountId,
            blockId: activeBlockId,
            content: 'Delete me',
            gardenId: activeGardenId,
            header: 'Delete me',
            id: notificationId,
            raisedBedId: activeRaisedBedId,
            timestamp: new Date('2026-08-30T00:00:00.000Z'),
            userId,
        });
    await storage().insert(notificationEmailLog).values({
        notificationId,
        userId,
    });

    const [plantPlaceEvent] = await storage()
        .insert(events)
        .values({
            aggregateId: activeRaisedBedId.toString(),
            data: {},
            type: 'account-delete.plant-placed',
            version: 1,
        })
        .returning({ id: events.id });
    const [harvestOperation] = await storage()
        .insert(operations)
        .values({
            accountId,
            entityId: plantSortId,
            entityTypeName,
            gardenId: activeGardenId,
            raisedBedFieldId: raisedBedField.id,
            raisedBedId: activeRaisedBedId,
        })
        .returning({ id: operations.id });
    const [traceLink] = await storage()
        .insert(harvestTraceLinks)
        .values({
            accountId,
            fieldLabel: 'A1',
            fieldPositionIndex: 0,
            gardenId: activeGardenId,
            harvestOperationId: harvestOperation.id,
            plantPlaceEventId: plantPlaceEvent.id,
            publicToken: `account-delete-trace-${fixtureId}`,
            raisedBedFieldId: raisedBedField.id,
            raisedBedId: activeRaisedBedId,
            tracePath: `account-delete/${fixtureId}`,
        })
        .returning({ id: harvestTraceLinks.id });
    await storage().insert(harvestTraceScans).values({
        harvestTraceLinkId: traceLink.id,
        userAgentFamily: 'test',
    });

    const [pickupLocation] = await storage()
        .insert(pickupLocations)
        .values({
            city: 'Zagreb',
            countryCode: 'HR',
            name: `Account delete pickup ${fixtureId}`,
            postalCode: '10000',
            street1: 'Pickup Street 1',
        })
        .returning({ id: pickupLocations.id });
    const [timeSlot] = await storage()
        .insert(timeSlots)
        .values({
            endAt: new Date('2026-09-01T12:00:00.000Z'),
            locationId: pickupLocation.id,
            startAt: new Date('2026-09-01T10:00:00.000Z'),
            status: 'scheduled',
            type: 'pickup',
        })
        .returning({ id: timeSlots.id });
    const deliveryRequestId = `account-delete-request-${fixtureId}`;
    await storage().insert(deliveryRequests).values({
        id: deliveryRequestId,
        operationId: harvestOperation.id,
    });
    const deliveryRunId = `account-delete-run-${fixtureId}`;
    await storage().insert(deliveryRuns).values({
        driverUserId,
        id: deliveryRunId,
        timeSlotId: timeSlot.id,
    });
    const [deliveryRunStop] = await storage()
        .insert(deliveryRunStops)
        .values({
            deliveryRequestId,
            formattedAddress: 'Pickup Street 1, Zagreb',
            latitude: 45.815,
            longitude: 15.9819,
            pickupItemState: 'ready',
            pickupTraceLinkId: traceLink.id,
            pickupTraceToken: `account-delete-trace-${fixtureId}`,
            runId: deliveryRunId,
            sequence: 1,
        })
        .returning({ id: deliveryRunStops.id });

    await deleteAccountWithDependencies(accountId, userId);
    await deleteAccountWithDependencies(accountId, userId);

    assert.equal(await getAccount(accountId), undefined);
    assert.equal(
        await storage().query.users.findFirst({ where: eq(users.id, userId) }),
        undefined,
    );
    assert.deepEqual(
        await storage().query.gardens.findMany({
            where: inArray(gardens.id, [activeGardenId, deletedGardenId]),
        }),
        [],
    );
    assert.deepEqual(
        await storage().query.gardenBlocks.findMany({
            where: inArray(gardenBlocks.id, [activeBlockId, deletedBlockId]),
        }),
        [],
    );

    const detachedBeds = await storage().query.raisedBeds.findMany({
        where: inArray(raisedBeds.id, [activeRaisedBedId, deletedRaisedBedId]),
    });
    assert.equal(detachedBeds.length, 2);
    for (const bed of detachedBeds) {
        assert.equal(bed.accountId, null);
        assert.equal(bed.blockId, null);
        assert.equal(bed.gardenId, null);
        assert.equal(bed.status, 'abandoned');
    }

    assert.equal(
        await storage().query.shoppingCarts.findFirst({
            where: eq(shoppingCarts.id, newCart.id),
        }),
        undefined,
    );
    assert.equal(
        await storage().query.shoppingCartItems.findFirst({
            where: eq(shoppingCartItems.id, newCartItem.id),
        }),
        undefined,
    );
    assert.equal(
        await storage().query.outletOfferReservations.findFirst({
            where: eq(outletOfferReservations.accountId, accountId),
        }),
        undefined,
    );
    const retainedCart = await storage().query.shoppingCarts.findFirst({
        where: eq(shoppingCarts.id, paidCart.id),
    });
    const retainedItem = await storage().query.shoppingCartItems.findFirst({
        where: eq(shoppingCartItems.id, paidCartItem.id),
    });
    assert.ok(retainedCart);
    assert.ok(retainedItem);
    assert.equal(retainedCart.accountId, null);
    assert.equal(retainedItem.gardenId, null);
    assert.equal(retainedItem.raisedBedId, null);

    const retainedTransaction = await storage().query.transactions.findFirst({
        where: eq(transactions.id, transaction.id),
    });
    const retainedReceipt = await storage().query.receipts.findFirst({
        where: eq(receipts.id, receipt.id),
    });
    assert.ok(retainedTransaction);
    assert.ok(retainedReceipt);
    assert.equal(retainedTransaction.accountId, null);
    assert.equal(retainedTransaction.gardenId, null);
    assert.equal(retainedReceipt.invoiceId, null);
    assert.equal(
        await storage().query.invoices.findFirst({
            where: eq(invoices.id, invoice.id),
        }),
        undefined,
    );
    assert.equal(
        await storage().query.sunflowerLedgerEntries.findFirst({
            where: eq(sunflowerLedgerEntries.accountId, accountId),
        }),
        undefined,
    );

    assert.equal(
        await storage().query.aiChatConversations.findFirst({
            where: eq(aiChatConversations.id, conversationId),
        }),
        undefined,
    );
    assert.equal(
        await storage().query.notifications.findFirst({
            where: eq(notifications.id, notificationId),
        }),
        undefined,
    );
    assert.equal(
        await storage().query.harvestTraceLinks.findFirst({
            where: eq(harvestTraceLinks.id, traceLink.id),
        }),
        undefined,
    );
    const retainedDeliveryStop =
        await storage().query.deliveryRunStops.findFirst({
            where: eq(deliveryRunStops.id, deliveryRunStop.id),
        });
    assert.ok(retainedDeliveryStop);
    assert.equal(retainedDeliveryStop.pickupTraceLinkId, null);
});
