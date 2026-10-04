import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { getStripePaymentCompletionRollbackPreflight } from '@gredice/storage';
import { asc, eq, inArray } from 'drizzle-orm';
import * as schema from '../src/schema';
import { createTestDb } from './testDb';

type TestDatabase = ReturnType<typeof createTestDb>;
type EmailStatus = NonNullable<typeof schema.emailMessages.$inferInsert.status>;

function earliestIso(existing: string | null, candidate: Date) {
    const candidateIso = candidate.toISOString();
    return existing && existing < candidateIso ? existing : candidateIso;
}

async function insertCompletionOutputPair(
    database: TestDatabase,
    queuedAt: Date,
) {
    const stripePaymentId = `cs_rollback_${randomUUID()}`;
    const fingerprint = 'a'.repeat(64);
    const [order, purchase] = await database
        .insert(schema.emailMessages)
        .values([
            {
                attachments: [],
                createdAt: queuedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'commerce',
                metadata: {
                    attemptCount: 0,
                    cartId: null,
                    completionFingerprint: fingerprint,
                    completionOutputKind: 'order_confirmation',
                    completionOutputVersion: 1,
                    currency: 'eur',
                    items: [],
                    manageUrl: 'https://vrt.gredice.com/',
                    maxAttempts: 3,
                    nextAttemptAt: null,
                    outboxKind: 'order_confirmation',
                    outboxVersion: 1,
                    stripePaymentId,
                    totalAmountCents: 100,
                },
                provider: 'acs',
                providerMessageId: randomUUID(),
                providerStatus: 'outbox_ready',
                queuedAt,
                recipients: {
                    to: [{ address: 'rollback-test@example.com' }],
                },
                status: 'queued',
                subject: 'Gredice - potvrda narudžbe',
                templateName: 'commerce-order-confirmation',
                updatedAt: queuedAt,
            },
            {
                attachments: [],
                createdAt: queuedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'checkout',
                metadata: {
                    accountId: null,
                    amountTotal: 100,
                    attemptCount: 0,
                    checkoutSessionId: stripePaymentId,
                    completionFingerprint: fingerprint,
                    completionOutputKind: 'purchase_slack',
                    completionOutputVersion: 1,
                    currency: 'eur',
                    customerEmail: 'rollback-test@example.com',
                    items: [],
                    maxAttempts: 3,
                    nextAttemptAt: null,
                    notificationKind: 'purchase_slack',
                    outboxKind: 'checkout_notification',
                    outboxVersion: 1,
                    stripePaymentId,
                },
                provider: 'slack',
                providerMessageId: randomUUID(),
                providerStatus: 'outbox_ready',
                queuedAt,
                recipients: { to: [] },
                status: 'queued',
                subject: 'Checkout notification: purchase_slack',
                templateName: 'checkout-notification',
                updatedAt: queuedAt,
            },
        ])
        .returning({ id: schema.emailMessages.id });
    assert.ok(order);
    assert.ok(purchase);
    return { orderId: order.id, purchaseId: purchase.id };
}

async function setOutputStatus(
    database: TestDatabase,
    emailMessageId: number,
    status: EmailStatus,
    now: Date,
) {
    await database
        .update(schema.emailMessages)
        .set({
            ...(status === 'failed' || status === 'bounced'
                ? { completedAt: now }
                : {}),
            ...(status === 'sending' ? { lastAttemptAt: now } : {}),
            ...(status === 'sent' ? { completedAt: now, sentAt: now } : {}),
            providerStatus: `rollback_test_${status}`,
            status,
            updatedAt: now,
        })
        .where(eq(schema.emailMessages.id, emailMessageId));
}

test('rollback preflight aggregates every unsent new-only v1 output without mutating rows', async () => {
    const database = createTestDb();
    const baseline =
        await getStripePaymentCompletionRollbackPreflight(database);
    const oldestBlockingAt = new Date('2000-01-01T00:00:00.000Z');
    const queued = await insertCompletionOutputPair(database, oldestBlockingAt);
    const sending = await insertCompletionOutputPair(
        database,
        new Date('2000-01-02T00:00:00.000Z'),
    );
    const failed = await insertCompletionOutputPair(
        database,
        new Date('2000-01-03T00:00:00.000Z'),
    );
    const bounced = await insertCompletionOutputPair(
        database,
        new Date('2000-01-04T00:00:00.000Z'),
    );
    await setOutputStatus(
        database,
        sending.orderId,
        'sent',
        new Date('2000-01-02T00:01:00.000Z'),
    );
    await setOutputStatus(
        database,
        sending.purchaseId,
        'sending',
        new Date('2000-01-02T00:01:00.000Z'),
    );
    await setOutputStatus(
        database,
        failed.orderId,
        'failed',
        new Date('2000-01-03T00:01:00.000Z'),
    );
    await setOutputStatus(
        database,
        failed.purchaseId,
        'sent',
        new Date('2000-01-03T00:01:00.000Z'),
    );
    await setOutputStatus(
        database,
        bounced.orderId,
        'sent',
        new Date('2000-01-04T00:01:00.000Z'),
    );
    await setOutputStatus(
        database,
        bounced.purchaseId,
        'bounced',
        new Date('2000-01-04T00:01:00.000Z'),
    );

    const excludedAt = new Date('1990-01-01T00:00:00.000Z');
    const excluded = await database
        .insert(schema.emailMessages)
        .values([
            {
                attachments: [],
                createdAt: excludedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'commerce',
                metadata: {
                    cartId: 42,
                    outboxKind: 'order_confirmation',
                    outboxVersion: 1,
                },
                provider: 'acs',
                queuedAt: excludedAt,
                recipients: {
                    to: [{ address: 'legacy-order@example.com' }],
                },
                status: 'queued',
                subject: 'Legacy order confirmation',
                templateName: 'commerce-order-confirmation',
                updatedAt: excludedAt,
            },
            {
                attachments: [],
                createdAt: excludedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'checkout',
                metadata: {
                    notificationKind: 'delivery_created_slack',
                    outboxKind: 'checkout_notification',
                    outboxVersion: 1,
                },
                provider: 'slack',
                queuedAt: excludedAt,
                recipients: { to: [] },
                status: 'queued',
                subject: 'Legacy checkout notification',
                templateName: 'checkout-notification',
                updatedAt: excludedAt,
            },
            {
                attachments: [],
                createdAt: excludedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'commerce',
                metadata: {
                    cartId: null,
                    outboxKind: 'order_confirmation',
                    outboxVersion: 1,
                },
                provider: 'acs',
                queuedAt: excludedAt,
                recipients: {
                    to: [{ address: 'non-stripe-order@example.com' }],
                },
                status: 'queued',
                subject: 'Non-Stripe null-cart row',
                templateName: 'commerce-order-confirmation',
                updatedAt: excludedAt,
            },
            {
                attachments: [],
                createdAt: excludedAt,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                messageType: 'checkout',
                metadata: {
                    notificationKind: 'purchase_slack',
                    outboxKind: 'checkout_notification',
                    outboxVersion: 2,
                },
                provider: 'slack',
                queuedAt: excludedAt,
                recipients: { to: [] },
                status: 'queued',
                subject: 'Future checkout notification',
                templateName: 'checkout-notification',
                updatedAt: excludedAt,
            },
        ])
        .returning({ id: schema.emailMessages.id });
    const trackedIds = [
        queued.orderId,
        queued.purchaseId,
        sending.orderId,
        sending.purchaseId,
        failed.orderId,
        failed.purchaseId,
        bounced.orderId,
        bounced.purchaseId,
        ...excluded.map((row) => row.id),
    ];
    const readTrackedState = () =>
        database
            .select({
                completedAt: schema.emailMessages.completedAt,
                id: schema.emailMessages.id,
                lastAttemptAt: schema.emailMessages.lastAttemptAt,
                providerStatus: schema.emailMessages.providerStatus,
                sentAt: schema.emailMessages.sentAt,
                status: schema.emailMessages.status,
                updatedAt: schema.emailMessages.updatedAt,
            })
            .from(schema.emailMessages)
            .where(inArray(schema.emailMessages.id, trackedIds))
            .orderBy(asc(schema.emailMessages.id));
    const before = await readTrackedState();

    const result = await getStripePaymentCompletionRollbackPreflight(database);
    assert.deepEqual(
        await getStripePaymentCompletionRollbackPreflight(database),
        result,
    );
    assert.deepEqual(await readTrackedState(), before);
    assert.strictEqual(result.safeToRollback, false);
    assert.strictEqual(result.blockingCount, baseline.blockingCount + 5);
    assert.deepEqual(result.statusCounts, {
        bounced: baseline.statusCounts.bounced + 1,
        failed: baseline.statusCounts.failed + 1,
        queued: baseline.statusCounts.queued + 2,
        sending: baseline.statusCounts.sending + 1,
    });
    assert.strictEqual(
        result.purchaseSlack.blockingCount,
        baseline.purchaseSlack.blockingCount + 3,
    );
    assert.strictEqual(
        result.stripeOrderConfirmation.blockingCount,
        baseline.stripeOrderConfirmation.blockingCount + 2,
    );
    assert.strictEqual(
        result.oldestBlockingQueuedAt,
        earliestIso(baseline.oldestBlockingQueuedAt, oldestBlockingAt),
    );
    assert.strictEqual(
        result.purchaseSlack.oldestQueuedAt,
        earliestIso(baseline.purchaseSlack.oldestQueuedAt, oldestBlockingAt),
    );
    assert.strictEqual(
        result.stripeOrderConfirmation.oldestQueuedAt,
        earliestIso(
            baseline.stripeOrderConfirmation.oldestQueuedAt,
            oldestBlockingAt,
        ),
    );
});

test('a new-only output pair stops blocking rollback only after both rows are sent', async () => {
    const database = createTestDb();
    const baseline =
        await getStripePaymentCompletionRollbackPreflight(database);
    const pair = await insertCompletionOutputPair(
        database,
        new Date('2001-01-01T00:00:00.000Z'),
    );
    const pairIds = [pair.orderId, pair.purchaseId];
    const readPairState = () =>
        database
            .select({
                completedAt: schema.emailMessages.completedAt,
                id: schema.emailMessages.id,
                providerStatus: schema.emailMessages.providerStatus,
                sentAt: schema.emailMessages.sentAt,
                status: schema.emailMessages.status,
                updatedAt: schema.emailMessages.updatedAt,
            })
            .from(schema.emailMessages)
            .where(inArray(schema.emailMessages.id, pairIds))
            .orderBy(asc(schema.emailMessages.id));

    const queuedState = await readPairState();
    const bothQueued =
        await getStripePaymentCompletionRollbackPreflight(database);
    assert.deepEqual(await readPairState(), queuedState);
    assert.strictEqual(bothQueued.blockingCount, baseline.blockingCount + 2);
    assert.strictEqual(
        bothQueued.purchaseSlack.blockingCount,
        baseline.purchaseSlack.blockingCount + 1,
    );
    assert.strictEqual(
        bothQueued.stripeOrderConfirmation.blockingCount,
        baseline.stripeOrderConfirmation.blockingCount + 1,
    );
    assert.strictEqual(
        bothQueued.statusCounts.queued,
        baseline.statusCounts.queued + 2,
    );

    await setOutputStatus(
        database,
        pair.orderId,
        'sent',
        new Date('2001-01-01T00:01:00.000Z'),
    );
    const oneSentState = await readPairState();
    const oneSent = await getStripePaymentCompletionRollbackPreflight(database);
    assert.deepEqual(await readPairState(), oneSentState);
    assert.strictEqual(oneSent.blockingCount, baseline.blockingCount + 1);
    assert.strictEqual(
        oneSent.purchaseSlack.blockingCount,
        baseline.purchaseSlack.blockingCount + 1,
    );
    assert.strictEqual(
        oneSent.stripeOrderConfirmation.blockingCount,
        baseline.stripeOrderConfirmation.blockingCount,
    );
    assert.strictEqual(
        oneSent.statusCounts.queued,
        baseline.statusCounts.queued + 1,
    );

    await setOutputStatus(
        database,
        pair.purchaseId,
        'sent',
        new Date('2001-01-01T00:02:00.000Z'),
    );
    const bothSentState = await readPairState();
    const bothSent =
        await getStripePaymentCompletionRollbackPreflight(database);
    assert.deepEqual(bothSent, baseline);
    assert.deepEqual(await readPairState(), bothSentState);
});
