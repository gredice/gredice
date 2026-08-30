import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    accountDeletionStartedEventType,
    accounts,
    createAccount,
    createGardenBlock,
    deleteAccountWithDependencies,
    events,
    fenceAccountShoppingCartsForDeletion,
    getAccount,
    getOrCreateShoppingCart,
    getShoppingCart,
    markAccountDeletionStarted,
    raisedBeds,
    softDeleteNewRaisedBedOnce,
    storage,
    withAccountDeletionFenceTransaction,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
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
