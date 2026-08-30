import assert from 'node:assert/strict';
import test from 'node:test';
import {
    accounts,
    createAccount,
    getAccount,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

test('sunflower account transactions serialize one account aggregate', async () => {
    createTestDb();
    const accountId = await createAccount();
    const events: string[] = [];
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    let firstDidStart = () => {};
    const firstStarted = new Promise<void>((resolve) => {
        firstDidStart = resolve;
    });

    const first = withSunflowerAccountTransaction(accountId, async () => {
        events.push('first-start');
        firstDidStart();
        await firstMayFinish;
        events.push('first-end');
    });
    await firstStarted;
    const second = withSunflowerAccountTransaction(accountId, async () => {
        events.push('second-start');
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(events, ['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
});

test('sunflower account transactions roll back their shared transaction', async () => {
    createTestDb();
    const accountId = await createAccount();
    const before = await getAccount(accountId);
    assert.ok(before);

    await assert.rejects(
        withSunflowerAccountTransaction(accountId, async (transaction) => {
            await transaction
                .update(accounts)
                .set({ name: 'Uncommitted account name' })
                .where(eq(accounts.id, accountId));
            throw new Error('reject currency command');
        }),
        /reject currency command/u,
    );

    const after = await getAccount(accountId);
    assert.equal(after?.name, before.name);
});

test('sunflower account transactions reject blank account identifiers', async () => {
    await assert.rejects(
        withSunflowerAccountTransaction('  ', async () => undefined),
        /requires an account ID/u,
    );
});
