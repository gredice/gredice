import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ACCOUNT_REFERRAL_EVENT_TYPE,
    assignStripeCustomerId,
    createEvent,
    earnSunflowers,
    getAccount,
    getAccountReferralDetails,
    getAccounts,
    getAccountUsers,
    getReferralCodeOwnerAccountId,
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

test('getAccountReferralDetails returns default own code', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const details = await getAccountReferralDetails(accountId);
    assert.strictEqual(details.myCode, accountId.slice(0, 12));
    assert.strictEqual(details.usedReferralCode, null);
    assert.strictEqual(details.usedReferralSourceAccountId, null);
    assert.deepStrictEqual(details.referredAccounts, []);
});

test('getAccountReferralDetails resolves used referral source account', async () => {
    createTestDb();
    const sourceAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const sourceCode = `source-code-${sourceAccountId.slice(0, 8)}`;

    await createEvent({
        type: ACCOUNT_REFERRAL_EVENT_TYPE,
        version: 1,
        aggregateId: sourceAccountId,
        data: { action: 'code_set', code: sourceCode },
    });
    await createEvent({
        type: ACCOUNT_REFERRAL_EVENT_TYPE,
        version: 1,
        aggregateId: referredAccountId,
        data: { action: 'used_code', code: sourceCode },
    });

    const details = await getAccountReferralDetails(referredAccountId, {
        includeUsedReferralSource: true,
    });
    assert.strictEqual(details.usedReferralCode, sourceCode);
    assert.strictEqual(details.usedReferralSourceAccountId, sourceAccountId);
    assert.strictEqual(
        await getReferralCodeOwnerAccountId(sourceCode),
        sourceAccountId,
    );
});

test('getAccountReferralDetails resolves used referral source at time of use', async () => {
    createTestDb();
    const sourceAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const sourceCode = `source-code-${sourceAccountId.slice(0, 8)}`;

    await createEvent({
        type: ACCOUNT_REFERRAL_EVENT_TYPE,
        version: 1,
        aggregateId: sourceAccountId,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        data: { action: 'code_set', code: sourceCode },
    });
    await createEvent({
        type: ACCOUNT_REFERRAL_EVENT_TYPE,
        version: 1,
        aggregateId: referredAccountId,
        createdAt: new Date('2030-01-02T00:00:00.000Z'),
        data: { action: 'used_code', code: sourceCode },
    });
    await createEvent({
        type: ACCOUNT_REFERRAL_EVENT_TYPE,
        version: 1,
        aggregateId: sourceAccountId,
        createdAt: new Date('2030-01-03T00:00:00.000Z'),
        data: { action: 'code_set', code: 'new-source-code' },
    });

    const details = await getAccountReferralDetails(referredAccountId, {
        includeUsedReferralSource: true,
    });
    assert.strictEqual(details.usedReferralCode, sourceCode);
    assert.strictEqual(details.usedReferralSourceAccountId, sourceAccountId);
    assert.strictEqual(await getReferralCodeOwnerAccountId(sourceCode), null);
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
