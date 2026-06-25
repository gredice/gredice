import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assignStripeCustomerId,
    earnSunflowers,
    getAccount,
    getAccounts,
    getAccountUsers,
    getSunflowers,
    getSunflowersHistory,
    spendSunflowers,
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
