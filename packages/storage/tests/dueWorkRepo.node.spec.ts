import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { getNextDueWorkAt } from '../src/repositories/dueWorkRepo';
import {
    createSocialPost,
    updateSocialPostStatus,
} from '../src/repositories/socialPostsRepo';
import {
    emailMessages,
    notificationDeliveryAttempts,
    notifications,
    socialPosts,
    users,
} from '../src/schema';
import { storage } from '../src/storage';
import { createTestAccount } from './helpers/testHelpers';

test('outbox due projections retain retry and claim/reconciliation deadlines without resending submissions', async () => {
    const db = storage();
    await db
        .update(emailMessages)
        .set({ status: 'sent' })
        .where(inArray(emailMessages.status, ['queued', 'sending']));
    const now = new Date('2026-10-02T12:00:00.000Z');
    const future = new Date(now.getTime() + 60_000);
    for (const kind of ['order_confirmation', 'checkout_notification']) {
        const job =
            kind === 'order_confirmation'
                ? 'order-confirmation-emails'
                : 'checkout-notifications';
        const [row] = await db
            .insert(emailMessages)
            .values({
                fromAddress: 'no-reply@example.test',
                subject: 'Due work test',
                recipients: { to: [{ address: 'test@example.test' }] },
                status: 'queued',
                queuedAt: now,
                metadata: {
                    outboxKind: kind,
                    nextAttemptAt: future.toISOString(),
                },
            })
            .returning({ id: emailMessages.id });
        assert.ok(row);
        try {
            assert.equal(
                (await getNextDueWorkAt(job, now))?.toISOString(),
                future.toISOString(),
            );
            await db
                .update(emailMessages)
                .set({
                    status: 'sending',
                    providerStatus: 'outbox_claimed',
                    metadata: {
                        outboxKind: kind,
                        claimExpiresAt: future.toISOString(),
                    },
                })
                .where(eq(emailMessages.id, row.id));
            assert.equal(
                (await getNextDueWorkAt(job, now))?.toISOString(),
                future.toISOString(),
            );
            await db
                .update(emailMessages)
                .set({
                    providerStatus: 'submission_started',
                    updatedAt: now,
                    metadata: {
                        outboxKind: kind,
                        submissionStartedAt: now.toISOString(),
                    },
                })
                .where(eq(emailMessages.id, row.id));
            assert.equal(
                (await getNextDueWorkAt(job, now))?.toISOString() ?? null,
                kind === 'order_confirmation'
                    ? new Date(now.getTime() + 300_000).toISOString()
                    : null,
            );
            if (kind === 'order_confirmation') {
                await db
                    .update(emailMessages)
                    .set({
                        providerStatus: 'reconciliation_pending',
                        metadata: {
                            outboxKind: kind,
                            nextReconciliationAt: future.toISOString(),
                        },
                    })
                    .where(eq(emailMessages.id, row.id));
                assert.equal(
                    (await getNextDueWorkAt(job, now))?.toISOString(),
                    future.toISOString(),
                );
                await db
                    .update(emailMessages)
                    .set({
                        providerStatus: 'reconciliation_claimed',
                        metadata: {
                            outboxKind: kind,
                            reconciliationClaimExpiresAt: future.toISOString(),
                        },
                    })
                    .where(eq(emailMessages.id, row.id));
                assert.equal(
                    (await getNextDueWorkAt(job, now))?.toISOString(),
                    future.toISOString(),
                );
            }
            await db
                .update(emailMessages)
                .set({ status: 'sent' })
                .where(eq(emailMessages.id, row.id));
            assert.equal(await getNextDueWorkAt(job, now), null);
        } finally {
            await db.delete(emailMessages).where(eq(emailMessages.id, row.id));
        }
    }
});

test('outbox due projections safely validate metadata timestamps and retain missing-value fallbacks', async () => {
    const db = storage();
    await db
        .update(emailMessages)
        .set({ status: 'sent' })
        .where(inArray(emailMessages.status, ['queued', 'sending']));
    const now = new Date('2026-10-02T12:00:00.000Z');
    const queuedAt = new Date(now.getTime() - 3_600_000);
    const updatedAt = new Date(now.getTime() - 120_000);
    const cases = [
        {
            field: 'nextAttemptAt',
            status: 'queued',
            providerStatus: null,
            fallback: queuedAt,
        },
        {
            field: 'claimExpiresAt',
            status: 'sending',
            providerStatus: 'outbox_claimed',
            fallback: now,
        },
        {
            field: 'submissionStartedAt',
            status: 'sending',
            providerStatus: 'submission_started',
            fallback: new Date(updatedAt.getTime() + 300_000),
        },
        {
            field: 'submissionUncertainAt',
            status: 'sending',
            providerStatus: 'submission_uncertain',
            fallback: new Date(updatedAt.getTime() + 300_000),
        },
        {
            field: 'nextReconciliationAt',
            status: 'sending',
            providerStatus: 'reconciliation_pending',
            fallback: now,
        },
        {
            field: 'reconciliationClaimExpiresAt',
            status: 'sending',
            providerStatus: 'reconciliation_claimed',
            fallback: now,
        },
    ];
    for (const kind of ['order_confirmation', 'checkout_notification']) {
        const job =
            kind === 'order_confirmation'
                ? 'order-confirmation-emails'
                : 'checkout-notifications';
        const [row] = await db
            .insert(emailMessages)
            .values({
                fromAddress: 'no-reply@example.test',
                subject: 'Metadata validation test',
                recipients: { to: [{ address: 'test@example.test' }] },
                status: 'queued',
                queuedAt,
                updatedAt,
                metadata: { outboxKind: kind },
            })
            .returning({ id: emailMessages.id });
        assert.ok(row);
        try {
            for (const scenario of cases) {
                if (
                    kind === 'checkout_notification' &&
                    scenario.field !== 'nextAttemptAt' &&
                    scenario.field !== 'claimExpiresAt'
                )
                    continue;
                for (const value of [
                    'not-a-date',
                    '2026-garbage',
                    '2026-99-99T00:00:00Z',
                    '2026-02-29T12:00:00Z',
                    'infinity',
                    '-infinity',
                    '294276-12-31 23:59:59+00',
                    '275761-01-01 00:00:00+00',
                ]) {
                    await db
                        .update(emailMessages)
                        .set({
                            status: scenario.status,
                            providerStatus: scenario.providerStatus,
                            updatedAt,
                            metadata: {
                                outboxKind: kind,
                                [scenario.field]: value,
                            },
                        })
                        .where(eq(emailMessages.id, row.id));
                    assert.equal(
                        (await getNextDueWorkAt(job, now))?.toISOString(),
                        now.toISOString(),
                        `${kind}/${scenario.field}/${value}`,
                    );
                }
                for (const value of [undefined, null, '']) {
                    await db
                        .update(emailMessages)
                        .set({
                            status: scenario.status,
                            providerStatus: scenario.providerStatus,
                            updatedAt,
                            metadata: {
                                outboxKind: kind,
                                [scenario.field]: value,
                            },
                        })
                        .where(eq(emailMessages.id, row.id));
                    assert.equal(
                        (await getNextDueWorkAt(job, now))?.toISOString(),
                        scenario.fallback.toISOString(),
                        `${kind}/${scenario.field}/missing:${value}`,
                    );
                }
                const future = new Date(now.getTime() + 60_000);
                await db
                    .update(emailMessages)
                    .set({
                        status: scenario.status,
                        providerStatus: scenario.providerStatus,
                        updatedAt,
                        metadata: {
                            outboxKind: kind,
                            [scenario.field]: future.toISOString(),
                        },
                    })
                    .where(eq(emailMessages.id, row.id));
                const expectedDueAt = new Date(
                    future.getTime() +
                        (scenario.providerStatus?.startsWith('submission_')
                            ? 300_000
                            : 0),
                );
                assert.equal(
                    (await getNextDueWorkAt(job, now))?.toISOString(),
                    expectedDueAt.toISOString(),
                    `${kind}/${scenario.field}/valid`,
                );
                if (scenario.providerStatus?.startsWith('submission_')) {
                    await db
                        .update(emailMessages)
                        .set({
                            metadata: {
                                outboxKind: kind,
                                [scenario.field]: '275760-09-12 23:59:59+00',
                            },
                        })
                        .where(eq(emailMessages.id, row.id));
                    assert.equal(
                        (await getNextDueWorkAt(job, now))?.toISOString(),
                        now.toISOString(),
                        `${kind}/${scenario.field}/delay-outside-Date-range`,
                    );
                }
            }
        } finally {
            await db.delete(emailMessages).where(eq(emailMessages.id, row.id));
        }
    }
});

test('social due projection respects scheduled time and immediately queued status', async () => {
    const db = storage();
    await db
        .update(socialPosts)
        .set({ status: 'published' })
        .where(inArray(socialPosts.status, ['queued', 'scheduled']));
    const now = new Date();
    const future = new Date(now.getTime() + 3_600_000);
    const post = await createSocialPost({
        provider: 'facebook',
        providerAccountKey: 'test',
        destination: 'test',
        postType: 'text',
        status: 'scheduled',
        scheduledAt: future,
    });
    try {
        assert.equal(
            (await getNextDueWorkAt('social-publishing', now))?.toISOString(),
            future.toISOString(),
        );
        await updateSocialPostStatus({ id: post.id, status: 'queued' });
        assert.equal(
            (await getNextDueWorkAt('social-publishing', now))?.toISOString(),
            now.toISOString(),
        );
        await updateSocialPostStatus({ id: post.id, status: 'published' });
        assert.equal(await getNextDueWorkAt('social-publishing', now), null);
    } finally {
        await db.delete(socialPosts).where(eq(socialPosts.id, post.id));
    }
});

test('delivery quiet-hours scheduling excludes expired and uncertain submissions', async () => {
    const db = storage();
    const accountId = await createTestAccount();
    const userId = randomUUID();
    await db.insert(users).values({
        id: userId,
        userName: `${userId}@example.test`,
        role: 'user',
    });
    const now = new Date();
    const future = new Date(now.getTime() + 3_600_000);
    const notificationId = randomUUID();
    // Other files share this disposable database; expire their notification
    // fixtures before exercising this projection's sole eligible recipient.
    await db
        .update(notifications)
        .set({ timestamp: new Date(now.getTime() - 86_400_000) })
        .where(eq(notifications.category, 'delivery_updates'));
    await db.insert(notifications).values({
        id: notificationId,
        accountId,
        userId,
        header: 'Delivery',
        content: 'Test',
        category: 'delivery_updates',
        type: 'delivery_lifecycle',
        timestamp: now,
        ttlSeconds: 86_400,
    });
    const [attempt] = await db
        .insert(notificationDeliveryAttempts)
        .values({
            notificationId,
            accountId,
            userId,
            provider: 'delivery_lifecycle_email',
            channel: 'email',
            status: 'queued',
            providerResponseCode: 'quiet_hours',
            attemptedAt: future,
        })
        .returning({ id: notificationDeliveryAttempts.id });
    assert.ok(attempt);
    try {
        assert.equal(
            (
                await getNextDueWorkAt('delivery-lifecycle-emails', now)
            )?.toISOString(),
            future.toISOString(),
        );
        await db
            .update(notifications)
            .set({ timestamp: new Date(now.getTime() - 86_400_000) })
            .where(eq(notifications.id, notificationId));
        assert.equal(
            await getNextDueWorkAt('delivery-lifecycle-emails', now),
            null,
        );
        await db
            .update(notifications)
            .set({ timestamp: now })
            .where(eq(notifications.id, notificationId));
        await db
            .update(notificationDeliveryAttempts)
            .set({ providerResponseCode: 'sending' })
            .where(eq(notificationDeliveryAttempts.id, attempt.id));
        assert.equal(
            await getNextDueWorkAt('delivery-lifecycle-emails', now),
            null,
        );
    } finally {
        await db
            .delete(notifications)
            .where(eq(notifications.id, notificationId));
        await db.delete(users).where(eq(users.id, userId));
    }
});
