import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import {
    createTransaction,
    getTransaction,
    getTransactions,
    getAllTransactions,
    getTransactionByStripeId,
    updateTransaction,
    deleteTransaction,
    InsertTransaction
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { randomUUID } from 'node:crypto';

async function baseTransaction(): Promise<InsertTransaction> {
    return {
        accountId: await createTestAccount(),
        amount: 100,
        currency: 'EUR',
        status: 'pending',
        stripePaymentId: 'stripe-123'
    };
}

test('createTransaction and getTransaction', async () => {
    createTestDb();
    const txId = await createTransaction(await baseTransaction());
    const tx = await getTransaction(txId);
    assert.ok(tx);
    assert.strictEqual(tx.id, txId);
});

test('getTransactions returns transactions for account', async () => {
    createTestDb();
    const transaction = await baseTransaction()
    const txId = await createTransaction(transaction);
    const txs = await getTransactions(transaction.accountId);
    assert.ok(Array.isArray(txs));
    assert.ok(txs.some(t => t.id === txId));
});

test('getAllTransactions returns all transactions', async () => {
    createTestDb();
    const txId = await createTransaction(await baseTransaction());
    const txs = await getAllTransactions();
    assert.ok(Array.isArray(txs));
    assert.ok(txs.some(t => t.id === txId));
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
    const txId = await createTransaction({ ...await baseTransaction(), stripePaymentId: stripePaymentId });
    const tx = await getTransactionByStripeId(stripePaymentId);
    assert.ok(tx);
    assert.strictEqual(tx?.id, txId);
});
