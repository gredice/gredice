import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    clearUsedReferralCodeForAccount,
    getAccountReferralState,
    getSunflowers,
    processReferralRewardsForAccount,
    REFERRAL_REWARD_AMOUNT,
    ReferralCodeAlreadyUsedError,
    ReferralCodeReciprocalUseError,
    ReferralCodeReservedError,
    redeemReferralCodeForAccount,
    setReferralCodeForAccount,
    storage,
    updateRaisedBed,
    users,
} from '@gredice/storage';
import {
    createTestAccount,
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createRaisedBedForAccount(accountId: string) {
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, `referral-${accountId}`);
    return await createTestRaisedBed(gardenId, accountId, blockId);
}

async function assignTestUserToAccount({
    accountId,
    avatarUrl,
    displayName,
    userName,
}: {
    accountId: string;
    avatarUrl?: string | null;
    displayName?: string | null;
    userName: string;
}) {
    const userId = randomUUID();
    await storage().insert(users).values({
        id: userId,
        userName,
        displayName,
        avatarUrl,
        role: 'user',
    });
    await storage().insert(accountUsers).values({
        accountId,
        userId,
    });
    return userId;
}

function expectedReferredAccount(
    accountId: string,
    rewarded: boolean,
    account: {
        displayName?: string;
        avatarUrl?: string | null;
    } = {},
) {
    return {
        accountId,
        account: {
            id: accountId,
            displayName: account.displayName ?? 'Gredice račun',
            avatarUrl: account.avatarUrl ?? null,
        },
        rewarded,
    };
}

test('account referral state respects cleared used codes', async () => {
    createTestDb();
    const ownerAccountId = await createTestAccount();
    const nextOwnerAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const ownerCode = `owner-${ownerAccountId.slice(0, 8)}`;
    const nextOwnerCode = `next-${nextOwnerAccountId.slice(0, 8)}`;
    const referredDisplayName = 'Farmernčić';
    const referredAvatarUrl = 'https://cdn.gredice.com/avatar/farmer.png';

    await assignTestUserToAccount({
        accountId: referredAccountId,
        userName: 'farmer@example.com',
        displayName: referredDisplayName,
        avatarUrl: referredAvatarUrl,
    });

    await setReferralCodeForAccount(ownerAccountId, ownerCode, {
        source: 'admin',
    });
    await setReferralCodeForAccount(nextOwnerAccountId, nextOwnerCode, {
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
        expectedReferredAccount(referredAccountId, false, {
            displayName: referredDisplayName,
            avatarUrl: referredAvatarUrl,
        }),
    ]);

    await redeemReferralCodeForAccount(referredAccountId, nextOwnerCode);
    const changedReferredState =
        await getAccountReferralState(referredAccountId);
    assert.strictEqual(changedReferredState.usedReferralCode, nextOwnerCode);
    assert.strictEqual(
        changedReferredState.usedReferralOwnerAccountId,
        nextOwnerAccountId,
    );
    assert.deepStrictEqual(
        (await getAccountReferralState(ownerAccountId)).referredAccounts,
        [],
    );

    const clearedReferral =
        await clearUsedReferralCodeForAccount(referredAccountId);
    assert.strictEqual(clearedReferral?.code, nextOwnerCode);

    const clearedReferredState =
        await getAccountReferralState(referredAccountId);
    assert.strictEqual(clearedReferredState.usedReferralCode, null);
    assert.strictEqual(clearedReferredState.usedReferral, null);

    const clearedOwnerState = await getAccountReferralState(ownerAccountId);
    assert.deepStrictEqual(clearedOwnerState.referredAccounts, []);

    await redeemReferralCodeForAccount(referredAccountId, nextOwnerCode);
    const reusedState = await getAccountReferralState(referredAccountId);
    assert.strictEqual(reusedState.usedReferralCode, nextOwnerCode);
});

test('setReferralCodeForAccount rejects account id prefix codes', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    await assert.rejects(
        () => setReferralCodeForAccount(accountId, accountId.slice(0, 12)),
        ReferralCodeReservedError,
    );
});

test('redeeming a referral code rejects reciprocal account referrals', async () => {
    createTestDb();
    const firstAccountId = await createTestAccount();
    const secondAccountId = await createTestAccount();
    const firstCode = `first-${firstAccountId.slice(0, 8)}`;
    const secondCode = `second-${secondAccountId.slice(0, 8)}`;

    await setReferralCodeForAccount(firstAccountId, firstCode, {
        source: 'admin',
    });
    await setReferralCodeForAccount(secondAccountId, secondCode, {
        source: 'admin',
    });

    await redeemReferralCodeForAccount(secondAccountId, firstCode);

    await assert.rejects(
        () => redeemReferralCodeForAccount(firstAccountId, secondCode),
        ReferralCodeReciprocalUseError,
    );

    const firstState = await getAccountReferralState(firstAccountId);
    assert.strictEqual(firstState.usedReferral, null);

    const secondState = await getAccountReferralState(secondAccountId);
    assert.strictEqual(secondState.usedReferralCode, firstCode);
    assert.deepStrictEqual(firstState.referredAccounts, [
        expectedReferredAccount(secondAccountId, false),
    ]);
});

test('redeeming a referral code rewards both accounts when referred account is already active', async () => {
    createTestDb();
    const ownerAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const raisedBedId = await createRaisedBedForAccount(referredAccountId);
    const ownerCode = `active-${ownerAccountId.slice(0, 8)}`;

    await updateRaisedBed({ id: raisedBedId, status: 'active' });
    await setReferralCodeForAccount(ownerAccountId, ownerCode, {
        source: 'admin',
    });

    const ownerSunflowersBefore = await getSunflowers(ownerAccountId);
    const referredSunflowersBefore = await getSunflowers(referredAccountId);
    const result = await redeemReferralCodeForAccount(
        referredAccountId,
        ownerCode,
    );

    assert.deepStrictEqual(result.reward, {
        rewarded: true,
        accountId: referredAccountId,
        ownerAccountId,
        amount: REFERRAL_REWARD_AMOUNT,
    });
    assert.strictEqual(
        await getSunflowers(ownerAccountId),
        ownerSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );
    assert.strictEqual(
        await getSunflowers(referredAccountId),
        referredSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );

    const ownerState = await getAccountReferralState(ownerAccountId);
    assert.deepStrictEqual(ownerState.referredAccounts, [
        expectedReferredAccount(referredAccountId, true),
    ]);
});

test('pending referral is rewarded when referred account first becomes active', async () => {
    createTestDb();
    const ownerAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const raisedBedId = await createRaisedBedForAccount(referredAccountId);
    const ownerCode = `later-${ownerAccountId.slice(0, 8)}`;

    await setReferralCodeForAccount(ownerAccountId, ownerCode, {
        source: 'admin',
    });
    const redeemResult = await redeemReferralCodeForAccount(
        referredAccountId,
        ownerCode,
    );
    assert.deepStrictEqual(redeemResult.reward, {
        rewarded: false,
        reason: 'inactive_raised_bed',
    });

    const ownerSunflowersBefore = await getSunflowers(ownerAccountId);
    const referredSunflowersBefore = await getSunflowers(referredAccountId);

    await updateRaisedBed({ id: raisedBedId, status: 'active' });

    assert.strictEqual(
        await getSunflowers(ownerAccountId),
        ownerSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );
    assert.strictEqual(
        await getSunflowers(referredAccountId),
        referredSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );

    const duplicateResult =
        await processReferralRewardsForAccount(referredAccountId);
    assert.deepStrictEqual(duplicateResult, {
        rewarded: false,
        reason: 'already_rewarded',
    });
    assert.strictEqual(
        await getSunflowers(ownerAccountId),
        ownerSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );
    assert.strictEqual(
        await getSunflowers(referredAccountId),
        referredSunflowersBefore + REFERRAL_REWARD_AMOUNT,
    );
});

test('rewarded referral codes cannot be changed by the referred account', async () => {
    createTestDb();
    const ownerAccountId = await createTestAccount();
    const nextOwnerAccountId = await createTestAccount();
    const referredAccountId = await createTestAccount();
    const raisedBedId = await createRaisedBedForAccount(referredAccountId);
    const ownerCode = `locked-${ownerAccountId.slice(0, 8)}`;
    const nextOwnerCode = `locked-next-${nextOwnerAccountId.slice(0, 8)}`;

    await updateRaisedBed({ id: raisedBedId, status: 'active' });
    await setReferralCodeForAccount(ownerAccountId, ownerCode, {
        source: 'admin',
    });
    await setReferralCodeForAccount(nextOwnerAccountId, nextOwnerCode, {
        source: 'admin',
    });

    await redeemReferralCodeForAccount(referredAccountId, ownerCode);
    const rewardedState = await getAccountReferralState(referredAccountId);
    assert.strictEqual(rewardedState.usedReferral?.rewarded, true);

    await assert.rejects(
        () => redeemReferralCodeForAccount(referredAccountId, nextOwnerCode),
        ReferralCodeAlreadyUsedError,
    );
    assert.strictEqual(
        (await getAccountReferralState(referredAccountId)).usedReferralCode,
        ownerCode,
    );
});
