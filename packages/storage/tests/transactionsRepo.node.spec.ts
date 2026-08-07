import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acquireStripePaymentProcessingClaim,
    claimCheckoutNotification,
    claimOrderConfirmationEmail,
    completeStripePaymentProcessingClaim,
    createTransaction,
    deleteTransaction,
    ensureStripePaymentCompletionOutputs,
    getAllTransactions,
    getCompletedTransactionByStripePaymentId,
    getRecoverableStripePaymentIds,
    getStripePaymentCompletionOutputs,
    getStripePaymentProcessingClaim,
    getStripePaymentProcessingClaimReviews,
    getStripePaymentProcessingHealth,
    getTransaction,
    getTransactionByStripeId,
    type InsertTransaction,
    recordStripePaymentProcessingFailure,
    renewStripePaymentProcessingClaim,
    requeueStripePaymentProcessingClaim,
    resolveStripePaymentProcessingClaim,
    STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY,
    STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE,
    StripePaymentCompletionOutputConflictError,
    StripePaymentProcessingClaimLostError,
    StripePaymentProcessingDeferredError,
    StripePaymentProcessingPermanentError,
    StripePaymentProcessingUnavailableError,
    StripeTransactionIdentityConflictError,
    updateTransaction,
    withStripePaymentProcessingLock,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
// @ts-expect-error Type definitions for the pg ESM entry are not resolved under NodeNext
import { Pool } from 'pg';
import * as schema from '../src/schema';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function baseTransaction(): Promise<InsertTransaction> {
    return {
        accountId: await createTestAccount(),
        amount: 100,
        currency: 'eur',
        status: 'pending',
        stripePaymentId: randomUUID(),
    };
}

test('Stripe payment processing drain fence uses the migration-reserved lock keys', () => {
    assert.equal(
        STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE,
        1_196_573_763,
    );
    assert.equal(STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY, 1_398_035_024);
});

async function ensureTestCompletionOutputs({
    claimToken,
    now,
    stripePaymentId,
}: {
    claimToken: string;
    now?: Date;
    stripePaymentId: string;
}) {
    const result = await ensureStripePaymentCompletionOutputs({
        claimToken,
        orderConfirmation: {
            cartId: null,
            currency: 'eur',
            items: [{ amountSubtotal: 100, name: 'Test item', quantity: 1 }],
            manageUrl: 'https://vrt.gredice.com/',
            to: 'checkout-test@example.com',
            totalAmountCents: 100,
        },
        purchaseNotification: {
            accountId: null,
            amountTotal: 100,
            checkoutSessionId: stripePaymentId,
            currency: 'eur',
            customerEmail: 'checkout-test@example.com',
            items: [{ amountSubtotal: 100, name: 'Test item', quantity: 1 }],
        },
        ...(now ? { now } : {}),
        stripePaymentId,
    });
    assert.equal(result.status, 'ready');
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

test('createTransaction rejects a conflicting replay for a Stripe payment identity', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });

    await assert.rejects(
        () =>
            createTransaction({
                accountId,
                amount: 101,
                currency: 'eur',
                status: 'completed',
                stripePaymentId,
            }),
        StripeTransactionIdentityConflictError,
    );
});

test('an active Stripe processing claim rejects concurrent retryable delivery', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    let callbackCount = 0;
    let releaseCallback: (() => void) | undefined;
    let signalCallbackStarted: (() => void) | undefined;
    const callbackStarted = new Promise<void>((resolve) => {
        signalCallbackStarted = resolve;
    });
    const callbackRelease = new Promise<void>((resolve) => {
        releaseCallback = resolve;
    });
    const claimOptions = {
        heartbeatIntervalMs: 50,
        leaseDurationMs: 1_000,
    };

    const webhook = withStripePaymentProcessingLock(
        stripePaymentId,
        async (claimControl) => {
            callbackCount += 1;
            signalCallbackStarted?.();
            await callbackRelease;
            const transactionId = await createTransaction({
                accountId,
                amount: 100,
                currency: 'eur',
                status: 'completed',
                stripePaymentId,
            });
            await ensureTestCompletionOutputs({
                claimToken: claimControl.claimToken,
                stripePaymentId,
            });
            return transactionId;
        },
        claimOptions,
    );
    await callbackStarted;
    await assert.rejects(
        withStripePaymentProcessingLock(
            stripePaymentId,
            async () => {
                callbackCount += 1;
                return createTransaction({
                    accountId,
                    amount: 100,
                    currency: 'eur',
                    status: 'completed',
                    stripePaymentId,
                });
            },
            claimOptions,
        ),
        (error: unknown) =>
            error instanceof StripePaymentProcessingUnavailableError &&
            error.stripePaymentId === stripePaymentId &&
            error.claimStatus === 'processing' &&
            error.attempt === 1,
    );
    releaseCallback?.();
    await webhook;

    assert.strictEqual(callbackCount, 1);
    const transactions = await getAllTransactions({ filter: { accountId } });
    assert.strictEqual(
        transactions.filter(
            (transaction) => transaction.stripePaymentId === stripePaymentId,
        ).length,
        1,
    );
    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.strictEqual(claim?.status, 'completed');
    assert.ok(claim?.completedTransactionId);

    const duplicate = await withStripePaymentProcessingLock(
        stripePaymentId,
        async () => {
            callbackCount += 1;
        },
        claimOptions,
    );
    assert.strictEqual(duplicate, undefined);
    assert.strictEqual(callbackCount, 1);
});

test('a future retryable Stripe processing claim exposes its retry time', async () => {
    createTestDb();
    const stripePaymentId = randomUUID();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const acquired = await acquireStripePaymentProcessingClaim(
        stripePaymentId,
        {
            now,
        },
    );
    assert.strictEqual(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;
    const failure = await recordStripePaymentProcessingFailure({
        claimToken: acquired.claimToken,
        failureCode: 'provider_timeout',
        now,
        retryDelayMs: 60_000,
        stripePaymentId,
    });
    assert.strictEqual(failure.status, 'retryable');
    if (failure.status !== 'retryable') return;

    await assert.rejects(
        withStripePaymentProcessingLock(
            stripePaymentId,
            async () => undefined,
            {
                now: () => now,
            },
        ),
        (error: unknown) =>
            error instanceof StripePaymentProcessingUnavailableError &&
            error.claimStatus === 'retryable' &&
            error.availableAt?.getTime() === failure.nextAttemptAt.getTime(),
    );
});

test('expired claims recover and fence every stale completion and failure', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const first = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        now: startedAt,
    });
    assert.strictEqual(first.status, 'acquired');
    if (first.status !== 'acquired') {
        return;
    }

    const second = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        now: new Date('2026-01-01T00:00:01.001Z'),
    });
    assert.strictEqual(second.status, 'acquired');
    if (second.status !== 'acquired') {
        return;
    }
    assert.strictEqual(second.attempt, 2);
    assert.strictEqual(second.recovered, true);
    assert.notStrictEqual(second.claimToken, first.claimToken);

    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });
    await ensureTestCompletionOutputs({
        claimToken: second.claimToken,
        now: new Date('2026-01-01T00:00:01.002Z'),
        stripePaymentId,
    });
    assert.deepStrictEqual(
        await completeStripePaymentProcessingClaim({
            claimToken: first.claimToken,
            now: new Date('2026-01-01T00:00:01.002Z'),
            stripePaymentId,
        }),
        { status: 'claim_lost' },
    );
    assert.deepStrictEqual(
        await recordStripePaymentProcessingFailure({
            claimToken: first.claimToken,
            failureCode: 'stale_worker',
            now: new Date('2026-01-01T00:00:01.002Z'),
            stripePaymentId,
        }),
        { status: 'claim_lost' },
    );

    const completion = await completeStripePaymentProcessingClaim({
        claimToken: second.claimToken,
        now: new Date('2026-01-01T00:00:01.002Z'),
        stripePaymentId,
    });
    assert.strictEqual(completion.status, 'completed');
    const completedClaim =
        await getStripePaymentProcessingClaim(stripePaymentId);
    assert.strictEqual(completedClaim?.status, 'completed');
    assert.strictEqual(completedClaim?.claimToken, null);
});

test('crashed Stripe processing becomes discoverable and resumes idempotently after lease expiry', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const fulfillmentKeys = new Set<string>();
    let fulfillmentCount = 0;
    const fulfillOnce = () => {
        if (!fulfillmentKeys.has(stripePaymentId)) {
            fulfillmentKeys.add(stripePaymentId);
            fulfillmentCount += 1;
        }
    };
    const first = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        now: new Date('2026-01-01T00:00:00.000Z'),
    });
    assert.strictEqual(first.status, 'acquired');
    fulfillOnce();

    const recoverableIds = await getRecoverableStripePaymentIds({
        now: new Date('2026-01-01T00:00:01.001Z'),
    });
    assert.ok(recoverableIds.includes(stripePaymentId));
    const recovered = await acquireStripePaymentProcessingClaim(
        stripePaymentId,
        {
            leaseDurationMs: 1_000,
            now: new Date('2026-01-01T00:00:01.001Z'),
        },
    );
    assert.strictEqual(recovered.status, 'acquired');
    if (recovered.status !== 'acquired') {
        return;
    }
    fulfillOnce();
    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });
    await ensureTestCompletionOutputs({
        claimToken: recovered.claimToken,
        now: new Date('2026-01-01T00:00:01.002Z'),
        stripePaymentId,
    });
    const completion = await completeStripePaymentProcessingClaim({
        claimToken: recovered.claimToken,
        now: new Date('2026-01-01T00:00:01.002Z'),
        stripePaymentId,
    });

    assert.strictEqual(completion.status, 'completed');
    assert.strictEqual(fulfillmentCount, 1);
});

test('repeated Stripe processing failures move the claim to manual review', async () => {
    createTestDb();
    const stripePaymentId = randomUUID();
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const first = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        maxAttempts: 2,
        now: startedAt,
    });
    assert.strictEqual(first.status, 'acquired');
    if (first.status !== 'acquired') {
        return;
    }
    const retry = await recordStripePaymentProcessingFailure({
        claimToken: first.claimToken,
        failureCode: 'provider_timeout',
        maxAttempts: 2,
        now: new Date('2026-01-01T00:00:00.001Z'),
        retryDelayMs: 0,
        stripePaymentId,
    });
    assert.strictEqual(retry.status, 'retryable');

    const second = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        maxAttempts: 2,
        now: new Date('2026-01-01T00:00:00.002Z'),
    });
    assert.strictEqual(second.status, 'acquired');
    if (second.status !== 'acquired') {
        return;
    }
    const manualReview = await recordStripePaymentProcessingFailure({
        claimToken: second.claimToken,
        failureCode: 'provider_timeout',
        maxAttempts: 2,
        now: new Date('2026-01-01T00:00:00.003Z'),
        stripePaymentId,
    });
    assert.strictEqual(manualReview.status, 'manual_review');
    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.strictEqual(claim?.status, 'manual_review');
    assert.strictEqual(claim?.manualReviewReason, 'attempt_limit_reached');
});

test('missing completion outputs fail closed and enter the ordinary retry path', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();

    await assert.rejects(
        withStripePaymentProcessingLock(
            stripePaymentId,
            () =>
                createTransaction({
                    accountId,
                    amount: 100,
                    currency: 'eur',
                    status: 'completed',
                    stripePaymentId,
                }),
            {
                heartbeatIntervalMs: 500,
                leaseDurationMs: 5_000,
                maxAttempts: 2,
                retryDelayMs: 0,
            },
        ),
        /durable completion prerequisites/iu,
    );

    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(claim?.status, 'retryable');
    assert.equal(claim?.lastFailureCode, 'completion_outputs_missing');
    assert.equal(claim?.manualReviewReason, null);
});

test('a permanent processing error enters manual review on its first attempt', async () => {
    createTestDb();
    const stripePaymentId = randomUUID();

    await withStripePaymentProcessingLock(
        stripePaymentId,
        async () => {
            throw new StripePaymentProcessingPermanentError(
                'checkout_session_missing',
            );
        },
        {
            heartbeatIntervalMs: 500,
            leaseDurationMs: 5_000,
            maxAttempts: 5,
        },
    );

    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(claim?.attemptCount, 1);
    assert.equal(claim?.lastFailureCode, 'checkout_session_missing');
    assert.equal(claim?.manualReviewReason, 'checkout_session_missing');
    assert.equal(claim?.status, 'manual_review');

    let callbackRan = false;
    const duplicate = await withStripePaymentProcessingLock(
        stripePaymentId,
        async () => {
            callbackRan = true;
        },
        {
            heartbeatIntervalMs: 500,
            leaseDurationMs: 5_000,
            maxAttempts: 5,
        },
    );
    assert.strictEqual(duplicate, undefined);
    assert.strictEqual(callbackRan, false);
});

test('provider settlement deferrals preserve lifetime attempts without exhausting the review cycle', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const now = new Date('2026-01-01T00:00:00.000Z');

    for (let attempt = 1; attempt <= 6; attempt += 1) {
        await assert.rejects(
            withStripePaymentProcessingLock(
                stripePaymentId,
                async () => {
                    throw new StripePaymentProcessingDeferredError(
                        'checkout_session_payment_pending',
                    );
                },
                {
                    heartbeatIntervalMs: 500,
                    leaseDurationMs: 5_000,
                    maxAttempts: 2,
                    now: () => now,
                    retryDelayMs: 0,
                },
            ),
            StripePaymentProcessingDeferredError,
        );
        const deferred = await getStripePaymentProcessingClaim(stripePaymentId);
        assert.equal(deferred?.attemptCount, attempt);
        assert.equal(deferred?.attemptCountAtLastRequeue, attempt);
        assert.equal(
            deferred?.lastFailureCode,
            'checkout_session_payment_pending',
        );
        assert.equal(deferred?.status, 'retryable');
    }

    const transactionId = await withStripePaymentProcessingLock(
        stripePaymentId,
        async (claimControl) => {
            const createdTransactionId = await createTransaction({
                accountId,
                amount: 100,
                currency: 'eur',
                status: 'completed',
                stripePaymentId,
            });
            await ensureTestCompletionOutputs({
                claimToken: claimControl.claimToken,
                now,
                stripePaymentId,
            });
            return createdTransactionId;
        },
        {
            heartbeatIntervalMs: 500,
            leaseDurationMs: 5_000,
            maxAttempts: 2,
            now: () => now,
            retryDelayMs: 0,
        },
    );

    const completed = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(completed?.attemptCount, 7);
    assert.equal(completed?.completedTransactionId, transactionId);
    assert.equal(completed?.status, 'completed');
});

test('manual resolve refuses a completed transaction without both durable outputs', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const acquired = await acquireStripePaymentProcessingClaim(
        stripePaymentId,
        { maxAttempts: 1 },
    );
    assert.equal(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;
    await recordStripePaymentProcessingFailure({
        claimToken: acquired.claimToken,
        failureCode: 'test_failure',
        maxAttempts: 1,
        stripePaymentId,
    });
    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });

    const result = await resolveStripePaymentProcessingClaim({
        reason: 'Transaction exists but output evidence is incomplete',
        reviewedBy: 'operator@example.com',
        stripePaymentId,
    });
    assert.deepEqual(result, { status: 'completion_outputs_missing' });
    assert.equal(
        (await getStripePaymentProcessingClaim(stripePaymentId))?.status,
        'manual_review',
    );
    assert.deepEqual(
        await getStripePaymentProcessingClaimReviews(stripePaymentId),
        [],
    );
});

test('a stale running callback cannot cross a post-lease work boundary', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const startedAt = new Date('2026-01-02T00:00:00.000Z');
    let currentTime = startedAt;
    let postLeaseWork = 0;
    let releaseCallback: (() => void) | undefined;
    let signalCallbackStarted: (() => void) | undefined;
    let callbackSignal: AbortSignal | undefined;
    const callbackStarted = new Promise<void>((resolve) => {
        signalCallbackStarted = resolve;
    });
    const callbackRelease = new Promise<void>((resolve) => {
        releaseCallback = resolve;
    });

    const staleWorker = withStripePaymentProcessingLock(
        stripePaymentId,
        async (claimControl) => {
            callbackSignal = claimControl.signal;
            signalCallbackStarted?.();
            await callbackRelease;
            await claimControl.assertOwned();
            postLeaseWork += 1;
        },
        {
            heartbeatIntervalMs: 500,
            leaseDurationMs: 1_000,
            now: () => currentTime,
        },
    );
    await callbackStarted;

    currentTime = new Date('2026-01-02T00:00:01.001Z');
    const replacement = await acquireStripePaymentProcessingClaim(
        stripePaymentId,
        { leaseDurationMs: 1_000, now: currentTime },
    );
    assert.strictEqual(replacement.status, 'acquired');
    if (replacement.status !== 'acquired') return;
    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });
    await ensureTestCompletionOutputs({
        claimToken: replacement.claimToken,
        now: new Date('2026-01-02T00:00:01.002Z'),
        stripePaymentId,
    });
    await completeStripePaymentProcessingClaim({
        claimToken: replacement.claimToken,
        now: new Date('2026-01-02T00:00:01.002Z'),
        stripePaymentId,
    });
    releaseCallback?.();

    await assert.rejects(staleWorker, StripePaymentProcessingClaimLostError);
    assert.strictEqual(callbackSignal?.aborted, true);
    assert.strictEqual(postLeaseWork, 0);
});

test('manual review can requeue and resolve without resetting lifetime attempts', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const first = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        maxAttempts: 1,
        now: new Date('2026-01-03T00:00:00.000Z'),
    });
    assert.strictEqual(first.status, 'acquired');
    if (first.status !== 'acquired') return;
    assert.strictEqual(
        (
            await recordStripePaymentProcessingFailure({
                claimToken: first.claimToken,
                failureCode: 'provider_timeout',
                maxAttempts: 1,
                now: new Date('2026-01-03T00:00:00.001Z'),
                stripePaymentId,
            })
        ).status,
        'manual_review',
    );

    assert.deepStrictEqual(
        await requeueStripePaymentProcessingClaim({
            now: new Date('2026-01-03T00:00:00.002Z'),
            reason: 'Provider recovered; retry approved',
            reviewedBy: 'operator@example.com',
            stripePaymentId,
        }),
        { attemptCount: 1, status: 'requeued' },
    );
    const second = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        leaseDurationMs: 1_000,
        maxAttempts: 1,
        now: new Date('2026-01-03T00:00:00.003Z'),
    });
    assert.strictEqual(second.status, 'acquired');
    if (second.status !== 'acquired') return;
    assert.strictEqual(second.attempt, 2);
    await ensureTestCompletionOutputs({
        claimToken: second.claimToken,
        now: new Date('2026-01-03T00:00:00.003Z'),
        stripePaymentId,
    });
    assert.strictEqual(
        (
            await recordStripePaymentProcessingFailure({
                claimToken: second.claimToken,
                failureCode: 'provider_timeout',
                maxAttempts: 1,
                now: new Date('2026-01-03T00:00:00.004Z'),
                stripePaymentId,
            })
        ).status,
        'manual_review',
    );
    await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });
    const resolved = await resolveStripePaymentProcessingClaim({
        now: new Date('2026-01-03T00:00:00.005Z'),
        reason: 'Verified the completed transaction against Stripe',
        reviewedBy: 'operator@example.com',
        stripePaymentId,
    });
    assert.strictEqual(resolved.status, 'resolved_completed');

    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.strictEqual(claim?.status, 'completed');
    assert.strictEqual(claim?.attemptCount, 2);
    assert.strictEqual(claim?.attemptCountAtLastRequeue, 1);
    const reviews =
        await getStripePaymentProcessingClaimReviews(stripePaymentId);
    assert.deepStrictEqual(
        reviews.map((review) => ({
            action: review.action,
            previousAttemptCount: review.previousAttemptCount,
        })),
        [
            { action: 'requeued', previousAttemptCount: 1 },
            { action: 'resolved_completed', previousAttemptCount: 2 },
        ],
    );
});

test('recoverable Stripe claims share one chronological ordering', async () => {
    const database = createTestDb();
    const queuedId = randomUUID();
    const expiredProcessingId = randomUUID();
    const dueRetryableId = randomUUID();
    await database.insert(schema.stripePaymentProcessingClaims).values([
        {
            attemptCount: 0,
            status: 'queued',
            stripePaymentId: queuedId,
            updatedAt: new Date('2019-01-01T00:00:00.000Z'),
        },
        {
            attemptCount: 1,
            claimedAt: new Date('2020-01-01T00:00:00.000Z'),
            claimToken: randomUUID(),
            leaseExpiresAt: new Date('2020-01-01T00:00:01.000Z'),
            status: 'processing',
            stripePaymentId: expiredProcessingId,
            updatedAt: new Date('2020-01-01T00:00:00.000Z'),
        },
        {
            attemptCount: 1,
            nextAttemptAt: new Date('2020-01-01T00:00:02.000Z'),
            status: 'retryable',
            stripePaymentId: dueRetryableId,
            updatedAt: new Date('2020-01-01T00:00:00.000Z'),
        },
    ]);

    const recoverable = await getRecoverableStripePaymentIds({
        limit: 1_000,
        now: new Date('2026-01-01T00:00:00.000Z'),
    });
    assert.ok(recoverable.includes(queuedId));
    assert.ok(
        recoverable.indexOf(expiredProcessingId) <
            recoverable.indexOf(dueRetryableId),
    );
});

test('Stripe processing health aggregates actionable rows and excludes completed history', async () => {
    const database = createTestDb();
    const now = new Date('2026-08-03T09:15:00.000Z');
    const baseline = await getStripePaymentProcessingHealth({ now });
    const oldestRecoverableAt = new Date('2019-01-01T00:00:00.000Z');
    const oldestManualReviewAt = new Date('2020-01-01T00:00:02.000Z');
    await database.insert(schema.stripePaymentProcessingClaims).values([
        {
            attemptCount: 0,
            status: 'queued',
            stripePaymentId: randomUUID(),
            updatedAt: oldestRecoverableAt,
        },
        {
            attemptCount: 2,
            claimedAt: now,
            claimToken: randomUUID(),
            leaseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
            status: 'processing',
            stripePaymentId: randomUUID(),
            updatedAt: now,
        },
        {
            attemptCount: 3,
            claimedAt: new Date('2020-01-01T00:00:00.000Z'),
            claimToken: randomUUID(),
            leaseExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
            status: 'processing',
            stripePaymentId: randomUUID(),
            updatedAt: new Date('2020-01-01T00:00:00.000Z'),
        },
        {
            attemptCount: 4,
            nextAttemptAt: new Date('2020-01-01T00:00:01.000Z'),
            status: 'retryable',
            stripePaymentId: randomUUID(),
            updatedAt: new Date('2020-01-01T00:00:01.000Z'),
        },
        {
            attemptCount: 5,
            nextAttemptAt: new Date('2030-01-01T00:00:00.000Z'),
            status: 'retryable',
            stripePaymentId: randomUUID(),
            updatedAt: now,
        },
        {
            attemptCount: 6,
            manualReviewAt: oldestManualReviewAt,
            manualReviewReason: 'focused_health_test',
            status: 'manual_review',
            stripePaymentId: randomUUID(),
            updatedAt: oldestManualReviewAt,
        },
        {
            attemptCount: 99,
            completedAt: new Date('2010-01-01T00:00:00.000Z'),
            status: 'completed',
            stripePaymentId: randomUUID(),
            updatedAt: new Date('2010-01-01T00:00:00.000Z'),
        },
    ]);

    const health = await getStripePaymentProcessingHealth({ now });
    assert.strictEqual(health.queuedCount, baseline.queuedCount + 1);
    assert.strictEqual(health.processingCount, baseline.processingCount + 2);
    assert.strictEqual(
        health.expiredLeaseCount,
        baseline.expiredLeaseCount + 1,
    );
    assert.strictEqual(health.retryableCount, baseline.retryableCount + 2);
    assert.strictEqual(
        health.dueRetryableCount,
        baseline.dueRetryableCount + 1,
    );
    assert.strictEqual(
        health.manualReviewCount,
        baseline.manualReviewCount + 1,
    );
    assert.strictEqual(
        health.maxAttemptCount,
        Math.max(baseline.maxAttemptCount, 6),
    );
    assert.strictEqual(
        health.oldestRecoverableAt?.toISOString(),
        oldestRecoverableAt.toISOString(),
    );
    assert.strictEqual(
        health.oldestManualReviewAt?.toISOString(),
        oldestManualReviewAt.toISOString(),
    );
});

test('twelve distinct Stripe sessions reuse active transactions in a ten-connection PostgreSQL pool', {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'TEST_POSTGRES_URL is required for real PostgreSQL pool contention',
    timeout: 15_000,
}, async () => {
    const connectionString = process.env.TEST_POSTGRES_URL;
    assert.ok(connectionString);
    const sessionCount = 12;
    const poolMaximum = 10;
    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 1_000,
        max: poolMaximum,
    });
    const database = drizzle(pool, { schema });
    const accountId = randomUUID();
    await database.insert(schema.accounts).values({ id: accountId });
    const stripePaymentIds = Array.from({ length: sessionCount }, () =>
        randomUUID(),
    );
    let enteredCallbacks = 0;
    let activeTransactions = 0;
    let maximumActiveTransactions = 0;
    let ownershipChecksStarted = 0;
    let releaseCallbacks: (() => void) | undefined;
    const callbacksEntered = new Promise<void>((resolve) => {
        releaseCallbacks = resolve;
    });
    let signalPoolSaturated: (() => void) | undefined;
    const poolSaturated = new Promise<void>((resolve) => {
        signalPoolSaturated = resolve;
    });
    let releaseActiveTransactions: (() => void) | undefined;
    const activeTransactionsReleased = new Promise<void>((resolve) => {
        releaseActiveTransactions = resolve;
    });
    let rejectCoordination: ((error: Error) => void) | undefined;
    const coordinationFailed = new Promise<never>((_resolve, reject) => {
        rejectCoordination = reject;
    });
    const coordinationTimeout = setTimeout(() => {
        rejectCoordination?.(
            new Error(
                `Pool contention stalled with ${enteredCallbacks.toString()} callbacks, ${activeTransactions.toString()} active transactions, and ${ownershipChecksStarted.toString()} ownership checks`,
            ),
        );
    }, 5_000);
    coordinationTimeout.unref();
    let processing: Promise<number | undefined>[] = [];

    try {
        processing = stripePaymentIds.map((stripePaymentId) =>
            withStripePaymentProcessingLock(
                stripePaymentId,
                async (claimControl) => {
                    enteredCallbacks += 1;
                    if (enteredCallbacks === sessionCount) {
                        releaseCallbacks?.();
                    }
                    await callbacksEntered;
                    return database.transaction(async (tx) => {
                        activeTransactions += 1;
                        maximumActiveTransactions = Math.max(
                            maximumActiveTransactions,
                            activeTransactions,
                        );
                        if (activeTransactions === poolMaximum) {
                            signalPoolSaturated?.();
                        }
                        try {
                            await activeTransactionsReleased;
                            ownershipChecksStarted += 1;
                            await claimControl.assertOwned(tx);
                            const transactionId = await createTransaction(
                                {
                                    accountId,
                                    amount: 100,
                                    currency: 'eur',
                                    status: 'completed',
                                    stripePaymentId,
                                },
                                tx,
                            );
                            const outputs =
                                await ensureStripePaymentCompletionOutputs({
                                    claimToken: claimControl.claimToken,
                                    database: tx,
                                    orderConfirmation: {
                                        cartId: null,
                                        currency: 'eur',
                                        items: [],
                                        manageUrl: 'https://vrt.gredice.com/',
                                        to: 'checkout-test@example.com',
                                        totalAmountCents: 100,
                                    },
                                    purchaseNotification: {
                                        accountId,
                                        amountTotal: 100,
                                        checkoutSessionId: stripePaymentId,
                                        currency: 'eur',
                                        customerEmail:
                                            'checkout-test@example.com',
                                        items: [],
                                    },
                                    stripePaymentId,
                                });
                            assert.equal(outputs.status, 'ready');
                            return transactionId;
                        } finally {
                            activeTransactions -= 1;
                        }
                    });
                },
                {
                    database,
                    heartbeatIntervalMs: 30_000,
                    leaseDurationMs: 60_000,
                },
            ),
        );
        await Promise.race([callbacksEntered, coordinationFailed]);
        await Promise.race([poolSaturated, coordinationFailed]);

        assert.deepEqual(
            {
                activeTransactions,
                idleConnections: pool.idleCount,
                ownershipChecksStarted,
                totalConnections: pool.totalCount,
                waitingTransactions: pool.waitingCount,
            },
            {
                activeTransactions: poolMaximum,
                idleConnections: 0,
                ownershipChecksStarted: 0,
                totalConnections: poolMaximum,
                waitingTransactions: sessionCount - poolMaximum,
            },
        );

        releaseActiveTransactions?.();
        const transactionIds = await Promise.race([
            Promise.all(processing),
            coordinationFailed,
        ]);
        const completedTransactionIds = transactionIds.filter(
            (transactionId): transactionId is number =>
                typeof transactionId === 'number',
        );
        assert.strictEqual(enteredCallbacks, sessionCount);
        assert.strictEqual(maximumActiveTransactions, poolMaximum);
        assert.strictEqual(ownershipChecksStarted, sessionCount);
        assert.strictEqual(completedTransactionIds.length, sessionCount);

        const [claims, transactions, outputs] = await Promise.all([
            Promise.all(
                stripePaymentIds.map((stripePaymentId) =>
                    getStripePaymentProcessingClaim(stripePaymentId, database),
                ),
            ),
            Promise.all(
                stripePaymentIds.map((stripePaymentId) =>
                    getCompletedTransactionByStripePaymentId(
                        stripePaymentId,
                        database,
                    ),
                ),
            ),
            Promise.all(
                stripePaymentIds.map((stripePaymentId) =>
                    getStripePaymentCompletionOutputs(
                        stripePaymentId,
                        database,
                    ),
                ),
            ),
        ]);
        const storedTransactionIds: number[] = [];
        const completionOutputIds: number[] = [];
        for (let index = 0; index < sessionCount; index += 1) {
            const claim = claims[index];
            const transaction = transactions[index];
            const outputPair = outputs[index];
            assert.ok(claim);
            assert.ok(transaction);
            assert.ok(outputPair);
            assert.strictEqual(claim.status, 'completed');
            assert.strictEqual(claim.completedTransactionId, transaction.id);
            storedTransactionIds.push(transaction.id);
            completionOutputIds.push(
                outputPair.orderConfirmationEmailMessageId,
                outputPair.purchaseNotificationEmailMessageId,
            );
        }
        assert.strictEqual(new Set(storedTransactionIds).size, sessionCount);
        assert.strictEqual(new Set(completedTransactionIds).size, sessionCount);
        assert.deepEqual(
            new Set(storedTransactionIds),
            new Set(completedTransactionIds),
        );
        assert.strictEqual(completionOutputIds.length, sessionCount * 2);
        assert.strictEqual(new Set(completionOutputIds).size, sessionCount * 2);
    } finally {
        clearTimeout(coordinationTimeout);
        releaseCallbacks?.();
        releaseActiveTransactions?.();
        await Promise.allSettled(processing);
        await pool.end();
    }
});

test('Stripe claim renewal never shortens a lease when an older heartbeat finishes later', async () => {
    createTestDb();
    const stripePaymentId = randomUUID();
    // Claim columns follow the repository's timestamp-without-time-zone
    // convention. Use local wall-clock fixtures so this ordering regression is
    // stable on both UTC CI and developer machines in other time zones.
    const acquiredAt = new Date(2026, 0, 5, 0, 0, 0);
    const latestHeartbeatAt = new Date(2026, 0, 5, 0, 0, 5);
    const delayedHeartbeatAt = new Date(2026, 0, 5, 0, 0, 2);
    const acquired = await acquireStripePaymentProcessingClaim(
        stripePaymentId,
        {
            leaseDurationMs: 10_000,
            now: acquiredAt,
        },
    );
    assert.equal(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;

    const latestLease = await renewStripePaymentProcessingClaim({
        claimToken: acquired.claimToken,
        leaseDurationMs: 10_000,
        now: latestHeartbeatAt,
        stripePaymentId,
    });
    const delayedOlderLease = await renewStripePaymentProcessingClaim({
        claimToken: acquired.claimToken,
        leaseDurationMs: 10_000,
        now: delayedHeartbeatAt,
        stripePaymentId,
    });

    assert.equal(latestLease?.getTime(), latestHeartbeatAt.getTime() + 10_000);
    assert.equal(delayedOlderLease?.getTime(), latestLease?.getTime());
    const renewedClaim = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(
        renewedClaim?.updatedAt.getTime(),
        latestHeartbeatAt.getTime(),
    );
});

test('a transaction committed after the migration snapshot acquires processing so outputs can be repaired', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const stripePaymentId = randomUUID();
    const transactionId = await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId,
    });
    let callbackCount = 0;

    const repairedTransactionId = await withStripePaymentProcessingLock(
        stripePaymentId,
        async (claimControl) => {
            callbackCount += 1;
            const existingTransaction =
                await getCompletedTransactionByStripePaymentId(stripePaymentId);
            assert.equal(existingTransaction?.id, transactionId);
            await ensureTestCompletionOutputs({
                claimToken: claimControl.claimToken,
                stripePaymentId,
            });
            return existingTransaction?.id;
        },
    );

    assert.equal(repairedTransactionId, transactionId);
    assert.equal(callbackCount, 1);
    const stored = await getStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(stored?.attemptCount, 1);
    assert.equal(stored?.completedTransactionId, transactionId);
    assert.equal(stored?.completionOutputVersion, 1);
    assert.equal(stored?.status, 'completed');

    await withStripePaymentProcessingLock(stripePaymentId, async () => {
        callbackCount += 1;
    });
    assert.equal(callbackCount, 1);
});

test('a discovered queued Stripe claim is acquired as its first attempt', async () => {
    const database = createTestDb();
    const stripePaymentId = randomUUID();
    await database.insert(schema.stripePaymentProcessingClaims).values({
        attemptCount: 0,
        status: 'queued',
        stripePaymentId,
    });

    const claim = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        now: new Date('2026-01-06T00:00:00.000Z'),
    });

    assert.equal(claim.status, 'acquired');
    if (claim.status !== 'acquired') return;
    assert.equal(claim.attempt, 1);
    assert.equal(claim.recovered, false);
});

test('Stripe completion outputs are a deterministic claim-fenced pair', async () => {
    const database = createTestDb();
    const stripePaymentId = randomUUID();
    const acquired = await acquireStripePaymentProcessingClaim(stripePaymentId);
    assert.equal(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;
    const input = {
        claimToken: acquired.claimToken,
        orderConfirmation: {
            cartId: null,
            currency: 'EUR',
            items: [{ amountSubtotal: 500, name: 'Paket', quantity: 1 }],
            manageUrl: 'https://vrt.gredice.com',
            to: 'buyer@example.test',
            totalAmountCents: 500,
        },
        purchaseNotification: {
            accountId: null,
            amountTotal: 500,
            checkoutSessionId: stripePaymentId,
            currency: 'EUR',
            customerEmail: 'buyer@example.test',
            items: [{ amountSubtotal: 500, name: 'Paket', quantity: 1 }],
        },
        now: new Date('1900-01-01T00:00:00.000Z'),
        stripePaymentId,
    };

    const first = await ensureStripePaymentCompletionOutputs(input);
    assert.equal(first.status, 'ready');
    if (first.status !== 'ready') return;
    assert.equal(first.created, true);
    const replay = await ensureStripePaymentCompletionOutputs(input);
    assert.deepEqual(replay, { ...first, created: false });
    assert.deepEqual(await getStripePaymentCompletionOutputs(stripePaymentId), {
        orderConfirmationEmailMessageId: first.orderConfirmationEmailMessageId,
        outputVersion: 1,
        purchaseNotificationEmailMessageId:
            first.purchaseNotificationEmailMessageId,
    });

    await assert.rejects(
        ensureStripePaymentCompletionOutputs({
            ...input,
            purchaseNotification: {
                ...input.purchaseNotification,
                amountTotal: 501,
            },
        }),
        StripePaymentCompletionOutputConflictError,
    );

    const claimExpiresAt = new Date(Date.now() + 60_000);
    const orderClaim = await claimOrderConfirmationEmail({
        claimExpiresAt,
        claimId: `order-${randomUUID()}`,
    });
    assert.equal(orderClaim.status, 'claimed');
    if (orderClaim.status === 'claimed') {
        assert.equal(orderClaim.claim.payload.cartId, null);
    }
    const purchaseClaim = await claimCheckoutNotification({
        claimExpiresAt,
        claimId: `purchase-${randomUUID()}`,
    });
    assert.equal(purchaseClaim.status, 'claimed');
    if (purchaseClaim.status === 'claimed') {
        assert.equal(purchaseClaim.claim.payload.kind, 'purchase_slack');
    }

    const storedPurchase = await database.query.emailMessages.findFirst({
        where: eq(
            schema.emailMessages.id,
            first.purchaseNotificationEmailMessageId,
        ),
    });
    assert.ok(storedPurchase);
    await database
        .update(schema.emailMessages)
        .set({
            metadata: {
                ...storedPurchase.metadata,
                amountTotal: 999,
            },
        })
        .where(
            eq(
                schema.emailMessages.id,
                first.purchaseNotificationEmailMessageId,
            ),
        );
    assert.equal(
        await getStripePaymentCompletionOutputs(stripePaymentId),
        null,
    );
    await assert.rejects(
        ensureStripePaymentCompletionOutputs(input),
        StripePaymentCompletionOutputConflictError,
    );
});

test('Stripe completion output verification rejects malformed outbox envelopes', async () => {
    const database = createTestDb();
    type EmailRow = typeof schema.emailMessages.$inferSelect;
    type EmailChanges = Partial<
        Pick<
            typeof schema.emailMessages.$inferInsert,
            'metadata' | 'recipients'
        >
    >;
    const cases: {
        mutate: (row: EmailRow) => EmailChanges;
        name: string;
        target: 'order' | 'purchase';
    }[] = [
        {
            mutate: (row) => ({
                metadata: { ...row.metadata, outboxVersion: 2 },
            }),
            name: 'order outbox version',
            target: 'order',
        },
        {
            mutate: (row) => ({
                metadata: {
                    ...row.metadata,
                    notificationKind: 'delivery_created_slack',
                },
            }),
            name: 'purchase notification kind',
            target: 'purchase',
        },
        {
            mutate: (row) => ({
                recipients: {
                    ...row.recipients,
                    to: [
                        ...row.recipients.to,
                        { address: 'second@example.test' },
                    ],
                },
            }),
            name: 'multiple order recipients',
            target: 'order',
        },
        {
            mutate: (row) => ({
                recipients: {
                    ...row.recipients,
                    cc: [{ address: 'copy@example.test' }],
                },
            }),
            name: 'additional order recipient channel',
            target: 'order',
        },
        {
            mutate: (row) => ({
                recipients: {
                    ...row.recipients,
                    to: [{ address: 'unexpected@example.test' }],
                },
            }),
            name: 'purchase recipient',
            target: 'purchase',
        },
    ];

    for (const testCase of cases) {
        const stripePaymentId = randomUUID();
        const acquired =
            await acquireStripePaymentProcessingClaim(stripePaymentId);
        assert.equal(acquired.status, 'acquired', testCase.name);
        if (acquired.status !== 'acquired') continue;
        await ensureTestCompletionOutputs({
            claimToken: acquired.claimToken,
            stripePaymentId,
        });
        const outputs =
            await getStripePaymentCompletionOutputs(stripePaymentId);
        assert.ok(outputs, testCase.name);
        const emailMessageId =
            testCase.target === 'order'
                ? outputs.orderConfirmationEmailMessageId
                : outputs.purchaseNotificationEmailMessageId;
        const row = await database.query.emailMessages.findFirst({
            where: eq(schema.emailMessages.id, emailMessageId),
        });
        assert.ok(row, testCase.name);
        await database
            .update(schema.emailMessages)
            .set(testCase.mutate(row))
            .where(eq(schema.emailMessages.id, emailMessageId));

        assert.equal(
            await getStripePaymentCompletionOutputs(stripePaymentId),
            null,
            testCase.name,
        );
    }
});
