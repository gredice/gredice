import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    assignStripeCustomerId,
    createEvent,
    earnSunflowers,
    earnSunflowersForPayment,
    earnSunflowersOnce,
    getAccount,
    getAccounts,
    getAccountUsers,
    getLastBirthdayRewardEvent,
    getSunflowers,
    getSunflowersHistory,
    grantBirthdaySunflowers,
    InsufficientSunflowersError,
    knownEvents,
    knownEventTypes,
    SunflowerEarnAmountConflictError,
    SunflowerSpendAmountConflictError,
    spendSunflowers,
    spendSunflowersBatch,
    sql,
    storage,
    users,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

function createInsertBarrierDb(
    db: ReturnType<typeof createTestDb>,
    releaseAfter: number,
) {
    let waitingInserts = 0;
    let releaseBarrier = () => {};
    const barrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
    });

    return new Proxy(db, {
        get(target, property, receiver) {
            if (property !== 'insert') {
                const value = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }

            return (...insertArgs: unknown[]) => {
                const insertBuilder = Reflect.apply(
                    target.insert,
                    target,
                    insertArgs,
                );

                return new Proxy(insertBuilder, {
                    get(insertTarget, insertProperty, insertReceiver) {
                        if (insertProperty !== 'values') {
                            const value = Reflect.get(
                                insertTarget,
                                insertProperty,
                                insertReceiver,
                            );
                            return typeof value === 'function'
                                ? value.bind(insertTarget)
                                : value;
                        }

                        return (...valuesArgs: unknown[]) => {
                            const valuesBuilder = Reflect.apply(
                                Reflect.get(
                                    insertTarget,
                                    insertProperty,
                                    insertReceiver,
                                ),
                                insertTarget,
                                valuesArgs,
                            );
                            if (
                                !valuesBuilder ||
                                typeof valuesBuilder !== 'object'
                            ) {
                                throw new Error(
                                    'Expected insert values builder.',
                                );
                            }

                            return new Proxy(valuesBuilder, {
                                get(
                                    valuesTarget,
                                    valuesProperty,
                                    valuesReceiver,
                                ) {
                                    if (valuesProperty !== 'returning') {
                                        const value = Reflect.get(
                                            valuesTarget,
                                            valuesProperty,
                                            valuesReceiver,
                                        );
                                        return typeof value === 'function'
                                            ? value.bind(valuesTarget)
                                            : value;
                                    }

                                    return async (
                                        ...returningArgs: unknown[]
                                    ) => {
                                        waitingInserts += 1;
                                        if (waitingInserts === releaseAfter) {
                                            releaseBarrier();
                                        }
                                        await barrier;

                                        return Reflect.apply(
                                            Reflect.get(
                                                valuesTarget,
                                                valuesProperty,
                                                valuesReceiver,
                                            ),
                                            valuesTarget,
                                            returningArgs,
                                        );
                                    };
                                },
                            });
                        };
                    },
                });
            };
        },
    });
}

function legacyCoveredItem(
    item: { amount: number; reason: string },
    createdAt = new Date('2025-01-01T00:00:00.000Z'),
) {
    const cartItemId = Number(item.reason.replace('shoppingCartItem:', ''));
    assert.ok(Number.isSafeInteger(cartItemId) && cartItemId > 0);
    return { ...item, cartItemId, createdAt };
}

test('createAccount creates a new account', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    assert.ok(accountId);
    const account = await getAccount(accountId);
    assert.ok(account);
    assert.strictEqual(account.id, accountId);
});

test('getAccounts returns all accounts', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const accounts = await getAccounts();
    assert.ok(Array.isArray(accounts));
    assert.ok(accounts.some((a) => a.id === accountId));
});

test('getAccount returns undefined for non-existent account', async () => {
    createTestDb();
    const account = await getAccount('non-existent-id');
    assert.strictEqual(account, undefined);
});

test('assignStripeCustomerId sets stripeCustomerId', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripeId = 'cus_test123';
    const updated = await assignStripeCustomerId(accountId, stripeId);
    assert.ok(updated);
    assert.strictEqual(updated.stripeCustomerId, stripeId);
});

test('getAccountUsers returns empty array for new account', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const users = await getAccountUsers(accountId);
    assert.ok(Array.isArray(users));
    assert.strictEqual(users.length, 0);
});

test('getSunflowers returns initial sunflowers after registration', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const sunflowers = await getSunflowers(accountId);
    assert.strictEqual(sunflowers, 1000);
});

test('earnSunflowers increases sunflowers', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await earnSunflowers(accountId, 500, 'bonus');
    const sunflowers = await getSunflowers(accountId);
    assert.strictEqual(sunflowers, 1500);
});

test('earnSunflowersForPayment is source-idempotent under concurrency and rejects amount conflicts', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:payment-retry';

    await Promise.all([
        earnSunflowersForPayment(accountId, 25, source),
        earnSunflowersForPayment(accountId, 25, source),
    ]);

    assert.strictEqual(await getSunflowers(accountId), 1250);
    await assert.rejects(
        earnSunflowersForPayment(accountId, 30, source),
        SunflowerEarnAmountConflictError,
    );
});

test('zero payment reward is a hidden idempotent checkout marker without a balance delta', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:zero-payment-reward';
    const reason = `payment:${source}`;

    await earnSunflowers(accountId, 1, 'zero-marker-history-old');
    await earnSunflowersForPayment(accountId, 0.01, source);
    await earnSunflowersForPayment(accountId, 0.01, source);
    await earnSunflowers(accountId, 2, 'zero-marker-history-new');

    assert.equal(await getSunflowers(accountId), 1003);
    const firstPage = await getSunflowersHistory(accountId, 0, 1);
    const secondPage = await getSunflowersHistory(accountId, 1, 1);
    assert.deepEqual(
        [firstPage[0]?.reason, secondPage[0]?.reason],
        ['zero-marker-history-new', 'zero-marker-history-old'],
    );
    assert.equal(
        [...firstPage, ...secondPage].some((event) => event.reason === reason),
        false,
    );

    const markerEvents = await storage().query.events.findMany({
        where: (event, { and, eq }) =>
            and(
                eq(event.aggregateId, accountId),
                eq(event.type, knownEventTypes.accounts.earnSunflowers),
                sql`${event.data}->>'reason' = ${reason}`,
            ),
    });
    assert.equal(markerEvents.length, 1);
    assert.deepEqual(markerEvents[0]?.data, { amount: 0, reason });

    await assert.rejects(
        earnSunflowersForPayment(accountId, 1, source),
        (error) => {
            assert.ok(error instanceof SunflowerEarnAmountConflictError);
            assert.equal(error.existingAmount, 0);
            assert.equal(error.requestedAmount, 10);
            return true;
        },
    );
    await assert.rejects(
        earnSunflowersOnce(accountId, 0, 'general-zero-reward'),
        /positive integer/,
    );
});

test('payment reward reuses an existing transaction without an inner commit', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:rolled-back-payment-reward';
    const rollback = new Error('roll back payment reward test');

    await assert.rejects(
        storage().transaction(async (tx) => {
            await earnSunflowersForPayment(accountId, 2, source, tx);
            throw rollback;
        }),
        (error) => error === rollback,
    );
    assert.equal(await getSunflowers(accountId), 1000);

    await earnSunflowersForPayment(accountId, 2, source);
    assert.equal(await getSunflowers(accountId), 1020);
});

test('legacy payment reward writes one hidden balance-neutral keyed checkpoint', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:701';
    const reason = `payment:${source}`;
    const options = { legacyRewardAlreadyEarned: true };

    await earnSunflowersForPayment(accountId, 25, source, undefined, options);
    await earnSunflowersForPayment(accountId, 25, source, undefined, options);

    assert.equal(await getSunflowers(accountId), 1000);
    const markerEvents = await storage().query.events.findMany({
        where: (event, { and, eq }) =>
            and(
                eq(event.aggregateId, accountId),
                eq(event.type, knownEventTypes.accounts.earnSunflowers),
                sql`${event.data}->>'reason' = ${reason}`,
            ),
    });
    assert.equal(markerEvents.length, 1);
    assert.deepEqual(markerEvents[0]?.data, {
        amount: 0,
        coveredAmount: 250,
        legacyRewardAlreadyEarned: true,
        reason,
    });
    assert.equal(
        (await getSunflowersHistory(accountId, 0, 20)).some(
            (event) => event.reason === reason,
        ),
        false,
    );

    await assert.rejects(
        earnSunflowersForPayment(accountId, 25, source),
        SunflowerEarnAmountConflictError,
    );
});

test('legacy payment reward accepts an exact existing keyed reward without adding a checkpoint', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:702';
    const reason = `payment:${source}`;

    await earnSunflowersForPayment(accountId, 25, source);
    await earnSunflowersForPayment(accountId, 25, source, undefined, {
        legacyRewardAlreadyEarned: true,
    });

    assert.equal(await getSunflowers(accountId), 1250);
    const rewardEvents = await storage().query.events.findMany({
        where: (event, { and, eq }) =>
            and(
                eq(event.aggregateId, accountId),
                eq(event.type, knownEventTypes.accounts.earnSunflowers),
                sql`${event.data}->>'reason' = ${reason}`,
            ),
    });
    assert.equal(rewardEvents.length, 1);
    assert.deepEqual(rewardEvents[0]?.data, { amount: 250, reason });
});

test('legacy payment reward rejects unrelated zero markers, changed amounts, and duplicate keyed rewards', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const source = 'shoppingCartItem:703';
    const options = { legacyRewardAlreadyEarned: true };

    await earnSunflowersForPayment(accountId, 0.01, source);
    await assert.rejects(
        earnSunflowersForPayment(accountId, 25, source, undefined, options),
        SunflowerEarnAmountConflictError,
    );

    const duplicateSource = 'shoppingCartItem:704';
    const duplicateReason = `payment:${duplicateSource}`;
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, {
            amount: 250,
            reason: duplicateReason,
        }),
    );
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, {
            amount: 250,
            reason: duplicateReason,
        }),
    );
    await assert.rejects(
        earnSunflowersForPayment(
            accountId,
            25,
            duplicateSource,
            undefined,
            options,
        ),
        SunflowerEarnAmountConflictError,
    );

    await assert.rejects(
        earnSunflowersForPayment(accountId, 25, undefined, undefined, options),
        /idempotency key/,
    );
});

test('grantBirthdaySunflowers is idempotent for a user reward year', async () => {
    createTestDb();
    const db = storage();
    const accountId = await createTestAccount();
    const userId = randomUUID();
    const userCreatedAt = new Date(Date.UTC(2026, 4, 1));
    const firstRewardDate = new Date(Date.UTC(2026, 5, 8));
    const laterRewardDate = new Date(Date.UTC(2026, 6, 8));

    await db.insert(users).values({
        id: userId,
        userName: `${userId}@example.com`,
        displayName: 'Birthday Test',
        role: 'user',
        createdAt: userCreatedAt,
        updatedAt: userCreatedAt,
    });
    await db.insert(accountUsers).values({
        accountId,
        userId,
        createdAt: userCreatedAt,
        updatedAt: userCreatedAt,
    });

    const firstGrant = await grantBirthdaySunflowers({
        accountId,
        amount: 9999,
        isLate: false,
        rewardDate: firstRewardDate,
        userId,
    });
    const secondGrant = await grantBirthdaySunflowers({
        accountId,
        amount: 9999,
        isLate: false,
        rewardDate: laterRewardDate,
        userId,
    });

    assert.strictEqual(firstGrant.status, 'created');
    assert.strictEqual(secondGrant.status, 'existing');
    assert.strictEqual(await getSunflowers(accountId), 10999);

    const rewardEvent = await getLastBirthdayRewardEvent(userId);
    assert.ok(rewardEvent);
    assert.strictEqual(rewardEvent.data.accountId, accountId);
    assert.strictEqual(rewardEvent.data.amount, 9999);
    assert.strictEqual(
        rewardEvent.data.rewardDate,
        firstRewardDate.toISOString(),
    );
});

test('spendSunflowers decreases sunflowers', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await spendSunflowers(accountId, 200, 'purchase');
    const sunflowers = await getSunflowers(accountId);
    assert.strictEqual(sunflowers, 800);
});

test('spendSunflowers throws if insufficient sunflowers', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await assert.rejects(
        () => spendSunflowers(accountId, 2000, 'fail'),
        /Insufficient sunflowers/,
    );
});

test('spendSunflowers rejects one concurrent overspend', async () => {
    const db = createInsertBarrierDb(createTestDb(), 2);
    const accountId = await createTestAccount();
    const results = await Promise.allSettled([
        spendSunflowers(accountId, 700, 'concurrent-a', db),
        spendSunflowers(accountId, 700, 'concurrent-b', db),
    ]);

    assert.strictEqual(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof Error);
    assert.strictEqual(rejected[0].reason.message, 'Insufficient sunflowers');

    const sunflowers = await getSunflowers(accountId);
    assert.strictEqual(sunflowers, 300);
});

test('spendSunflowers allows sequential spends', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await spendSunflowers(accountId, 200, 'first-spend');
    await spendSunflowers(accountId, 300, 'second-spend');
    const sunflowers = await getSunflowers(accountId);
    assert.strictEqual(sunflowers, 500);
});

test('spendSunflowersBatch writes one durable debit per item', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const result = await spendSunflowersBatch(accountId, [
        { amount: 200, reason: 'shoppingCartItem:batch-1' },
        { amount: 300, reason: 'shoppingCartItem:batch-2' },
    ]);

    assert.deepStrictEqual(result, {
        createdReasons: [
            'shoppingCartItem:batch-1',
            'shoppingCartItem:batch-2',
        ],
        existingReasons: [],
        resolvedAmountsByReason: {
            'shoppingCartItem:batch-1': 200,
            'shoppingCartItem:batch-2': 300,
        },
    });
    assert.strictEqual(await getSunflowers(accountId), 500);
    const history = await getSunflowersHistory(accountId, 0, 20);
    assert.deepStrictEqual(
        history
            .filter((event) => event.reason?.startsWith('shoppingCartItem:'))
            .map((event) => [event.reason, event.amount])
            .sort(),
        [
            ['shoppingCartItem:batch-1', 200],
            ['shoppingCartItem:batch-2', 300],
        ],
    );
});

test('spendSunflowersBatch validates the full debit before writing', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    await assert.rejects(
        () =>
            spendSunflowersBatch(accountId, [
                { amount: 700, reason: 'shoppingCartItem:no-partial-1' },
                { amount: 400, reason: 'shoppingCartItem:no-partial-2' },
            ]),
        InsufficientSunflowersError,
    );

    assert.strictEqual(await getSunflowers(accountId), 1000);
    const history = await getSunflowersHistory(accountId, 0, 20);
    assert.ok(
        history.every(
            (event) =>
                event.reason !== 'shoppingCartItem:no-partial-1' &&
                event.reason !== 'shoppingCartItem:no-partial-2',
        ),
    );
});

test('spendSunflowersBatch treats an identical retry as already spent', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const debit = {
        amount: 250,
        reason: 'shoppingCartItem:identical-retry',
    };

    const first = await spendSunflowersBatch(accountId, [debit]);
    const retry = await spendSunflowersBatch(accountId, [debit]);

    assert.deepStrictEqual(first, {
        createdReasons: [debit.reason],
        existingReasons: [],
        resolvedAmountsByReason: { [debit.reason]: debit.amount },
    });
    assert.deepStrictEqual(retry, {
        createdReasons: [],
        existingReasons: [debit.reason],
        resolvedAmountsByReason: { [debit.reason]: debit.amount },
    });
    assert.strictEqual(await getSunflowers(accountId), 750);
});

test('spendSunflowersBatch rejects a retry with a changed amount', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const reason = 'shoppingCartItem:amount-conflict';
    await spendSunflowersBatch(accountId, [{ amount: 200, reason }]);

    await assert.rejects(
        () => spendSunflowersBatch(accountId, [{ amount: 300, reason }]),
        (error) => {
            assert.ok(error instanceof SunflowerSpendAmountConflictError);
            assert.strictEqual(error.reason, reason);
            assert.strictEqual(error.existingAmount, 200);
            assert.strictEqual(error.requestedAmount, 300);
            return true;
        },
    );
    assert.strictEqual(await getSunflowers(accountId), 800);
});

test('spendSunflowersBatch fails closed on duplicate stored events even when amounts match', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const debit = { amount: 200, reason: 'shoppingCartItem:801' };
    await createEvent(knownEvents.accounts.sunflowersSpentV1(accountId, debit));
    await createEvent(knownEvents.accounts.sunflowersSpentV1(accountId, debit));

    await assert.rejects(spendSunflowersBatch(accountId, [debit]), (error) => {
        assert.ok(error instanceof SunflowerSpendAmountConflictError);
        assert.equal(error.reason, debit.reason);
        assert.equal(error.existingAmount, debit.amount);
        assert.equal(error.requestedAmount, debit.amount);
        return true;
    });
});

test('checkout replay can resolve a unique stored per-item amount across catalog drift', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const reason = 'shoppingCartItem:802';
    await spendSunflowersBatch(accountId, [{ amount: 200, reason }]);

    const replay = await spendSunflowersBatch(
        accountId,
        [{ amount: 300, reason }],
        undefined,
        { existingCheckoutItemAmountsAreAuthoritative: true },
    );

    assert.deepEqual(replay, {
        createdReasons: [],
        existingReasons: [reason],
        resolvedAmountsByReason: { [reason]: 200 },
    });
    assert.equal(await getSunflowers(accountId), 800);

    await assert.rejects(
        spendSunflowersBatch(
            accountId,
            [{ amount: 1, reason: 'not-a-checkout-item' }],
            undefined,
            { existingCheckoutItemAmountsAreAuthoritative: true },
        ),
        /shoppingCartItem:<id>/,
    );
});

test('legacy cart debit creates hidden per-item checkpoints only for pending covered items', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const legacyCartReason = 'shoppingCart:901';
    const firstItem = { amount: 200, reason: 'shoppingCartItem:9011' };
    const secondItem = { amount: 300, reason: 'shoppingCartItem:9012' };
    const alreadyPaidItem = {
        amount: 100,
        reason: 'shoppingCartItem:9013',
    };
    const coveredItems = [firstItem, secondItem, alreadyPaidItem].map((item) =>
        legacyCoveredItem(item),
    );
    const options = {
        legacyCartSpend: { reason: legacyCartReason, coveredItems },
    };
    await earnSunflowers(accountId, 1, 'legacy-history-old');
    await spendSunflowers(accountId, 600, legacyCartReason);

    const firstReplay = await spendSunflowersBatch(
        accountId,
        [firstItem, secondItem],
        undefined,
        options,
    );
    assert.deepEqual(firstReplay, {
        createdReasons: [firstItem.reason, secondItem.reason],
        existingReasons: [],
        resolvedAmountsByReason: {
            [firstItem.reason]: firstItem.amount,
            [secondItem.reason]: secondItem.amount,
        },
    });
    assert.equal(await getSunflowers(accountId), 401);

    const firstCheckpointEvents = await storage().query.events.findMany({
        where: (event, { and, eq, inArray }) =>
            and(
                eq(event.aggregateId, accountId),
                eq(event.type, knownEventTypes.accounts.spendSunflowers),
                inArray(sql<string>`${event.data}->>'reason'`, [
                    firstItem.reason,
                    secondItem.reason,
                    alreadyPaidItem.reason,
                ]),
            ),
    });
    const checkpointDataForReason = (reason: string) =>
        firstCheckpointEvents.find((event) => {
            const data = event.data;
            return (
                typeof data === 'object' &&
                data !== null &&
                'reason' in data &&
                data.reason === reason
            );
        })?.data;
    assert.deepEqual(checkpointDataForReason(firstItem.reason), {
        amount: 0,
        coveredAmount: firstItem.amount,
        legacyCartReason,
        reason: firstItem.reason,
    });
    assert.deepEqual(checkpointDataForReason(secondItem.reason), {
        amount: 0,
        coveredAmount: secondItem.amount,
        legacyCartReason,
        reason: secondItem.reason,
    });
    assert.equal(firstCheckpointEvents.length, 2);

    const driftedSecondItem = { ...secondItem, amount: 350 };
    const retry = await spendSunflowersBatch(
        accountId,
        [driftedSecondItem],
        undefined,
        {
            legacyCartSpend: {
                reason: legacyCartReason,
                coveredItems: [
                    firstItem,
                    driftedSecondItem,
                    alreadyPaidItem,
                ].map((item) => legacyCoveredItem(item)),
            },
        },
    );
    assert.deepEqual(retry, {
        createdReasons: [],
        existingReasons: [secondItem.reason],
        resolvedAmountsByReason: {
            [secondItem.reason]: secondItem.amount,
        },
    });

    const finalPendingItem = await spendSunflowersBatch(
        accountId,
        [alreadyPaidItem],
        undefined,
        options,
    );
    assert.deepEqual(finalPendingItem.createdReasons, [alreadyPaidItem.reason]);
    assert.equal(await getSunflowers(accountId), 401);

    await earnSunflowers(accountId, 2, 'legacy-history-new');
    const firstHistoryPage = await getSunflowersHistory(accountId, 0, 1);
    const secondHistoryPage = await getSunflowersHistory(accountId, 1, 1);
    assert.deepEqual(
        [firstHistoryPage[0]?.reason, secondHistoryPage[0]?.reason],
        ['legacy-history-new', legacyCartReason],
    );
});

test('legacy cart debit rejects wrong totals, duplicate history, positive per-item overlap, and orphan checkpoints', async () => {
    createTestDb();
    const wrongTotalAccountId = await createTestAccount();
    const legacyCartReason = 'shoppingCart:902';
    const item = { amount: 200, reason: 'shoppingCartItem:9021' };
    await spendSunflowers(wrongTotalAccountId, 300, legacyCartReason);
    await assert.rejects(
        spendSunflowersBatch(wrongTotalAccountId, [item], undefined, {
            legacyCartSpend: {
                reason: legacyCartReason,
                coveredItems: [legacyCoveredItem(item)],
            },
        }),
        SunflowerSpendAmountConflictError,
    );
    await assert.rejects(
        spendSunflowersBatch(wrongTotalAccountId, [item], undefined, {
            legacyCartSpend: {
                reason: legacyCartReason,
                coveredItems: [],
            },
        }),
        /requires covered items/,
    );

    const duplicateAccountId = await createTestAccount();
    const duplicateLegacyReason = 'shoppingCart:903';
    const duplicateItem = {
        amount: 200,
        reason: 'shoppingCartItem:9031',
    };
    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(duplicateAccountId, {
            amount: 200,
            reason: duplicateLegacyReason,
        }),
    );
    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(duplicateAccountId, {
            amount: 200,
            reason: duplicateLegacyReason,
        }),
    );
    await assert.rejects(
        spendSunflowersBatch(duplicateAccountId, [duplicateItem], undefined, {
            legacyCartSpend: {
                reason: duplicateLegacyReason,
                coveredItems: [legacyCoveredItem(duplicateItem)],
            },
        }),
        SunflowerSpendAmountConflictError,
    );

    const overlapAccountId = await createTestAccount();
    const overlapLegacyReason = 'shoppingCart:904';
    const overlapItem = {
        amount: 200,
        reason: 'shoppingCartItem:9041',
    };
    await spendSunflowers(overlapAccountId, 200, overlapLegacyReason);
    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(overlapAccountId, overlapItem),
    );
    await assert.rejects(
        spendSunflowersBatch(overlapAccountId, [overlapItem], undefined, {
            legacyCartSpend: {
                reason: overlapLegacyReason,
                coveredItems: [legacyCoveredItem(overlapItem)],
            },
        }),
        SunflowerSpendAmountConflictError,
    );

    const orphanAccountId = await createTestAccount();
    const orphanLegacyReason = 'shoppingCart:905';
    const orphanItem = {
        amount: 200,
        reason: 'shoppingCartItem:9051',
    };
    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(orphanAccountId, {
            amount: 0,
            coveredAmount: orphanItem.amount,
            legacyCartReason: orphanLegacyReason,
            reason: orphanItem.reason,
        }),
    );
    await assert.rejects(
        spendSunflowersBatch(orphanAccountId, [orphanItem], undefined, {
            legacyCartSpend: {
                reason: orphanLegacyReason,
                coveredItems: [legacyCoveredItem(orphanItem)],
            },
        }),
        SunflowerSpendAmountConflictError,
    );

    const laterItemAccountId = await createTestAccount();
    const laterItemLegacyReason = 'shoppingCart:906';
    const laterItem = {
        amount: 200,
        reason: 'shoppingCartItem:9061',
    };
    await spendSunflowers(laterItemAccountId, 200, laterItemLegacyReason);
    await assert.rejects(
        spendSunflowersBatch(laterItemAccountId, [laterItem], undefined, {
            legacyCartSpend: {
                reason: laterItemLegacyReason,
                coveredItems: [
                    legacyCoveredItem(
                        laterItem,
                        new Date('2100-01-01T00:00:00.000Z'),
                    ),
                ],
            },
        }),
        /created after the cart debit/,
    );

    await assert.rejects(
        spendSunflowersBatch(laterItemAccountId, [laterItem], undefined, {
            legacyCartSpend: {
                reason: laterItemLegacyReason,
                coveredItems: [
                    {
                        ...legacyCoveredItem(laterItem),
                        cartItemId: 9999,
                    },
                ],
            },
        }),
        /reason must match its cart item ID/,
    );
});

test('general sunflower earn and spend APIs reject zero amounts', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    await assert.rejects(
        earnSunflowers(accountId, 0, 'invalid-zero-earn'),
        /positive integer/,
    );
    await assert.rejects(
        spendSunflowers(accountId, 0, 'invalid-zero-spend'),
        /positive integer/,
    );
    assert.equal(await getSunflowers(accountId), 1000);
});

test('spendSunflowersBatch serializes concurrent identical retries', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const debit = {
        amount: 400,
        reason: 'shoppingCartItem:concurrent-retry',
    };

    const results = await Promise.all([
        spendSunflowersBatch(accountId, [debit]),
        spendSunflowersBatch(accountId, [debit]),
    ]);

    assert.strictEqual(
        results.reduce(
            (count, result) => count + result.createdReasons.length,
            0,
        ),
        1,
    );
    assert.strictEqual(await getSunflowers(accountId), 600);
});

test('getSunflowersHistory returns correct history', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await earnSunflowers(accountId, 100, 'test-earn');
    await spendSunflowers(accountId, 50, 'test-spend');
    const history = await getSunflowersHistory(accountId, 0, 10);
    assert.ok(Array.isArray(history));
    assert.ok(history.some((e) => e.reason === 'test-earn'));
    assert.ok(history.some((e) => e.reason === 'test-spend'));
});

test('getSunflowersHistory returns newest events first when limited', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await earnSunflowers(accountId, 1, 'history-old');
    await earnSunflowers(accountId, 2, 'history-middle');
    await earnSunflowers(accountId, 3, 'history-newest');

    const firstPage = await getSunflowersHistory(accountId, 0, 2);
    assert.deepStrictEqual(
        firstPage.map((event) => event.reason),
        ['history-newest', 'history-middle'],
    );

    const secondPage = await getSunflowersHistory(accountId, 2, 1);
    assert.deepStrictEqual(
        secondPage.map((event) => event.reason),
        ['history-old'],
    );
});
