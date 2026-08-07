import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    AccountDeletionInProgressError,
    accountDeletionStartedEventType,
    accounts,
    deleteAccountWithDependencies,
    events,
    fenceAccountShoppingCartsForDeletion,
    getOrCreateShoppingCart,
    getShoppingCart,
    storage,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
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
