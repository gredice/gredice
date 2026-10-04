import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    completeSelectedRaisedBedPlantingTask,
    createAccount,
    createEvent,
    createFarm,
    events,
    farmerPayoutRequests,
    gardens,
    getFarmerBalance,
    getRaisedBedFieldsWithEvents,
    getSunflowers,
    knownEvents,
    knownEventTypes,
    notifications,
    storage,
    updateSelectedRaisedBedPlantingLifecycleStatus,
    upsertOperationPrice,
    upsertRaisedBedField,
    users,
} from '@gredice/storage';
import { and, eq, sql } from 'drizzle-orm';
import { createSelectedTaskFixture } from './helpers/selectedPlantingFixture';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

const day = 24 * 60 * 60 * 1000;
async function fixture(
    currency: 'sunflower' | 'eur' | 'inventory' = 'sunflower',
    sowingLocation: 'direct' | 'greenhouse' = 'direct',
) {
    createTestDb();
    const accountId = await createAccount();
    const initialBalance = await getSunflowers(accountId);
    const farmId = await createFarm({
        name: `Refund ${randomUUID()}`,
        longitude: 0,
        latitude: 0,
    });
    const gardenId = await createTestGarden({ accountId, farmId });
    const bedId = await createTestRaisedBed(
        gardenId,
        accountId,
        await createTestBlock(gardenId, 'Raised_Bed'),
    );
    await upsertRaisedBedField({ raisedBedId: bedId, positionIndex: 0 });
    await upsertOperationPrice({
        farmId,
        entityTypeName:
            sowingLocation === 'greenhouse' ? 'sowingGreenhouse' : 'sowing',
        pricePerUnit: '4.00',
        currency: 'eur',
    });
    const aggregateId = `${bedId}|0`;
    const sowedAt = new Date(Date.now() - 20 * day);
    await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: '1',
            scheduledDate: null,
            sowingLocation,
            purchase:
                currency === 'sunflower'
                    ? { cartItemId: 1, currency, sunflowerAmount: 1234 }
                    : currency === 'eur'
                      ? { cartItemId: 1, currency, euroAmountCents: 123 }
                      : { cartItemId: 1, currency },
        }),
        createdAt: new Date(sowedAt.getTime() - day),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: sowedAt,
    });
    const change = (
        effectiveDate: Date,
        db?: Parameters<typeof createEvent>[1],
    ) =>
        createEvent(
            knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status: 'notSprouted',
                effectiveDate: effectiveDate.toISOString(),
            }),
            db,
        );
    return {
        accountId,
        initialBalance,
        farmId,
        bedId,
        aggregateId,
        sowedAt,
        change,
    };
}

test('15-day boundary uses effective date, not placement or submission time', async () => {
    const f = await fixture();
    await f.change(new Date(f.sowedAt.getTime() + 15 * day - 1));
    assert.equal(await getSunflowers(f.accountId), f.initialBalance);
    assert.equal((await getFarmerBalance('', f.farmId)).availableBalance, 4);
    const notice = await storage().query.notifications.findFirst({
        where: eq(notifications.accountId, f.accountId),
    });
    assert.match(notice?.content ?? '', /suncokreti nisu vraćeni/);
    await f.change(new Date(f.sowedAt.getTime() + 15 * day));
    assert.equal(await getSunflowers(f.accountId), f.initialBalance + 1234);
    const balance = await getFarmerBalance('', f.farmId);
    assert.equal(balance.availableBalance, 2);
    assert.equal(
        balance.earningsByType.find(
            (earning) => earning.entityTypeName === 'sowingNotSprouted',
        )?.totalEarned,
        -2,
    );
});

test('concurrent retries and later corrections credit and deduct only once', async () => {
    const f = await fixture();
    await Promise.all([f.change(new Date()), f.change(new Date())]);
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(f.aggregateId, {
            status: 'sprouted',
        }),
    );
    await f.change(new Date());
    assert.equal(await getSunflowers(f.accountId), f.initialBalance + 1234);
    assert.equal((await getFarmerBalance('', f.farmId)).availableBalance, 2);
    const notices = await storage()
        .select()
        .from(notifications)
        .where(eq(notifications.accountId, f.accountId));
    assert.equal(
        notices.filter((notice) => notice.content?.includes('1234 🌻')).length,
        1,
    );
    const settlements = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(
                    events.type,
                    knownEventTypes.raisedBedFields.notSproutedRefund,
                ),
                eq(sql`${events.data}->>'accountId'`, f.accountId),
            ),
        );
    assert.equal(settlements.length, 1);
});

test('missing sowing date and sandbox planting do not issue refunds', async () => {
    const missing = await fixture();
    await storage()
        .delete(events)
        .where(
            and(
                eq(events.aggregateId, missing.aggregateId),
                eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
            ),
        );
    await missing.change(new Date());
    assert.equal(
        await getSunflowers(missing.accountId),
        missing.initialBalance,
    );
    const sandbox = await fixture();
    await storage()
        .update(gardens)
        .set({ isSandbox: true })
        .where(eq(gardens.accountId, sandbox.accountId));
    await sandbox.change(new Date());
    assert.equal(
        await getSunflowers(sandbox.accountId),
        sandbox.initialBalance,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(notifications)
                .where(eq(notifications.accountId, sandbox.accountId))
        ).length,
        0,
    );
});

test('status, credit, correction and notification roll back together', async () => {
    const f = await fixture();
    await assert.rejects(
        storage().transaction(async (tx) => {
            await f.change(new Date(), tx);
            throw new Error('rollback');
        }),
        /rollback/,
    );
    assert.equal(await getSunflowers(f.accountId), f.initialBalance);
    assert.equal((await getFarmerBalance('', f.farmId)).availableBalance, 4);
    assert.equal(
        (
            await storage()
                .select()
                .from(notifications)
                .where(eq(notifications.accountId, f.accountId))
        ).length,
        0,
    );
    assert.equal(
        (await getRaisedBedFieldsWithEvents(f.bedId))[0]?.plantStatus,
        'sowed',
    );
    await f.change(new Date());
    assert.equal(await getSunflowers(f.accountId), f.initialBalance + 1234);
});

test('euro planting refunds convert the original charge, inventory has no credit', async () => {
    const euro = await fixture('eur', 'greenhouse');
    await euro.change(new Date());
    assert.equal(
        await getSunflowers(euro.accountId),
        euro.initialBalance + 1230,
    );
    assert.equal((await getFarmerBalance('', euro.farmId)).availableBalance, 2);
    const inventory = await fixture('inventory');
    await inventory.change(new Date());
    assert.equal(
        await getSunflowers(inventory.accountId),
        inventory.initialBalance,
    );
});

test('deduction after a paid sowing carries into the next payout window', async () => {
    const f = await fixture();
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${userId}@example.com`,
            role: 'farmer',
        });
    await storage()
        .insert(farmerPayoutRequests)
        .values({
            farmId: f.farmId,
            userId,
            requestedAmount: '4.00',
            currency: 'eur',
            status: 'paid',
            createdAt: new Date(Date.now() - day),
            paidAt: new Date(),
        });
    await f.change(new Date());
    const balance = await getFarmerBalance(userId, f.farmId);
    assert.equal(balance.totalOperationEarned, -2);
    assert.equal(balance.totalPaid, 4);
    assert.equal(balance.availableBalance, 0);
});

test('selected multi-field planting refunds once for the whole planting', async () => {
    const f = await createSelectedTaskFixture({
        multiField: true,
        sunflowerAmount: 4321,
    });
    const initialBalance = await getSunflowers(f.accountId);
    const sowed = await completeSelectedRaisedBedPlantingTask({
        ...f.task.identity,
        commandId: randomUUID(),
        actor: { role: 'admin', userId: f.adminId },
    });
    await storage()
        .update(events)
        .set({ createdAt: new Date(Date.now() - 20 * day) })
        .where(eq(events.aggregateId, f.aggregateId));
    await upsertOperationPrice({
        farmId: f.farmId,
        entityTypeName: 'sowing',
        pricePerUnit: '6.00',
        currency: 'eur',
    });
    const input = {
        ...sowed.task.identity,
        commandId: randomUUID(),
        actor: { role: 'admin' as const, userId: f.adminId },
        status: 'notSprouted' as const,
    };
    await updateSelectedRaisedBedPlantingLifecycleStatus(input);
    await updateSelectedRaisedBedPlantingLifecycleStatus(input);
    assert.equal(await getSunflowers(f.accountId), initialBalance + 4321);
    assert.equal((await getFarmerBalance('', f.farmId)).availableBalance, 3);
    const notices = await storage()
        .select()
        .from(notifications)
        .where(eq(notifications.accountId, f.accountId));
    assert.equal(
        notices.filter((notice) => notice.content?.includes('4321 🌻')).length,
        1,
    );
});
