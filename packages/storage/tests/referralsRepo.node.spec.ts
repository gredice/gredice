import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearUsedReferralCodeForAccount,
    getAccountReferralState,
    ReferralCodeAlreadyUsedError,
    ReferralCodeReservedError,
    redeemReferralCodeForAccount,
    setReferralCodeForAccount,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('account referral state respects cleared used codes', async () => {
    createTestDb();
    const ownerAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const ownerCode = `owner-${ownerAccountId.slice(0, 8)}`;

    await setReferralCodeForAccount(ownerAccountId, ownerCode, {
        source: 'admin',
    });
    await redeemReferralCodeForAccount(referredAccountId, ownerCode);

    const referredState = await getAccountReferralState(referredAccountId);
    assert.strictEqual(referredState.usedReferralCode, ownerCode);
    assert.strictEqual(
        referredState.usedReferralOwnerAccountId,
        ownerAccountId,
    );

    const ownerState = await getAccountReferralState(ownerAccountId);
    assert.deepStrictEqual(ownerState.referredAccounts, [
        { accountId: referredAccountId, rewarded: false },
    ]);

    await assert.rejects(
        () => redeemReferralCodeForAccount(referredAccountId, ownerCode),
        ReferralCodeAlreadyUsedError,
    );

    const clearedReferral =
        await clearUsedReferralCodeForAccount(referredAccountId);
    assert.strictEqual(clearedReferral?.code, ownerCode);

    const clearedReferredState =
        await getAccountReferralState(referredAccountId);
    assert.strictEqual(clearedReferredState.usedReferralCode, null);
    assert.strictEqual(clearedReferredState.usedReferral, null);

    const clearedOwnerState = await getAccountReferralState(ownerAccountId);
    assert.deepStrictEqual(clearedOwnerState.referredAccounts, []);

    await redeemReferralCodeForAccount(referredAccountId, ownerCode);
    const reusedState = await getAccountReferralState(referredAccountId);
    assert.strictEqual(reusedState.usedReferralCode, ownerCode);
});

test('setReferralCodeForAccount rejects account id prefix codes', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    await assert.rejects(
        () => setReferralCodeForAccount(accountId, accountId.slice(0, 12)),
        ReferralCodeReservedError,
    );
});
