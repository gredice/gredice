import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createOperation,
    FREE_WATERING_OPERATION_ID,
    getOperations,
    knownEvents,
    knownEventTypes,
    queueSeasonalSowingOfferOperations,
    storage,
} from '@gredice/storage';
import { and, eq, sql } from 'drizzle-orm';
import { events } from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createSeasonalOfferTestContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'seasonal-offer-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function getScheduledFreeWateringDates(
    accountId: string,
    gardenId: number,
    raisedBedId: number,
) {
    const operations = await getOperations(accountId, gardenId, raisedBedId);

    return operations
        .filter(
            (operation) =>
                operation.entityId === FREE_WATERING_OPERATION_ID &&
                operation.scheduledDate,
        )
        .map((operation) => operation.scheduledDate?.toISOString())
        .sort();
}

test('queueSeasonalSowingOfferOperations queues spring free waterings every two days', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 3);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations queues summer free waterings daily', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-01T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 5);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-01T08:00:00.000Z',
            '2026-06-02T08:00:00.000Z',
            '2026-06-03T08:00:00.000Z',
            '2026-06-04T08:00:00.000Z',
            '2026-06-05T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations queues autumn free waterings every two days', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-09-10T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 3);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-09-10T08:00:00.000Z',
            '2026-09-12T08:00:00.000Z',
            '2026-09-14T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations skips dates without a seasonal offer', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-01-10T08:00:00.000Z'),
    });

    assert.deepStrictEqual(createdOperationIds, []);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [],
    );
});

test('queueSeasonalSowingOfferOperations does not consume the offer because of unrelated existing free waterings', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();
    const existingOperationId = await createOperation({
        accountId,
        entityId: FREE_WATERING_OPERATION_ID,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });
    await createEvent(
        knownEvents.operations.scheduledV1(existingOperationId.toString(), {
            scheduledDate: '2026-06-20T08:00:00.000Z',
        }),
    );

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-15T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 5);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-15T08:00:00.000Z',
            '2026-06-16T08:00:00.000Z',
            '2026-06-17T08:00:00.000Z',
            '2026-06-18T08:00:00.000Z',
            '2026-06-19T08:00:00.000Z',
            '2026-06-20T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations does not duplicate existing offer days on repeated sowing', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const firstRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T08:00:00.000Z'),
    });

    const secondRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T12:00:00.000Z'),
    });

    assert.strictEqual(firstRun.length, 3);
    assert.strictEqual(secondRun.length, 0);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations does not mint a second offer later in the same season', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const firstRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-01T08:00:00.000Z'),
    });

    const secondRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-10T08:00:00.000Z'),
    });

    assert.strictEqual(firstRun.length, 5);
    assert.strictEqual(secondRun.length, 0);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-01T08:00:00.000Z',
            '2026-06-02T08:00:00.000Z',
            '2026-06-03T08:00:00.000Z',
            '2026-06-04T08:00:00.000Z',
            '2026-06-05T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations allows a new offer in a later season', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const springRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T08:00:00.000Z'),
    });

    const summerRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-01T08:00:00.000Z'),
    });

    assert.strictEqual(springRun.length, 3);
    assert.strictEqual(summerRun.length, 5);
});

test('offers belong to their originating season when waterings cross a boundary', async () => {
    createTestDb();
    for (const [firstDate, nextDate, firstCount, nextCount] of [
        ['2026-05-31T08:00:00Z', '2026-06-10T08:00:00Z', 3, 5],
        ['2026-08-31T08:00:00Z', '2026-09-10T08:00:00Z', 5, 3],
        ['2026-11-30T08:00:00Z', '2027-03-10T08:00:00Z', 3, 3],
    ] satisfies [string, string, number, number][]) {
        const context = await createSeasonalOfferTestContext();
        assert.equal(
            (
                await queueSeasonalSowingOfferOperations({
                    ...context,
                    referenceDate: new Date(firstDate),
                })
            ).length,
            firstCount,
        );
        assert.equal(
            (
                await queueSeasonalSowingOfferOperations({
                    ...context,
                    referenceDate: new Date(nextDate),
                })
            ).length,
            nextCount,
        );
    }
});

test('the same season in a new year gets a new entitlement', async () => {
    createTestDb();
    const context = await createSeasonalOfferTestContext();
    for (const year of [2026, 2027]) {
        assert.equal(
            (
                await queueSeasonalSowingOfferOperations({
                    ...context,
                    referenceDate: new Date(`${year}-06-10T08:00:00Z`),
                })
            ).length,
            5,
        );
    }
});

test('concurrent sowings grant one complete seasonal batch', async () => {
    createTestDb();
    const context = await createSeasonalOfferTestContext();
    const results = await Promise.all(
        [1, 5, 10, 15].map((day) =>
            queueSeasonalSowingOfferOperations({
                ...context,
                referenceDate: new Date(
                    `2026-06-${day.toString().padStart(2, '0')}T08:00:00Z`,
                ),
            }),
        ),
    );
    assert.equal(results.filter((ids) => ids.length > 0).length, 1);
    assert.equal(results.flat().length, 5);
    assert.equal(
        (
            await getScheduledFreeWateringDates(
                context.accountId,
                context.gardenId,
                context.raisedBedId,
            )
        ).length,
        5,
    );
    const grants = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(
                    events.type,
                    knownEventTypes.raisedBeds.seasonalSowingOfferGranted,
                ),
                eq(events.aggregateId, context.raisedBedId.toString()),
            ),
        );
    assert.equal(grants.length, 1);
});

test('a legacy partial batch fills missing days before the seasonal grant is committed', async () => {
    createTestDb();
    const context = await createSeasonalOfferTestContext();
    const existingId = await createOperation({
        ...context,
        entityId: FREE_WATERING_OPERATION_ID,
        entityTypeName: 'operation',
    });
    await createEvent(
        knownEvents.operations.scheduledV1(existingId.toString(), {
            scheduledDate: '2026-06-16T08:00:00Z',
        }),
    );
    const created = await queueSeasonalSowingOfferOperations({
        ...context,
        referenceDate: new Date('2026-06-15T08:00:00Z'),
    });
    assert.equal(created.length, 4);
    assert.equal(
        (
            await getScheduledFreeWateringDates(
                context.accountId,
                context.gardenId,
                context.raisedBedId,
            )
        ).length,
        5,
    );
    assert.deepEqual(
        await queueSeasonalSowingOfferOperations({
            ...context,
            referenceDate: new Date('2026-07-01T08:00:00Z'),
        }),
        [],
    );
});

test('rescheduling a watering does not move the season that granted its batch', async () => {
    createTestDb();
    const context = await createSeasonalOfferTestContext();
    const ids = await queueSeasonalSowingOfferOperations({
        ...context,
        referenceDate: new Date('2026-03-10T08:00:00Z'),
    });
    for (const id of ids)
        await createEvent(
            knownEvents.operations.scheduledV1(id.toString(), {
                scheduledDate: '2026-06-05T08:00:00Z',
            }),
        );
    assert.deepEqual(
        await queueSeasonalSowingOfferOperations({
            ...context,
            referenceDate: new Date('2026-04-01T08:00:00Z'),
        }),
        [],
    );
    assert.equal(
        (
            await queueSeasonalSowingOfferOperations({
                ...context,
                referenceDate: new Date('2026-06-10T08:00:00Z'),
            })
        ).length,
        5,
    );
});

test('failure after creating the waterings rolls the entire grant back and retry creates a complete batch', async () => {
    createTestDb();
    const context = await createSeasonalOfferTestContext();
    const dropFailure = async () => {
        await storage().execute(
            sql.raw(
                'drop trigger if exists seasonal_offer_failure_test on events',
            ),
        );
        await storage().execute(
            sql.raw('drop function if exists seasonal_offer_failure_test()'),
        );
    };
    await dropFailure();
    await storage().execute(
        sql.raw(`
        create function seasonal_offer_failure_test() returns trigger language plpgsql as $function$
        begin
            if new.type = 'raisedBed.seasonalSowingOffer.granted' then
                raise exception 'injected seasonal offer grant failure';
            end if;
            return new;
        end;
        $function$
    `),
    );
    await storage().execute(
        sql.raw(
            'create trigger seasonal_offer_failure_test before insert on events for each row execute function seasonal_offer_failure_test()',
        ),
    );
    const input = {
        ...context,
        referenceDate: new Date('2026-06-15T08:00:00Z'),
    };
    try {
        await assert.rejects(
            queueSeasonalSowingOfferOperations(input),
            (error: unknown) => {
                assert.ok(error instanceof Error);
                assert.ok(error.cause instanceof Error);
                assert.match(
                    error.cause.message,
                    /injected seasonal offer grant failure/u,
                );
                return true;
            },
        );
    } finally {
        await dropFailure();
    }
    assert.deepEqual(
        await getScheduledFreeWateringDates(
            context.accountId,
            context.gardenId,
            context.raisedBedId,
        ),
        [],
    );
    assert.equal((await queueSeasonalSowingOfferOperations(input)).length, 5);
    assert.deepEqual(
        await queueSeasonalSowingOfferOperations({
            ...context,
            referenceDate: new Date('2026-06-25T08:00:00Z'),
        }),
        [],
    );
});
