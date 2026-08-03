import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    assignStripeCustomerId,
    earnSunflowers,
    getAccount,
    getAccounts,
    getAccountUsers,
    getLastBirthdayRewardEvent,
    getSunflowers,
    getSunflowersHistory,
    grantBirthdaySunflowers,
    InsufficientSunflowersError,
    SunflowerSpendAmountConflictError,
    spendSunflowers,
    spendSunflowersBatch,
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
    });
    assert.deepStrictEqual(retry, {
        createdReasons: [],
        existingReasons: [debit.reason],
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
