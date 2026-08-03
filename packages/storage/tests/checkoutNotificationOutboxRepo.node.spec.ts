import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    checkoutNotificationOutboxKind,
    claimCheckoutNotification,
    emailMessages,
    enqueueCheckoutDeliveryNotifications,
    enqueueCheckoutOperationScheduledNotification,
    getCheckoutNotificationOutboxHealth,
    markCheckoutNotificationFailed,
    markCheckoutNotificationSent,
    startCheckoutNotificationSubmission,
    storage,
    users,
} from '@gredice/storage';
import { sql } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test.afterEach(async () => {
    await storage()
        .delete(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
        );
});

async function enqueueOperation(operationId: number) {
    return await storage().transaction(async (tx) =>
        enqueueCheckoutOperationScheduledNotification(
            {
                operationId,
                scheduledDate: new Date('2026-08-04T08:00:00.000Z'),
            },
            tx,
        ),
    );
}

test('concurrent enqueue of one intent produces exactly one durable row', async () => {
    createTestDb();
    const ids = await Promise.all(
        Array.from({ length: 8 }, () => enqueueOperation(43_750)),
    );

    assert.equal(new Set(ids).size, 1);
    const rows = await storage()
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind} and ${emailMessages.metadata}->>'operationId' = '43750'`,
        );
    assert.equal(rows.length, 1);
});

test('delivery email grouping preserves the checkout eligibility rule', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const secondAccountId = await createTestAccount();
    const userId = randomUUID();
    await storage().insert(users).values({
        id: userId,
        role: 'user',
        userName: '  CHECKOUT@example.test ',
    });
    await storage().insert(accountUsers).values({ accountId, userId });
    await storage()
        .insert(accountUsers)
        .values({ accountId: secondAccountId, userId });

    const enqueueDelivery = async ({
        targetAccountId = accountId,
        addressId = 12,
        mode = 'delivery',
        slotId = 34,
    }: {
        targetAccountId?: string;
        addressId?: number;
        mode?: 'delivery' | 'pickup';
        slotId?: number;
    } = {}) => {
        await storage().transaction(async (tx) =>
            enqueueCheckoutDeliveryNotifications(
                {
                    accountId: targetAccountId,
                    addressId,
                    mode,
                    requestId: randomUUID(),
                    slotId,
                },
                tx,
            ),
        );
    };
    await enqueueDelivery();
    await enqueueDelivery();
    await enqueueDelivery({ addressId: 13 });
    await enqueueDelivery({ slotId: 35 });
    await enqueueDelivery({ targetAccountId: secondAccountId });
    await enqueueDelivery({ mode: 'pickup' });

    const rows = await storage()
        .select({
            kind: sql<string>`${emailMessages.metadata}->>'notificationKind'`,
            recipients: emailMessages.recipients,
        })
        .from(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
        );
    assert.equal(
        rows.filter(({ kind }) => kind === 'delivery_created_slack').length,
        6,
    );
    const emails = rows.filter(
        ({ kind }) => kind === 'delivery_scheduled_email',
    );
    assert.equal(emails.length, 4);
    assert.ok(
        emails.every(
            (email) =>
                email.recipients.to[0]?.address === 'checkout@example.test',
        ),
    );
});

test('provider uncertainty is fenced from normal claims and visible in health', async () => {
    createTestDb();
    const now = new Date('2026-08-03T09:00:00.000Z');
    await enqueueOperation(43_751);
    const claimed = await claimCheckoutNotification({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-one',
        now,
    });
    assert.equal(claimed.status, 'claimed');
    if (claimed.status !== 'claimed') throw new Error('Expected claim');
    assert.equal(
        (
            await startCheckoutNotificationSubmission({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                now: new Date(now.getTime() + 1_000),
            })
        ).status,
        'started',
    );
    assert.equal(
        (
            await markCheckoutNotificationFailed({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                failureCode: 'provider_submission_uncertain',
                failureKind: 'uncertain',
                now: new Date(now.getTime() + 2_000),
            })
        ).status,
        'fenced',
    );

    assert.equal(
        (
            await claimCheckoutNotification({
                claimExpiresAt: new Date(now.getTime() + 600_000),
                claimId: 'worker-two',
                now: new Date(now.getTime() + 500_000),
            })
        ).status,
        'empty',
    );
    const health = await getCheckoutNotificationOutboxHealth({
        now: new Date(now.getTime() + 700_000),
        staleBefore: new Date(now.getTime() + 600_000),
    });
    assert.equal(health.fencedCount, 1);
    assert.equal(health.staleFencedCount, 1);
});

test('sent history is excluded from actionable outbox health', async () => {
    createTestDb();
    const now = new Date('2026-08-03T10:00:00.000Z');
    await enqueueOperation(43_752);
    const claimed = await claimCheckoutNotification({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-sent',
        now,
    });
    assert.equal(claimed.status, 'claimed');
    if (claimed.status !== 'claimed') throw new Error('Expected claim');
    await startCheckoutNotificationSubmission({
        claimId: claimed.claim.claimId,
        emailMessageId: claimed.claim.emailMessageId,
        now: new Date(now.getTime() + 1_000),
    });
    await markCheckoutNotificationSent({
        claimId: claimed.claim.claimId,
        emailMessageId: claimed.claim.emailMessageId,
        now: new Date(now.getTime() + 2_000),
        providerStatus: 'accepted',
    });

    assert.deepEqual(
        await getCheckoutNotificationOutboxHealth({
            now: new Date(now.getTime() + 3_000),
            staleBefore: now,
        }),
        {
            claimedCount: 0,
            dueCount: 0,
            failedCount: 0,
            fencedCount: 0,
            oldestDueAt: null,
            oldestFencedAt: null,
            observedAt: new Date(now.getTime() + 3_000).toISOString(),
            queuedCount: 0,
            retryExhaustedCount: 0,
            staleClaimedCount: 0,
            staleFencedCount: 0,
        },
    );
});
