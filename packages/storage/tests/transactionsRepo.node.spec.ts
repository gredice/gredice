import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createTransaction,
    deleteTransaction,
    getAllTransactions,
    getCompletedTransactionByStripePaymentId,
    getStripePaymentProcessingDrainPreflight,
    getTransaction,
    getTransactionByStripeId,
    type InsertTransaction,
    STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY,
    STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE,
    updateTransaction,
    withStripePaymentProcessingLock,
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

test('Stripe payment processing drain fence uses the migration-reserved lock keys', () => {
    assert.equal(
        STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE,
        1_196_573_763,
    );
    assert.equal(STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY, 1_398_035_024);
});

test('Stripe payment processing drain preflight waits for every shared processor transaction to commit', {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'TEST_POSTGRES_URL is required for real PostgreSQL drain locking',
    timeout: 10_000,
}, async () => {
    createTestDb();
    let releaseFirstProcessor = () => {};
    const firstProcessorRelease = new Promise<void>((resolve) => {
        releaseFirstProcessor = resolve;
    });
    let markFirstProcessorStarted = () => {};
    const firstProcessorStarted = new Promise<void>((resolve) => {
        markFirstProcessorStarted = resolve;
    });
    let releaseSecondProcessor = () => {};
    const secondProcessorRelease = new Promise<void>((resolve) => {
        releaseSecondProcessor = resolve;
    });
    let markSecondProcessorStarted = () => {};
    const secondProcessorStarted = new Promise<void>((resolve) => {
        markSecondProcessorStarted = resolve;
    });

    const firstProcessor = withStripePaymentProcessingLock(
        `drain-test-first-${randomUUID()}`,
        async () => {
            markFirstProcessorStarted();
            await firstProcessorRelease;
        },
    );
    const secondProcessor = withStripePaymentProcessingLock(
        `drain-test-second-${randomUUID()}`,
        async () => {
            markSecondProcessorStarted();
            await secondProcessorRelease;
        },
    );

    await Promise.all([firstProcessorStarted, secondProcessorStarted]);
    try {
        assert.equal(await getStripePaymentProcessingDrainPreflight(), false);

        releaseFirstProcessor();
        await firstProcessor;
        assert.equal(await getStripePaymentProcessingDrainPreflight(), false);
    } finally {
        releaseFirstProcessor();
        releaseSecondProcessor();
        await Promise.all([firstProcessor, secondProcessor]);
    }

    assert.equal(await getStripePaymentProcessingDrainPreflight(), true);
});

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
