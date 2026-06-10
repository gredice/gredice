import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createTransaction,
    deleteTransaction,
    getAllTransactions,
    getCompletedTransactionByStripePaymentId,
    getTransaction,
    getTransactionByStripeId,
    type InsertTransaction,
    updateTransaction,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function baseTransaction(): Promise<InsertTransaction> {
    return {
        accountId: await createTestAccount(),
        amount: 100,
        currency: 'eur',
        status: 'pending',
        stripePaymentId: 'stripe-123',
    };
}

test('createTransaction and getTransaction', async () => {
    createTestDb();
    const transaction = await baseTransaction();
    const txId = await createTransaction(transaction);
    const tx = await getTransaction(txId);
    assert.ok(tx);
    assert.strictEqual(tx.id, txId);
    assert.strictEqual(tx.accountId, transaction.accountId);
    assert.strictEqual(tx.amount, transaction.amount);
    assert.strictEqual(tx.currency, transaction.currency);
    assert.strictEqual(tx.status, transaction.status);
});

test('createTransaction throws when accountId is missing', async () => {
    createTestDb();
    await assert.rejects(
        () =>
            createTransaction({
                amount: 100,
                currency: 'eur',
                status: 'pending',
                stripePaymentId: 'stripe-without-account',
            }),
        /Transaction must have an accountId/,
    );
});

test('getAllTransactions with account filter returns transactions for account', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const otherAccountId = await createTestAccount();
    const txId = await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'pending',
        stripePaymentId: randomUUID(),
    });
    const otherTxId = await createTransaction({
        accountId: otherAccountId,
        amount: 200,
        currency: 'eur',
        status: 'pending',
        stripePaymentId: randomUUID(),
    });
    const txs = await getAllTransactions({
        filter: { accountId },
    });
    assert.ok(Array.isArray(txs));
    assert.ok(txs.some((t) => t.id === txId));
    assert.ok(!txs.some((t) => t.id === otherTxId));
});

test('getAllTransactions returns all transactions', async () => {
    createTestDb();
    const txId = await createTransaction(await baseTransaction());
    const txs = await getAllTransactions();
    assert.ok(Array.isArray(txs));
    assert.ok(txs.some((t) => t.id === txId));
});

test('updateTransaction updates status', async () => {
    createTestDb();
    const txId = await createTransaction(await baseTransaction());
    await updateTransaction({ id: txId, status: 'completed' });
    const tx = await getTransaction(txId);
    assert.ok(tx);
    assert.strictEqual(tx?.status, 'completed');
});

test('deleteTransaction removes transaction', async () => {
    createTestDb();
    const txId = await createTransaction(await baseTransaction());
    await deleteTransaction(txId);
    const tx = await getTransaction(txId);
    assert.strictEqual(tx, undefined);
});

test('getTransactionByStripeId returns correct transaction', async () => {
    createTestDb();
    const stripePaymentId = randomUUID();
    const txId = await createTransaction({
        ...(await baseTransaction()),
        stripePaymentId: stripePaymentId,
    });
    const tx = await getTransactionByStripeId(stripePaymentId);
    assert.ok(tx);
    assert.strictEqual(tx?.id, txId);
});

test('getCompletedTransactionByStripePaymentId returns only completed transactions', async () => {
    createTestDb();
    const completedStripePaymentId = randomUUID();
    const pendingStripePaymentId = randomUUID();
    const completedTxId = await createTransaction({
        ...(await baseTransaction()),
        status: 'completed',
        stripePaymentId: completedStripePaymentId,
    });
    await createTransaction({
        ...(await baseTransaction()),
        status: 'pending',
        stripePaymentId: pendingStripePaymentId,
    });

    const completedTx = await getCompletedTransactionByStripePaymentId(
        completedStripePaymentId,
    );
    const pendingTx = await getCompletedTransactionByStripePaymentId(
        pendingStripePaymentId,
    );

    assert.ok(completedTx);
    assert.strictEqual(completedTx.id, completedTxId);
    assert.strictEqual(pendingTx, undefined);
});

test('createTransaction returns the existing row for the same completed stripePaymentId', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const transaction = {
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    };

    const firstTxId = await createTransaction(transaction);
    const secondTxId = await createTransaction(transaction);

    const txs = await getAllTransactions({ filter: { accountId } });
    // Documents post-003 idempotency for re-delivered Stripe checkout sessions.
    assert.strictEqual(secondTxId, firstTxId);
    assert.strictEqual(txs.length, 1);
    assert.ok(txs.every((tx) => tx.stripePaymentId === stripePaymentId));
    const completedTx =
        await getCompletedTransactionByStripePaymentId(stripePaymentId);
    assert.ok(completedTx);
    assert.strictEqual(completedTx.id, firstTxId);
});
