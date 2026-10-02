import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray, sql } from 'drizzle-orm';
import { withDueWorkCommitSignals } from '../src/dueWork';
import { markAccountDeletionStarted } from '../src/repositories/accountDeletionFenceRepo';
import {
    createAutomationRun,
    retryFailedAutomationRun,
} from '../src/repositories/automationsRepo';
import { enqueueCheckoutOperationScheduledNotification } from '../src/repositories/checkoutNotificationOutboxRepo';
import {
    createEmailMessageLog,
    updateEmailMessageLog,
} from '../src/repositories/emailsRepo';
import { markCartPaidAndEnqueueOrderConfirmation } from '../src/repositories/orderConfirmationOutboxRepo';
import {
    getOrCreateShoppingCart,
    setCartItemPaid,
    upsertOrRemoveCartItem,
} from '../src/repositories/shoppingCartRepo';
import { setStripeCheckoutAttemptReconciliationCursor } from '../src/repositories/stripeCheckoutAttemptRepo';
import { ensureStripePaymentCompletionOutputs } from '../src/repositories/stripePaymentCompletionOutputsRepo';
import {
    automationDefinitions,
    automationRuns,
    emailMessages,
    stripePaymentProcessingClaims,
} from '../src/schema';
import { storage } from '../src/storage';
import { createTestAccount } from './helpers/testHelpers';

const paymentIds = new Set<string>();
const messageIds = new Set<number>();
test.afterEach(async () => {
    for (const paymentId of paymentIds) {
        await storage()
            .delete(stripePaymentProcessingClaims)
            .where(
                eq(stripePaymentProcessingClaims.stripePaymentId, paymentId),
            );
        await storage()
            .delete(emailMessages)
            .where(
                sql`${emailMessages.metadata}->>'stripePaymentId' = ${paymentId}`,
            );
    }
    if (messageIds.size)
        await storage()
            .delete(emailMessages)
            .where(inArray(emailMessages.id, [...messageIds]));
    paymentIds.clear();
    messageIds.clear();
});

async function paymentFixture() {
    const stripePaymentId = `cs_test_due_${randomUUID()}`;
    paymentIds.add(stripePaymentId);
    const claimToken = randomUUID();
    const now = new Date();
    await storage()
        .insert(stripePaymentProcessingClaims)
        .values({
            stripePaymentId,
            claimToken,
            status: 'processing',
            leaseExpiresAt: new Date(now.getTime() + 300_000),
        });
    return {
        stripePaymentId,
        claimToken,
        now,
        orderConfirmation: {
            cartId: null,
            currency: 'eur',
            items: [],
            manageUrl: 'https://vrt.gredice.com/',
            to: 'test@example.test',
            totalAmountCents: 100,
        },
        purchaseNotification: {
            accountId: null,
            amountTotal: 100,
            checkoutSessionId: stripePaymentId,
            currency: 'eur',
            customerEmail: 'test@example.test',
            items: [],
        },
    };
}

test('normal Stripe completion publishes both durable queues after commit and idempotent replay publishes nothing', async () => {
    const fixture = await paymentFixture();
    const published: Array<[string, number]> = [];
    const publish = async (job: string, dueAt: number) => {
        const claim =
            await storage().query.stripePaymentProcessingClaims.findFirst({
                where: eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    fixture.stripePaymentId,
                ),
            });
        assert.ok(claim?.orderConfirmationEmailMessageId);
        assert.ok(claim.purchaseNotificationEmailMessageId);
        published.push([job, dueAt]);
    };
    const result = await withDueWorkCommitSignals(async () => {
        const result = await ensureStripePaymentCompletionOutputs(fixture);
        assert.equal(published.length, 0);
        return result;
    }, publish);
    assert.equal(result.status, 'ready');
    assert.deepEqual(published.sort(), [
        ['checkout-notifications', fixture.now.getTime()],
        ['order-confirmation-emails', fixture.now.getTime()],
    ]);
    published.length = 0;
    const replay = await withDueWorkCommitSignals(
        () => ensureStripePaymentCompletionOutputs(fixture),
        publish,
    );
    assert.equal(replay.status, 'ready');
    assert.deepEqual(published, []);
});

test('rolled-back payment completion produces neither queued output nor a dispatch hint', async () => {
    const fixture = await paymentFixture();
    const published: string[] = [];
    await assert.rejects(
        withDueWorkCommitSignals(
            () =>
                storage().transaction(async (tx) => {
                    const result = await ensureStripePaymentCompletionOutputs({
                        ...fixture,
                        database: tx,
                    });
                    assert.equal(result.status, 'ready');
                    assert.equal(published.length, 0);
                    throw new Error('payment completion rollback');
                }),
            async (job) => {
                published.push(job);
            },
        ),
    );
    assert.deepEqual(published, []);
    const rows = await storage()
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
            sql`${emailMessages.metadata}->>'stripePaymentId' = ${fixture.stripePaymentId}`,
        );
    assert.deepEqual(rows, []);
    const claim = await storage().query.stripePaymentProcessingClaims.findFirst(
        {
            where: eq(
                stripePaymentProcessingClaims.stripePaymentId,
                fixture.stripePaymentId,
            ),
        },
    );
    assert.equal(claim?.orderConfirmationEmailMessageId, null);
    assert.equal(claim?.purchaseNotificationEmailMessageId, null);
});

test('checkout operation outbox and generic queued outbox rows signal, while ordinary email logs do not', async () => {
    const published: string[] = [];
    const publish = async (job: string) => {
        published.push(job);
    };
    await withDueWorkCommitSignals(
        () =>
            storage().transaction(async (tx) => {
                messageIds.add(
                    await enqueueCheckoutOperationScheduledNotification(
                        { operationId: 9_000_001, scheduledDate: new Date() },
                        tx,
                    ),
                );
                assert.deepEqual(published, []);
            }),
        publish,
    );
    assert.deepEqual(published, ['checkout-notifications']);
    published.length = 0;
    await assert.rejects(
        withDueWorkCommitSignals(
            () =>
                storage().transaction(async (tx) => {
                    await enqueueCheckoutOperationScheduledNotification(
                        { operationId: 9_000_002, scheduledDate: new Date() },
                        tx,
                    );
                    throw new Error('operation rollback');
                }),
            publish,
        ),
    );
    assert.deepEqual(published, []);
    const message = {
        fromAddress: 'test@example.test',
        subject: 'Test',
        recipients: { to: [] },
    };
    await withDueWorkCommitSignals(async () => {
        messageIds.add((await createEmailMessageLog(message)).id);
    }, publish);
    assert.deepEqual(published, []);
    const row = await withDueWorkCommitSignals(
        () =>
            createEmailMessageLog({
                ...message,
                metadata: { outboxKind: 'order_confirmation' },
            }),
        publish,
    );
    messageIds.add(row.id);
    assert.deepEqual(published, ['order-confirmation-emails']);
    published.length = 0;
    await updateEmailMessageLog(row.id, { status: 'failed' });
    await withDueWorkCommitSignals(
        () => updateEmailMessageLog(row.id, { status: 'queued' }),
        publish,
    );
    assert.deepEqual(published, ['order-confirmation-emails']);
});

test('ordinary paid-cart confirmation signals only its committed enqueue and replay stays quiet', async () => {
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        `due-item-${cart.id}`,
        'plantSort',
        1,
    );
    assert.ok(itemId);
    await setCartItemPaid(itemId);
    const published: string[] = [];
    const publish = async (job: string) => {
        published.push(job);
    };
    const input = {
        cartId: cart.id,
        payload: {
            cartId: cart.id,
            currency: null,
            items: [],
            manageUrl: 'https://vrt.gredice.com/',
            to: 'test@example.test',
            totalAmountCents: null,
        },
    };
    const result = await withDueWorkCommitSignals(async () => {
        const result = await markCartPaidAndEnqueueOrderConfirmation(input);
        assert.equal(published.length, 0);
        return result;
    }, publish);
    assert.equal(result.status, 'enqueued');
    if (result.status === 'enqueued') messageIds.add(result.emailMessageId);
    assert.deepEqual(published, ['order-confirmation-emails']);
    published.length = 0;
    assert.equal(
        (
            await withDueWorkCommitSignals(
                () => markCartPaidAndEnqueueOrderConfirmation(input),
                publish,
            )
        ).status,
        'already_paid',
    );
    assert.deepEqual(published, []);
});

test('Admin manual automation retry signals its exact eligibility timestamp', async () => {
    const [definition] = await storage()
        .insert(automationDefinitions)
        .values({
            key: `due-retry-${randomUUID()}`,
            name: 'Due retry test',
            graph: { nodes: [], edges: [] },
        })
        .returning();
    assert.ok(definition);
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'manual',
    });
    assert.ok(run);
    await storage()
        .update(automationRuns)
        .set({ status: 'failed' })
        .where(eq(automationRuns.id, run.id));
    const dueAt = new Date(Date.now() + 60_000);
    const published: Array<[string, number]> = [];
    const updated = await withDueWorkCommitSignals(
        () => retryFailedAutomationRun({ id: run.id, retryAt: dueAt }),
        async (job, due) => {
            published.push([job, due]);
        },
    );
    assert.equal(updated?.status, 'retrying');
    assert.deepEqual(published, [['automations', dueAt.getTime()]]);
    await storage().delete(automationRuns).where(eq(automationRuns.id, run.id));
    await storage()
        .delete(automationDefinitions)
        .where(eq(automationDefinitions.id, definition.id));
});

test('raw domain events publish after commit, while replay and rollback publish nothing', async () => {
    const accountId = await createTestAccount();
    const published: string[] = [];
    const publish = async (job: string) => {
        published.push(job);
    };
    await withDueWorkCommitSignals(
        () =>
            storage().transaction(async (tx) => {
                assert.equal(
                    await markAccountDeletionStarted(accountId, tx),
                    true,
                );
                assert.deepEqual(published, []);
            }),
        publish,
    );
    assert.deepEqual(published, ['automations']);
    published.length = 0;
    await withDueWorkCommitSignals(
        () =>
            storage().transaction(async (tx) => {
                assert.equal(
                    await markAccountDeletionStarted(accountId, tx),
                    false,
                );
            }),
        publish,
    );
    assert.deepEqual(published, []);
    const rolledBackAccount = await createTestAccount();
    await assert.rejects(
        withDueWorkCommitSignals(
            () =>
                storage().transaction(async (tx) => {
                    await markAccountDeletionStarted(rolledBackAccount, tx);
                    throw new Error('domain event rollback');
                }),
            publish,
        ),
    );
    assert.deepEqual(published, []);
});

test('an identical empty cursor reset writes neither event nor automation hint', async () => {
    await setStripeCheckoutAttemptReconciliationCursor(88);
    await setStripeCheckoutAttemptReconciliationCursor(null);
    const published: string[] = [];
    assert.equal(
        await withDueWorkCommitSignals(
            () => setStripeCheckoutAttemptReconciliationCursor(null),
            async (job) => {
                published.push(job);
            },
        ),
        undefined,
    );
    assert.deepEqual(published, []);
});
