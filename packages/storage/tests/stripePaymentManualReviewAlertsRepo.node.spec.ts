import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acquireStripePaymentProcessingClaim,
    claimCheckoutNotification,
    createTransaction,
    emailMessages,
    ensureStripePaymentManualReviewAlert,
    events,
    getStripePaymentProcessingClaim,
    getStripePaymentProcessingClaimReviews,
    markCheckoutNotificationFailed,
    markCheckoutNotificationSent,
    recordStripePaymentManualReviewAlertSource,
    recordStripePaymentProcessingFailure,
    repairStripePaymentManualReviewAlerts,
    requeueStripePaymentProcessingClaim,
    StripePaymentProcessingPermanentError,
    startCheckoutNotificationSubmission,
    storage,
    stripePaymentManualReviewAlertEventType,
    stripePaymentProcessingClaimReviews,
    stripePaymentProcessingClaims,
    transactions,
    withStripePaymentProcessingLock,
} from '@gredice/storage';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

const paymentIds: string[] = [];
function paymentId() {
    const id = `cs_test_review_${randomUUID()}`;
    paymentIds.push(id);
    return id;
}
const now = new Date('2026-10-24T10:00:00.000Z');

function testClaimIds() {
    return storage()
        .select({
            id: sql<string>`${stripePaymentProcessingClaims.schedulerId}::text`,
        })
        .from(stripePaymentProcessingClaims)
        .where(
            inArray(stripePaymentProcessingClaims.stripePaymentId, paymentIds),
        );
}

async function alerts() {
    return storage()
        .select()
        .from(emailMessages)
        .where(
            and(
                sql`${emailMessages.metadata}->>'notificationKind' = 'payment_manual_review_slack'`,
                inArray(
                    sql`${emailMessages.metadata}->>'paymentClaimId'`,
                    testClaimIds(),
                ),
            ),
        );
}

test.afterEach(async () => {
    await storage()
        .delete(emailMessages)
        .where(
            and(
                sql`${emailMessages.metadata}->>'notificationKind' = 'payment_manual_review_slack'`,
                inArray(
                    sql`${emailMessages.metadata}->>'paymentClaimId'`,
                    testClaimIds(),
                ),
            ),
        );
    await storage()
        .delete(events)
        .where(
            and(
                eq(events.type, stripePaymentManualReviewAlertEventType),
                inArray(sql`${events.data}->>'paymentClaimId'`, testClaimIds()),
            ),
        );
    await storage()
        .delete(stripePaymentProcessingClaimReviews)
        .where(
            inArray(
                stripePaymentProcessingClaimReviews.stripePaymentId,
                paymentIds,
            ),
        );
    await storage()
        .delete(stripePaymentProcessingClaims)
        .where(
            inArray(stripePaymentProcessingClaims.stripePaymentId, paymentIds),
        );
    await storage()
        .delete(transactions)
        .where(inArray(transactions.stripePaymentId, paymentIds));
    paymentIds.length = 0;
});

test('permanent callback failure commits one privacy-safe intent despite concurrent rechecks', async () => {
    createTestDb();
    const id = paymentId();
    let callbacks = 0;
    const callback = async () => {
        callbacks += 1;
        throw new StripePaymentProcessingPermanentError(
            'checkout_operation_conflict',
        );
    };
    await withStripePaymentProcessingLock(id, callback);
    await Promise.all(
        Array.from({ length: 8 }, () =>
            withStripePaymentProcessingLock(id, callback),
        ),
    );
    await Promise.all(
        Array.from({ length: 8 }, () =>
            ensureStripePaymentManualReviewAlert(id),
        ),
    );
    const claim = await getStripePaymentProcessingClaim(id);
    assert.equal(callbacks, 1);
    assert.equal(claim?.status, 'manual_review');
    assert.equal(claim?.attemptCount, 1);
    const rows = await alerts();
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].metadata, {
        paymentClaimId: claim?.schedulerId,
        reviewCycleId: 0,
        failureCategory: 'checkout_operation_conflict',
        attemptCount: 0,
        maxAttempts: 3,
        nextAttemptAt: null,
        notificationKind: 'payment_manual_review_slack',
        outboxKind: 'checkout_notification',
        outboxVersion: 1,
    });
    assert.deepEqual(rows[0].recipients, { to: [] });
    assert.equal(rows[0].provider, 'slack');
    assert.ok(!JSON.stringify(rows[0].metadata).includes(id));
});

test('both failure-time and acquire-time attempt exhaustion enqueue one intent', async () => {
    createTestDb();
    const failureId = paymentId();
    const acquired = await acquireStripePaymentProcessingClaim(failureId, {
        now,
        maxAttempts: 1,
    });
    assert.equal(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;
    assert.equal(
        (
            await recordStripePaymentProcessingFailure({
                claimToken: acquired.claimToken,
                stripePaymentId: failureId,
                failureCode: 'Error',
                now,
                maxAttempts: 1,
            })
        ).status,
        'manual_review',
    );
    const expiredId = paymentId();
    await acquireStripePaymentProcessingClaim(expiredId, {
        now,
        maxAttempts: 1,
        leaseDurationMs: 100,
    });
    const expired = new Date(now.getTime() + 101);
    const results = await Promise.all(
        Array.from({ length: 8 }, () =>
            acquireStripePaymentProcessingClaim(expiredId, {
                now: expired,
                maxAttempts: 1,
            }),
        ),
    );
    assert.ok(results.every((result) => result.status === 'manual_review'));
    assert.equal((await alerts()).length, 2);
    assert.ok(
        (await alerts()).every(
            (row) => row.metadata.failureCategory === 'attempt_limit_reached',
        ),
    );
    assert.equal(
        (await getStripePaymentProcessingClaim(expiredId))?.attemptCount,
        1,
    );
});

test('transient retries and audited requeue preserve lifetime history, fencing, and cycle identity', async () => {
    createTestDb();
    const id = paymentId();
    let staleToken = '';
    for (let index = 0; index < 5; index += 1) {
        const acquired = await acquireStripePaymentProcessingClaim(id, { now });
        assert.equal(acquired.status, 'acquired');
        if (acquired.status !== 'acquired') return;
        staleToken = acquired.claimToken;
        assert.equal((await alerts()).length, 0);
        const failure = await recordStripePaymentProcessingFailure({
            claimToken: acquired.claimToken,
            stripePaymentId: id,
            failureCode: index % 2 ? 'TypeError' : 'database_transport',
            now,
            retryDelayMs: 0,
        });
        assert.equal(
            failure.status,
            index === 4 ? 'manual_review' : 'retryable',
        );
    }
    const [first] = await alerts();
    assert.equal(first.metadata.reviewCycleId, 0);
    const decisions = await Promise.all(
        Array.from({ length: 2 }, () =>
            requeueStripePaymentProcessingClaim({
                stripePaymentId: id,
                reviewedBy: 'test-operator',
                reason: 'Synthetic conflict repaired',
                now,
            }),
        ),
    );
    assert.equal(
        decisions.filter((result) => result.status === 'requeued').length,
        1,
    );
    const reviews = await getStripePaymentProcessingClaimReviews(id);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].previousAttemptCount, 5);
    const acquired = await acquireStripePaymentProcessingClaim(id, { now });
    assert.equal(acquired.status, 'acquired');
    if (acquired.status !== 'acquired') return;
    assert.equal(acquired.attempt, 6);
    assert.equal(
        (
            await recordStripePaymentProcessingFailure({
                claimToken: staleToken,
                stripePaymentId: id,
                failureCode: 'stale',
                retryable: false,
                now,
            })
        ).status,
        'claim_lost',
    );
    await recordStripePaymentProcessingFailure({
        claimToken: acquired.claimToken,
        stripePaymentId: id,
        failureCode: 'checkout_operation_conflict',
        retryable: false,
        now,
    });
    await ensureStripePaymentManualReviewAlert(id);
    const rows = await alerts();
    assert.equal(rows.length, 2);
    assert.deepEqual(
        rows
            .map((row) => row.metadata.reviewCycleId)
            .sort((a, b) => Number(a) - Number(b)),
        [0, reviews[0].id],
    );
    assert.notEqual(rows[0].providerMessageId, rows[1].providerMessageId);
    const claim = await getStripePaymentProcessingClaim(id);
    assert.equal(claim?.attemptCount, 6);
    assert.equal(claim?.attemptCountAtLastRequeue, 5);
    assert.equal(claim?.claimToken, null);
});

test('enqueue rollback leaves committed payment and manual review repairable', async () => {
    createTestDb();
    const id = paymentId();
    const accountId = await createTestAccount();
    const transactionId = await createTransaction({
        accountId,
        amount: 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentId: id,
    });
    await storage().execute(sql`create function test_reject_review_alert() returns trigger language plpgsql as $$ begin
        if NEW.metadata->>'notificationKind' = 'payment_manual_review_slack' then raise exception 'synthetic enqueue failure'; end if;
        return NEW;
    end $$`);
    await storage().execute(
        sql`create trigger test_reject_review_alert before insert on email_messages for each row execute function test_reject_review_alert()`,
    );
    try {
        await withStripePaymentProcessingLock(id, async () => {
            throw new StripePaymentProcessingPermanentError(
                'checkout_operation_conflict',
            );
        });
        assert.equal(
            (await getStripePaymentProcessingClaim(id))?.status,
            'manual_review',
        );
        const [payment] = await storage()
            .select()
            .from(transactions)
            .where(eq(transactions.id, transactionId));
        assert.equal(payment.status, 'completed');
        assert.equal((await alerts()).length, 0);
        assert.deepEqual(await repairStripePaymentManualReviewAlerts(), {
            failed: 1,
            pending: true,
        });
        // The old cycle remains recoverable even if an operator acts while
        // enqueueing is unavailable, before the repair worker ever sees it.
        assert.equal(
            (
                await requeueStripePaymentProcessingClaim({
                    stripePaymentId: id,
                    reviewedBy: 'test-operator',
                    reason: 'Synthetic reviewed repair',
                })
            ).status,
            'requeued',
        );
    } finally {
        await storage().execute(
            sql`drop trigger test_reject_review_alert on email_messages`,
        );
        await storage().execute(sql`drop function test_reject_review_alert()`);
    }
    assert.deepEqual(await repairStripePaymentManualReviewAlerts(), {
        failed: 0,
        pending: false,
    });
    assert.equal((await alerts()).length, 1);
    assert.deepEqual(await repairStripePaymentManualReviewAlerts(), {
        failed: 0,
        pending: false,
    });
    assert.equal((await alerts()).length, 1);
});

test('bounded repair skips existing intents of every delivery status and sanitizes historical reasons', async () => {
    createTestDb();
    for (let index = 0; index < 3; index += 1) {
        await storage()
            .insert(stripePaymentProcessingClaims)
            .values({
                stripePaymentId: paymentId(),
                status: 'manual_review',
                manualReviewReason: index
                    ? 'private_provider_token_123'
                    : 'customer@example.test address payload',
                attemptCount: 5,
            });
    }
    assert.deepEqual(
        await repairStripePaymentManualReviewAlerts({ limit: 1 }),
        { failed: 0, pending: true },
    );
    const [first] = await alerts();
    await storage()
        .update(emailMessages)
        .set({ status: 'failed' })
        .where(eq(emailMessages.id, first.id));
    assert.deepEqual(
        await repairStripePaymentManualReviewAlerts({ limit: 1 }),
        { failed: 0, pending: true },
    );
    assert.deepEqual(
        await repairStripePaymentManualReviewAlerts({ limit: 1 }),
        { failed: 0, pending: false },
    );
    assert.equal((await alerts()).length, 3);
    assert.ok(
        (await alerts()).every(
            (row) => row.metadata.failureCategory === 'processing_failure',
        ),
    );
});

test('a completed review audit preserves an undelivered cycle after resolve', async () => {
    createTestDb();
    const id = paymentId();
    await storage().insert(stripePaymentProcessingClaims).values({
        stripePaymentId: id,
        status: 'completed',
        attemptCount: 5,
    });
    const sourceClaim = await getStripePaymentProcessingClaim(id);
    assert.ok(sourceClaim);
    await storage().transaction(async (tx) =>
        recordStripePaymentManualReviewAlertSource(
            sourceClaim,
            'checkout_operation_conflict',
            tx,
        ),
    );
    await storage().insert(stripePaymentProcessingClaimReviews).values({
        stripePaymentId: id,
        action: 'resolved_completed',
        previousAttemptCount: 5,
        previousManualReviewReason: 'checkout_operation_conflict',
        reviewedBy: 'test-operator',
        reason: 'Synthetic verified completion',
    });
    const legacyId = paymentId();
    await storage().insert(stripePaymentProcessingClaims).values({
        stripePaymentId: legacyId,
        status: 'completed',
        attemptCount: 5,
    });
    await storage().insert(stripePaymentProcessingClaimReviews).values({
        stripePaymentId: legacyId,
        action: 'resolved_completed',
        previousAttemptCount: 5,
        previousManualReviewReason: 'checkout_operation_conflict',
        reviewedBy: 'test-operator',
        reason: 'Resolved before alert rollout',
    });
    assert.deepEqual(await repairStripePaymentManualReviewAlerts(), {
        failed: 0,
        pending: false,
    });
    const rows = await alerts();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].metadata.paymentClaimId, sourceClaim.schedulerId);
    assert.equal(rows[0].metadata.reviewCycleId, 0);
    assert.equal(
        (await getStripePaymentProcessingClaim(id))?.status,
        'completed',
    );
});

test('configuration and rejected transport retry only the alert, retaining source identity', {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'Real PostgreSQL is required for independent SKIP LOCKED queue isolation',
}, async () => {
    createTestDb();
    const id = paymentId();
    await withStripePaymentProcessingLock(id, async () => {
        throw new StripePaymentProcessingPermanentError(
            'checkout_operation_conflict',
        );
    });
    const source = await getStripePaymentProcessingClaim(id);
    const [intent] = await alerts();
    // Other repository specs leave synthetic queue rows in the shared disposable
    // database. Lock those rows so SKIP LOCKED isolates this intent without
    // deleting, changing, or accidentally consuming unrelated fixtures.
    await storage().transaction(async (isolation) => {
        await isolation
            .select({ id: emailMessages.id })
            .from(emailMessages)
            .where(ne(emailMessages.id, intent.id))
            .for('update');
        const initial = new Date(Date.now() + 1000);
        const claim = async (at: Date, claimId: string) => {
            const result = await claimCheckoutNotification({
                claimId,
                now: at,
                claimExpiresAt: new Date(at.getTime() + 60_000),
            });
            assert.equal(result.status, 'claimed');
            if (result.status !== 'claimed') throw new Error('Expected alert');
            assert.equal(
                result.claim.payload.kind,
                'payment_manual_review_slack',
            );
            return result.claim;
        };
        const first = await claim(initial, 'config');
        assert.equal(
            (
                await markCheckoutNotificationFailed({
                    claimId: first.claimId,
                    emailMessageId: first.emailMessageId,
                    failureCode: 'configuration_error',
                    failureKind: 'configuration',
                    now: initial,
                })
            ).status,
            'retry_scheduled',
        );
        const retryAt = new Date(initial.getTime() + 60_001);
        const second = await claim(retryAt, 'transport');
        assert.equal(second.attempt, 1); // missing configuration consumes no transport budget
        await startCheckoutNotificationSubmission({
            claimId: second.claimId,
            emailMessageId: second.emailMessageId,
            now: retryAt,
        });
        assert.equal(
            (
                await markCheckoutNotificationFailed({
                    claimId: second.claimId,
                    emailMessageId: second.emailMessageId,
                    failureCode: 'provider_rejected_retryable',
                    failureKind: 'retryable',
                    now: retryAt,
                })
            ).status,
            'retry_scheduled',
        );
        const lastAt = new Date(retryAt.getTime() + 60_001);
        const third = await claim(lastAt, 'accepted');
        assert.equal(third.emailMessageId, first.emailMessageId);
        assert.equal(third.providerOperationId, first.providerOperationId);
        assert.equal(third.attempt, 2);
        await startCheckoutNotificationSubmission({
            claimId: third.claimId,
            emailMessageId: third.emailMessageId,
            now: lastAt,
        });
        assert.equal(
            (
                await markCheckoutNotificationSent({
                    claimId: third.claimId,
                    emailMessageId: third.emailMessageId,
                    now: lastAt,
                })
            ).status,
            'sent',
        );
        assert.deepEqual(await getStripePaymentProcessingClaim(id), source);
        assert.equal(
            (
                await claimCheckoutNotification({
                    claimId: 'replay',
                    now: lastAt,
                    claimExpiresAt: new Date(lastAt.getTime() + 60_000),
                })
            ).status,
            'empty',
        );
        assert.equal((await alerts()).length, 1);
    });
});
