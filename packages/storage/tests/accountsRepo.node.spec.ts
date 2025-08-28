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
