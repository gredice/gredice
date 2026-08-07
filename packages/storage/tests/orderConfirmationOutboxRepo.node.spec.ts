import assert from 'node:assert/strict';
import test from 'node:test';
import {
    claimOrderConfirmationEmail,
    claimOrderConfirmationEmailReconciliation,
    emailMessages,
    finalizeOrderConfirmationEmailReconciliation,
    getEmailMessage,
    getOrderConfirmationOutboxHealthSnapshot,
    getShoppingCart,
    markCartPaidAndEnqueueOrderConfirmation,
    markOrderConfirmationEmailFailed,
    markOrderConfirmationEmailSent,
    orderConfirmationEmailReconciliationMaxClaimLeaseMs,
    setCartItemPaid,
    shoppingCarts,
    startOrderConfirmationEmailSubmission,
    storage,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import { eq, sql } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test.afterEach(async () => {
    await storage()
        .delete(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'outboxKind' = 'order_confirmation'`,
        );
});

const operationIds = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005',
] as const;

async function createCart({ ready = true }: { ready?: boolean } = {}) {
    const accountId = await createTestAccount();
    const { getOrCreateShoppingCart } = await import('@gredice/storage');
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        `outbox-item-${cart.id.toString()}`,
        'plantSort',
        1,
    );
    assert.ok(itemId);
    if (ready) {
        await setCartItemPaid(itemId);
    }
    return { cartId: cart.id, itemId };
}

function payload(cartId: number) {
    return {
        cartId,
        currency: null,
        items: [
            {
                amountSubtotal: 25,
                currency: 'sunflower',
                name: 'Suncokret',
                quantity: 1,
            },
        ],
        manageUrl: 'https://vrt.gredice.com',
        to: `checkout-${cartId.toString()}@example.test`,
        totalAmountCents: null,
    };
}

async function enqueueReadyCart(
    operationId: string = operationIds[0],
    now = new Date('2026-08-03T08:00:00.000Z'),
) {
    const { cartId } = await createCart();
    const result = await markCartPaidAndEnqueueOrderConfirmation({
        cartId,
        now,
        operationId,
        payload: payload(cartId),
    });
    assert.equal(result.status, 'enqueued');
    if (result.status !== 'enqueued') {
        throw new Error('Expected an enqueued order confirmation');
    }
    return { cartId, emailMessageId: result.emailMessageId };
}

async function fenceProviderSubmission({
    claimId,
    now,
    operationId = operationIds[0],
    uncertain = false,
}: {
    claimId: string;
    now: Date;
    operationId?: string;
    uncertain?: boolean;
}) {
    const enqueued = await enqueueReadyCart(operationId, now);
    const deliveryClaim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId,
        now,
    });
    assert.equal(deliveryClaim.status, 'claimed');
    if (deliveryClaim.status !== 'claimed') {
        throw new Error('Expected a delivery claim');
    }
    const startedAt = new Date(now.getTime() + 1_000);
    assert.equal(
        (
            await startOrderConfirmationEmailSubmission({
                claimId,
                emailMessageId: enqueued.emailMessageId,
                now: startedAt,
            })
        ).status,
        'started',
    );
    const fencedAt = uncertain ? new Date(now.getTime() + 2_000) : startedAt;
    if (uncertain) {
        assert.deepEqual(
            await markOrderConfirmationEmailFailed({
                claimId,
                emailMessageId: enqueued.emailMessageId,
                failureCode: 'provider_submission_uncertain',
                failureKind: 'uncertain',
                now: fencedAt,
            }),
            { status: 'fenced' },
        );
    }

    return { ...enqueued, fencedAt };
}

test('cart payment transition and confirmation enqueue are one idempotent operation', async () => {
    createTestDb();
    const now = new Date('2026-08-03T08:00:00.000Z');
    const { cartId } = await createCart();

    const first = await markCartPaidAndEnqueueOrderConfirmation({
        cartId,
        now,
        operationId: operationIds[0],
        payload: payload(cartId),
    });
    assert.equal(first.status, 'enqueued');
    if (first.status !== 'enqueued') {
        throw new Error('Expected an enqueued order confirmation');
    }

    const replay = await markCartPaidAndEnqueueOrderConfirmation({
        cartId,
        now: new Date(now.getTime() + 1_000),
        operationId: operationIds[1],
        payload: payload(cartId),
    });
    assert.deepEqual(replay, {
        emailMessageId: first.emailMessageId,
        operationId: operationIds[0],
        status: 'already_paid',
    });

    const cart = await getShoppingCart(cartId);
    assert.equal(cart?.status, 'paid');
    const messages = await storage()
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'cartId' = ${cartId.toString()}`,
        );
    assert.deepEqual(messages, [{ id: first.emailMessageId }]);
});

test('a cart with unpaid items is not transitioned or enqueued', async () => {
    createTestDb();
    const { cartId } = await createCart({ ready: false });

    const result = await markCartPaidAndEnqueueOrderConfirmation({
        cartId,
        operationId: operationIds[0],
        payload: payload(cartId),
    });

    assert.deepEqual(result, { status: 'cart_not_ready' });
    assert.equal((await getShoppingCart(cartId))?.status, 'new');
    const messages = await storage()
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
            sql<boolean>`${emailMessages.metadata}->>'cartId' = ${cartId.toString()}`,
        );
    assert.deepEqual(messages, []);
});

test('claimed confirmation is fenced before submission and finalized sent', async () => {
    createTestDb();
    const now = new Date('2026-08-03T09:00:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[1], now);
    const claim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-sent',
        now,
    });
    assert.equal(claim.status, 'claimed');
    if (claim.status !== 'claimed') {
        throw new Error('Expected a claimed order confirmation');
    }
    assert.equal(claim.claim.emailMessageId, emailMessageId);
    assert.equal(claim.claim.operationId, operationIds[1]);
    assert.equal(claim.claim.queuedAt.toISOString(), now.toISOString());
    assert.equal(claim.claim.payload.to.includes('@'), true);

    assert.deepEqual(
        await startOrderConfirmationEmailSubmission({
            claimId: claim.claim.claimId,
            emailMessageId,
            now: new Date(now.getTime() + 1_000),
        }),
        { operationId: operationIds[1], status: 'started' },
    );
    assert.deepEqual(
        await markOrderConfirmationEmailSent({
            claimId: claim.claim.claimId,
            emailMessageId,
            now: new Date(now.getTime() + 2_000),
            providerStatus: 'Succeeded',
        }),
        { status: 'sent' },
    );

    const stored = await getEmailMessage(emailMessageId);
    assert.equal(stored?.status, 'sent');
    assert.equal(stored?.providerStatus, 'Succeeded');
    assert.ok(stored?.completedAt);
    assert.ok(stored?.sentAt);
});

test('only proven-safe failures retry and attempts are bounded', async () => {
    createTestDb();
    let now = new Date('2026-08-03T10:00:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[2], now);

    for (let expectedAttempt = 1; expectedAttempt <= 3; expectedAttempt += 1) {
        const claim = await claimOrderConfirmationEmail({
            claimExpiresAt: new Date(now.getTime() + 60_000),
            claimId: `worker-retry-${expectedAttempt.toString()}`,
            now,
        });
        assert.equal(claim.status, 'claimed');
        if (claim.status !== 'claimed') {
            throw new Error('Expected a claimed order confirmation');
        }
        assert.equal(claim.claim.attempt, expectedAttempt);
        assert.equal(
            (
                await startOrderConfirmationEmailSubmission({
                    claimId: claim.claim.claimId,
                    emailMessageId,
                    now: new Date(now.getTime() + 1_000),
                })
            ).status,
            'started',
        );

        const failedAt = new Date(now.getTime() + 2_000);
        const failure = await markOrderConfirmationEmailFailed({
            claimId: claim.claim.claimId,
            emailMessageId,
            failureCode: 'provider_rejected_retryable',
            failureKind: 'definite',
            now: failedAt,
        });
        if (expectedAttempt < 3) {
            assert.equal(failure.status, 'retry_scheduled');
            if (failure.status !== 'retry_scheduled') {
                throw new Error('Expected a scheduled retry');
            }
            assert.equal(
                (
                    await claimOrderConfirmationEmail({
                        claimExpiresAt: new Date(
                            failure.nextAttemptAt.getTime() + 60_000,
                        ),
                        claimId: 'too-early',
                        now: new Date(failure.nextAttemptAt.getTime() - 1),
                    })
                ).status,
                'empty',
            );
            now = failure.nextAttemptAt;
        } else {
            assert.deepEqual(failure, {
                attempt: expectedAttempt,
                status: 'failed',
            });
        }
    }

    const stored = await getEmailMessage(emailMessageId);
    assert.equal(stored?.status, 'failed');
    assert.equal(stored?.providerStatus, 'retry_exhausted');
    assert.equal(stored?.metadata.attemptCount, 3);
});

test('configuration failures defer indefinitely without consuming delivery attempts', async () => {
    createTestDb();
    let now = new Date('2026-08-03T10:30:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[3], now);

    for (let deferral = 1; deferral <= 5; deferral += 1) {
        const claim = await claimOrderConfirmationEmail({
            claimExpiresAt: new Date(now.getTime() + 60_000),
            claimId: `worker-configuration-${deferral.toString()}`,
            now,
        });
        assert.equal(claim.status, 'claimed');
        if (claim.status !== 'claimed') {
            throw new Error('Expected a claimed order confirmation');
        }
        assert.equal(claim.claim.attempt, 1);

        const failedAt = new Date(now.getTime() + 1_000);
        const nextAttemptAt = new Date(failedAt.getTime() + 60_000);
        assert.deepEqual(
            await markOrderConfirmationEmailFailed({
                claimId: claim.claim.claimId,
                emailMessageId,
                failureCode: 'configuration_error',
                failureKind: 'definite',
                now: failedAt,
            }),
            { attempt: 1, nextAttemptAt, status: 'retry_scheduled' },
        );

        const deferred = await getEmailMessage(emailMessageId);
        assert.equal(deferred?.metadata.attemptCount, 0);
        assert.equal(deferred?.status, 'queued');
        now = nextAttemptAt;
    }

    const restoredClaim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-configuration-restored',
        now,
    });
    assert.equal(restoredClaim.status, 'claimed');
    if (restoredClaim.status !== 'claimed') {
        throw new Error(
            'Expected delivery to drain after configuration repair',
        );
    }
    assert.equal(restoredClaim.claim.attempt, 1);
    await startOrderConfirmationEmailSubmission({
        claimId: restoredClaim.claim.claimId,
        emailMessageId,
        now: new Date(now.getTime() + 1_000),
    });
    assert.deepEqual(
        await markOrderConfirmationEmailSent({
            claimId: restoredClaim.claim.claimId,
            emailMessageId,
            now: new Date(now.getTime() + 2_000),
            providerStatus: 'Succeeded',
        }),
        { status: 'sent' },
    );

    const stored = await getEmailMessage(emailMessageId);
    assert.equal(stored?.metadata.attemptCount, 1);
    assert.equal(stored?.providerStatus, 'Succeeded');
    assert.equal(stored?.status, 'sent');
});

test('non-retryable rejection fails immediately', async () => {
    createTestDb();
    const now = new Date('2026-08-03T11:00:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[3], now);
    const claim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-terminal',
        now,
    });
    assert.equal(claim.status, 'claimed');
    if (claim.status !== 'claimed') {
        throw new Error('Expected a claimed order confirmation');
    }
    await startOrderConfirmationEmailSubmission({
        claimId: claim.claim.claimId,
        emailMessageId,
        now: new Date(now.getTime() + 1_000),
    });

    assert.deepEqual(
        await markOrderConfirmationEmailFailed({
            claimId: claim.claim.claimId,
            emailMessageId,
            failureCode: 'provider_rejected_terminal',
            failureKind: 'definite',
            now: new Date(now.getTime() + 2_000),
        }),
        { attempt: 1, status: 'failed' },
    );
    assert.equal((await getEmailMessage(emailMessageId))?.status, 'failed');
});

test('an expired pre-submission claim is recoverable and fences its old owner', async () => {
    createTestDb();
    const now = new Date('2026-08-03T11:30:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[3], now);
    const firstClaim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-expired',
        now,
    });
    assert.equal(firstClaim.status, 'claimed');

    const recoveredAt = new Date(now.getTime() + 60_001);
    const recovered = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(recoveredAt.getTime() + 60_000),
        claimId: 'worker-recovered',
        now: recoveredAt,
    });
    assert.equal(recovered.status, 'claimed');
    if (recovered.status !== 'claimed') {
        throw new Error('Expected the expired claim to be recovered');
    }
    assert.equal(recovered.claim.attempt, 2);
    assert.deepEqual(
        await startOrderConfirmationEmailSubmission({
            claimId: 'worker-expired',
            emailMessageId,
            now: recoveredAt,
        }),
        { reason: 'claim_mismatch', status: 'unavailable' },
    );
    assert.equal(
        (
            await startOrderConfirmationEmailSubmission({
                claimId: recovered.claim.claimId,
                emailMessageId,
                now: recoveredAt,
            })
        ).status,
        'started',
    );
});

test('uncertain provider submission remains fenced from automatic retry', async () => {
    createTestDb();
    const now = new Date('2026-08-03T12:00:00.000Z');
    const { emailMessageId } = await enqueueReadyCart(operationIds[4], now);
    const claim = await claimOrderConfirmationEmail({
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimId: 'worker-uncertain',
        now,
    });
    assert.equal(claim.status, 'claimed');
    if (claim.status !== 'claimed') {
        throw new Error('Expected a claimed order confirmation');
    }
    await startOrderConfirmationEmailSubmission({
        claimId: claim.claim.claimId,
        emailMessageId,
        now: new Date(now.getTime() + 1_000),
    });

    assert.deepEqual(
        await markOrderConfirmationEmailFailed({
            claimId: claim.claim.claimId,
            emailMessageId,
            failureCode: 'provider_submission_uncertain',
            failureKind: 'uncertain',
            now: new Date(now.getTime() + 2_000),
        }),
        { status: 'fenced' },
    );
    assert.equal(
        (
            await claimOrderConfirmationEmail({
                claimExpiresAt: new Date(now.getTime() + 3_700_000),
                claimId: 'worker-must-not-retry',
                now: new Date(now.getTime() + 3_600_000),
            })
        ).status,
        'empty',
    );

    const stored = await getEmailMessage(emailMessageId);
    assert.equal(stored?.status, 'sending');
    assert.equal(stored?.providerStatus, 'submission_uncertain');
    assert.equal(stored?.completedAt, null);
});

test('reconciliation claims only stale fenced submissions and exposes no delivery payload', async () => {
    createTestDb();
    const now = new Date('2026-08-03T12:30:00.000Z');
    const privateRecipient = 'private-reconciliation-recipient@example.test';
    const privateItemName = 'Private reconciliation item';
    const fenced = await fenceProviderSubmission({
        claimId: 'delivery-before-reconciliation',
        now,
        operationId: operationIds[0],
        uncertain: true,
    });
    const storedBefore = await getEmailMessage(fenced.emailMessageId);
    assert.ok(storedBefore);
    await storage()
        .update(emailMessages)
        .set({
            metadata: {
                ...storedBefore.metadata,
                items: [{ name: privateItemName, quantity: 1 }],
            },
            recipients: { to: [{ address: privateRecipient }] },
        })
        .where(eq(emailMessages.id, fenced.emailMessageId));

    const reconcileAt = new Date(now.getTime() + 10 * 60_000);
    assert.equal(
        (
            await claimOrderConfirmationEmailReconciliation({
                claimExpiresAt: new Date(reconcileAt.getTime() + 60_000),
                claimId: 'reconcile-too-fresh',
                now: reconcileAt,
                staleBefore: new Date(fenced.fencedAt.getTime() - 1),
            })
        ).status,
        'empty',
    );

    const claimed = await claimOrderConfirmationEmailReconciliation({
        claimExpiresAt: new Date(reconcileAt.getTime() + 60_000),
        claimId: 'reconcile-stale',
        now: reconcileAt,
        staleBefore: fenced.fencedAt,
    });
    assert.deepEqual(claimed, {
        claim: {
            attempt: 1,
            claimId: 'reconcile-stale',
            emailMessageId: fenced.emailMessageId,
            operationId: operationIds[0],
        },
        status: 'claimed',
    });
    const serializedClaim = JSON.stringify(claimed);
    assert.equal(serializedClaim.includes(privateRecipient), false);
    assert.equal(serializedClaim.includes(privateItemName), false);

    const stored = await getEmailMessage(fenced.emailMessageId);
    assert.equal(stored?.status, 'sending');
    assert.equal(stored?.providerStatus, 'reconciliation_claimed');
    assert.equal(
        (
            await claimOrderConfirmationEmail({
                claimExpiresAt: new Date(reconcileAt.getTime() + 3_700_000),
                claimId: 'delivery-must-not-reclaim',
                now: new Date(reconcileAt.getTime() + 3_600_000),
            })
        ).status,
        'empty',
    );
});

test('reconciliation uses indefinite capped backoff without requeueing delivery', async () => {
    createTestDb();
    const startedAt = new Date('2026-08-03T13:00:00.000Z');
    const fenced = await fenceProviderSubmission({
        claimId: 'delivery-for-backoff',
        now: startedAt,
        operationId: operationIds[1],
    });
    const staleBefore = new Date(fenced.fencedAt.getTime() + 1);
    const outcomes = [
        { kind: 'provider_status', status: 'Running' },
        { kind: 'provider_status', status: 'NotStarted' },
        { kind: 'lookup_unavailable' },
        { kind: 'unknown_status' },
        { kind: 'provider_status', status: 'Running' },
        { kind: 'lookup_unavailable' },
    ] as const;
    const expectedDelays = [
        60_000,
        5 * 60_000,
        15 * 60_000,
        60 * 60_000,
        6 * 60 * 60_000,
        6 * 60 * 60_000,
    ];
    let claimAt = new Date(startedAt.getTime() + 10 * 60_000);

    for (const [index, outcome] of outcomes.entries()) {
        const claimId = `reconcile-backoff-${(index + 1).toString()}`;
        const claimed = await claimOrderConfirmationEmailReconciliation({
            claimExpiresAt: new Date(claimAt.getTime() + 60_000),
            claimId,
            now: claimAt,
            staleBefore,
        });
        assert.equal(claimed.status, 'claimed');
        if (claimed.status !== 'claimed') {
            throw new Error('Expected a reconciliation claim');
        }
        assert.equal(claimed.claim.attempt, index + 1);

        const checkedAt = new Date(claimAt.getTime() + 1_000);
        const finalized = await finalizeOrderConfirmationEmailReconciliation({
            claimId,
            emailMessageId: fenced.emailMessageId,
            now: checkedAt,
            outcome,
        });
        assert.deepEqual(finalized, {
            attempt: index + 1,
            nextCheckAt: new Date(
                checkedAt.getTime() + (expectedDelays[index] ?? 0),
            ),
            status: 'pending',
        });
        if (finalized.status !== 'pending') {
            throw new Error('Expected another reconciliation check');
        }

        assert.equal(
            (
                await claimOrderConfirmationEmailReconciliation({
                    claimExpiresAt: new Date(
                        finalized.nextCheckAt.getTime() + 60_000,
                    ),
                    claimId: 'reconcile-before-due',
                    now: new Date(finalized.nextCheckAt.getTime() - 1),
                    staleBefore,
                })
            ).status,
            'empty',
        );
        claimAt = finalized.nextCheckAt;
    }

    const stored = await getEmailMessage(fenced.emailMessageId);
    assert.equal(stored?.status, 'sending');
    assert.equal(stored?.providerStatus, 'reconciliation_pending');
    assert.equal(stored?.metadata.reconciliationAttempt, outcomes.length);
});

test('reconciliation maps terminal provider outcomes without resubmission', async () => {
    createTestDb();
    const cases = [
        {
            expectedStatus: 'sent',
            operationId: operationIds[2],
            providerStatus: 'Succeeded',
        },
        {
            expectedStatus: 'failed',
            operationId: operationIds[3],
            providerStatus: 'Failed',
        },
        {
            expectedStatus: 'failed',
            operationId: operationIds[4],
            providerStatus: 'Canceled',
        },
    ] as const;

    for (const [index, scenario] of cases.entries()) {
        const now = new Date(
            new Date('2026-08-03T14:00:00.000Z').getTime() +
                index * 60 * 60_000,
        );
        const fenced = await fenceProviderSubmission({
            claimId: `delivery-terminal-${index.toString()}`,
            now,
            operationId: scenario.operationId,
            uncertain: true,
        });
        const claimAt = new Date(now.getTime() + 10 * 60_000);
        const claimId = `reconcile-terminal-${index.toString()}`;
        const claimed = await claimOrderConfirmationEmailReconciliation({
            claimExpiresAt: new Date(claimAt.getTime() + 60_000),
            claimId,
            now: claimAt,
            staleBefore: fenced.fencedAt,
        });
        assert.equal(claimed.status, 'claimed');

        const result = await finalizeOrderConfirmationEmailReconciliation({
            claimId,
            emailMessageId: fenced.emailMessageId,
            now: new Date(claimAt.getTime() + 1_000),
            outcome: {
                kind: 'provider_status',
                status: scenario.providerStatus,
            },
        });
        assert.equal(result.status, scenario.expectedStatus);

        const stored = await getEmailMessage(fenced.emailMessageId);
        assert.equal(stored?.status, scenario.expectedStatus);
        assert.equal(stored?.providerStatus, scenario.providerStatus);
        assert.ok(stored?.completedAt);
        assert.equal(
            (
                await finalizeOrderConfirmationEmailReconciliation({
                    claimId,
                    emailMessageId: fenced.emailMessageId,
                    now: new Date(claimAt.getTime() + 2_000),
                    outcome: {
                        kind: 'provider_status',
                        status: scenario.providerStatus,
                    },
                })
            ).status,
            scenario.expectedStatus === 'sent'
                ? 'already_sent'
                : 'already_failed',
        );
    }
});

test('expired reconciliation claims recover and fence their former owner', async () => {
    createTestDb();
    const now = new Date('2026-08-03T18:00:00.000Z');
    const fenced = await fenceProviderSubmission({
        claimId: 'delivery-for-recovery',
        now,
        operationId: operationIds[0],
    });
    const claimAt = new Date(now.getTime() + 10 * 60_000);
    const expiresAt = new Date(claimAt.getTime() + 60_000);
    const first = await claimOrderConfirmationEmailReconciliation({
        claimExpiresAt: expiresAt,
        claimId: 'reconcile-expired',
        now: claimAt,
        staleBefore: fenced.fencedAt,
    });
    assert.equal(first.status, 'claimed');

    assert.deepEqual(
        await finalizeOrderConfirmationEmailReconciliation({
            claimId: 'reconcile-expired',
            emailMessageId: fenced.emailMessageId,
            now: expiresAt,
            outcome: { kind: 'lookup_unavailable' },
        }),
        { reason: 'claim_expired', status: 'unavailable' },
    );

    const recoveredAt = new Date(expiresAt.getTime() + 1);
    const recovered = await claimOrderConfirmationEmailReconciliation({
        claimExpiresAt: new Date(recoveredAt.getTime() + 60_000),
        claimId: 'reconcile-recovered',
        now: recoveredAt,
        staleBefore: fenced.fencedAt,
    });
    assert.equal(recovered.status, 'claimed');
    if (recovered.status !== 'claimed') {
        throw new Error('Expected an expired reconciliation claim to recover');
    }
    assert.equal(recovered.claim.attempt, 2);
    assert.deepEqual(
        await finalizeOrderConfirmationEmailReconciliation({
            claimId: 'reconcile-expired',
            emailMessageId: fenced.emailMessageId,
            now: new Date(recoveredAt.getTime() + 1),
            outcome: { kind: 'lookup_unavailable' },
        }),
        { reason: 'claim_mismatch', status: 'unavailable' },
    );
    assert.equal(
        (
            await finalizeOrderConfirmationEmailReconciliation({
                claimId: recovered.claim.claimId,
                emailMessageId: fenced.emailMessageId,
                now: new Date(recoveredAt.getTime() + 2),
                outcome: { kind: 'lookup_unavailable' },
            })
        ).status,
        'pending',
    );
    const stored = await getEmailMessage(fenced.emailMessageId);
    assert.equal(stored?.status, 'sending');
    assert.equal(
        stored?.metadata.reconciliationFenceStatus,
        'submission_started',
    );
});

test('reconciliation enforces a bounded claim lease', async () => {
    createTestDb();
    const now = new Date('2026-08-03T19:00:00.000Z');

    await assert.rejects(
        claimOrderConfirmationEmailReconciliation({
            claimExpiresAt: new Date(
                now.getTime() +
                    orderConfirmationEmailReconciliationMaxClaimLeaseMs +
                    1,
            ),
            claimId: 'reconcile-too-long',
            now,
            staleBefore: now,
        }),
        RangeError,
    );
});

test('health snapshot exposes aggregate queue and fence state without private content', async () => {
    createTestDb();
    const now = new Date('2026-08-03T12:00:00.000Z');
    const staleBefore = new Date('2026-08-03T11:30:00.000Z');
    const healthRecipient = 'private-health-recipient@example.test';
    const healthBody = 'private-health-body';

    async function insertHealthRow({
        completedAt = null,
        errorCode = null,
        lastAttemptAt = null,
        metadata = {},
        providerStatus,
        queuedAt,
        status,
        templateName = 'commerce-order-confirmation',
    }: {
        completedAt?: Date | null;
        errorCode?: string | null;
        lastAttemptAt?: Date | null;
        metadata?: Record<string, unknown>;
        providerStatus: string;
        queuedAt: Date;
        status: 'failed' | 'queued' | 'sending';
        templateName?: string;
    }) {
        await storage()
            .insert(emailMessages)
            .values({
                completedAt,
                createdAt: queuedAt,
                errorCode,
                fromAddress: 'suncokret@obavijesti.gredice.com',
                htmlBody: healthBody,
                lastAttemptAt,
                messageType: 'commerce',
                metadata: {
                    attemptCount: 0,
                    maxAttempts: 3,
                    outboxKind: 'order_confirmation',
                    privatePayload: healthBody,
                    ...metadata,
                },
                providerStatus,
                queuedAt,
                recipients: { to: [{ address: healthRecipient }] },
                status,
                subject: 'Gredice - potvrda narudžbe',
                templateName,
                textBody: healthBody,
                updatedAt: queuedAt,
            });
    }

    await insertHealthRow({
        providerStatus: 'outbox_ready',
        queuedAt: new Date('2026-08-03T08:00:00.000Z'),
        status: 'queued',
    });
    await insertHealthRow({
        metadata: { nextAttemptAt: '2026-08-03T13:00:00.000Z' },
        providerStatus: 'retry_scheduled',
        queuedAt: new Date('2026-08-03T09:00:00.000Z'),
        status: 'queued',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T11:50:00.000Z'),
        metadata: {
            claimExpiresAt: '2026-08-03T12:10:00.000Z',
            claimedAt: '2026-08-03T11:50:00.000Z',
        },
        providerStatus: 'outbox_claimed',
        queuedAt: new Date('2026-08-03T09:10:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T10:45:00.000Z'),
        metadata: {
            claimExpiresAt: '2026-08-03T11:00:00.000Z',
            claimedAt: '2026-08-03T10:45:00.000Z',
        },
        providerStatus: 'outbox_claimed',
        queuedAt: new Date('2026-08-03T09:20:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T10:00:00.000Z'),
        metadata: { submissionStartedAt: '2026-08-03T10:00:00.000Z' },
        providerStatus: 'submission_started',
        queuedAt: new Date('2026-08-03T09:30:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T11:45:00.000Z'),
        metadata: { submissionStartedAt: '2026-08-03T11:45:00.000Z' },
        providerStatus: 'submission_started',
        queuedAt: new Date('2026-08-03T09:40:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T10:30:00.000Z'),
        metadata: {
            submissionUncertainAt: '2026-08-03T10:30:00.000Z',
        },
        providerStatus: 'submission_uncertain',
        queuedAt: new Date('2026-08-03T09:50:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        lastAttemptAt: new Date('2026-08-03T11:45:00.000Z'),
        metadata: {
            submissionUncertainAt: '2026-08-03T11:45:00.000Z',
        },
        providerStatus: 'submission_uncertain',
        queuedAt: new Date('2026-08-03T10:00:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        metadata: {
            nextReconciliationAt: '2026-08-03T10:30:00.000Z',
            reconciliationFencedAt: '2026-08-03T09:30:00.000Z',
        },
        providerStatus: 'reconciliation_pending',
        queuedAt: new Date('2026-08-03T10:10:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        metadata: {
            nextReconciliationAt: '2026-08-03T13:00:00.000Z',
            reconciliationFencedAt: '2026-08-03T11:50:00.000Z',
        },
        providerStatus: 'reconciliation_pending',
        queuedAt: new Date('2026-08-03T10:20:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        metadata: {
            reconciliationClaimedAt: '2026-08-03T11:55:00.000Z',
            reconciliationClaimExpiresAt: '2026-08-03T12:10:00.000Z',
            reconciliationFencedAt: '2026-08-03T10:00:00.000Z',
        },
        providerStatus: 'reconciliation_claimed',
        queuedAt: new Date('2026-08-03T10:30:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        metadata: {
            reconciliationClaimedAt: '2026-08-03T11:40:00.000Z',
            reconciliationClaimExpiresAt: '2026-08-03T11:00:00.000Z',
            reconciliationFencedAt: '2026-08-03T09:00:00.000Z',
        },
        providerStatus: 'reconciliation_claimed',
        queuedAt: new Date('2026-08-03T10:40:00.000Z'),
        status: 'sending',
    });
    await insertHealthRow({
        completedAt: new Date('2026-08-03T09:45:00.000Z'),
        errorCode: 'configuration_error',
        metadata: { attemptCount: 3 },
        providerStatus: 'retry_exhausted',
        queuedAt: new Date('2026-08-03T08:30:00.000Z'),
        status: 'failed',
    });
    await insertHealthRow({
        completedAt: new Date('2026-08-03T10:35:00.000Z'),
        errorCode: 'provider_rejected_terminal',
        metadata: { attemptCount: 1 },
        providerStatus: 'retry_exhausted',
        queuedAt: new Date('2026-08-03T08:40:00.000Z'),
        status: 'failed',
    });
    await insertHealthRow({
        providerStatus: 'outbox_ready',
        queuedAt: new Date('2026-08-03T07:00:00.000Z'),
        status: 'queued',
        templateName: 'another-template',
    });

    const snapshot = await getOrderConfirmationOutboxHealthSnapshot({
        now,
        staleBefore,
    });

    assert.deepEqual(snapshot, {
        fencedSubmissions: {
            count: 8,
            oldestFencedAt: '2026-08-03T09:00:00.000Z',
            oldestStaleAt: '2026-08-03T09:00:00.000Z',
            staleCount: 4,
        },
        observedAt: now.toISOString(),
        pendingQueued: {
            count: 2,
            dueCount: 1,
            oldestDueAt: '2026-08-03T08:00:00.000Z',
            oldestQueuedAt: '2026-08-03T08:00:00.000Z',
        },
        preSubmissionClaims: {
            expiredCount: 1,
            inFlightCount: 1,
            oldestExpiredClaimedAt: '2026-08-03T10:45:00.000Z',
            oldestInFlightClaimedAt: '2026-08-03T11:50:00.000Z',
        },
        reconciliation: {
            claimedCount: 2,
            dueCount: 1,
            expiredClaimCount: 1,
            oldestClaimedAt: '2026-08-03T11:40:00.000Z',
            oldestPendingAt: '2026-08-03T10:30:00.000Z',
            oldestStaleAt: '2026-08-03T10:30:00.000Z',
            pendingCount: 2,
            staleCount: 2,
        },
        staleBefore: staleBefore.toISOString(),
        staleSubmissionStarted: {
            count: 1,
            oldestStartedAt: '2026-08-03T10:00:00.000Z',
        },
        submissionUncertain: {
            count: 2,
            oldestStaleUncertainAt: '2026-08-03T10:30:00.000Z',
            oldestUncertainAt: '2026-08-03T10:30:00.000Z',
            staleCount: 1,
        },
        terminalFailures: {
            count: 2,
            oldestFailedAt: '2026-08-03T09:45:00.000Z',
            retryExhaustedCount: 1,
        },
    });
    assert.equal(JSON.stringify(snapshot).includes(healthRecipient), false);
    assert.equal(JSON.stringify(snapshot).includes(healthBody), false);
});

test('health snapshot rejects a stale cutoff after its observation time', async () => {
    createTestDb();

    await assert.rejects(
        getOrderConfirmationOutboxHealthSnapshot({
            now: new Date('2026-08-03T12:00:00.000Z'),
            staleBefore: new Date('2026-08-03T12:00:00.001Z'),
        }),
        RangeError,
    );
});

test('claim skips a due row locked by another worker', {
    skip: process.env.GREDICE_TEST_DB_PROVIDER === 'pglite',
}, async () => {
    createTestDb();
    const now = new Date('2026-08-03T13:00:00.000Z');
    const first = await enqueueReadyCart(operationIds[0], now);
    const second = await enqueueReadyCart(operationIds[1], now);

    let signalLocked: (() => void) | undefined;
    const locked = new Promise<void>((resolve) => {
        signalLocked = resolve;
    });
    let releaseLock: (() => void) | undefined;
    const release = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });
    const heldTransaction = storage().transaction(async (tx) => {
        await tx
            .select({ id: emailMessages.id })
            .from(emailMessages)
            .where(eq(emailMessages.id, first.emailMessageId))
            .for('update');
        signalLocked?.();
        await release;
    });
    await locked;

    try {
        const claimed = await claimOrderConfirmationEmail({
            claimExpiresAt: new Date(now.getTime() + 60_000),
            claimId: 'worker-skip-locked',
            now,
        });
        assert.equal(claimed.status, 'claimed');
        if (claimed.status !== 'claimed') {
            throw new Error('Expected a claimed order confirmation');
        }
        assert.equal(claimed.claim.emailMessageId, second.emailMessageId);
    } finally {
        releaseLock?.();
        await heldTransaction;
    }

    assert.equal(
        (
            await storage()
                .select({ status: shoppingCarts.status })
                .from(shoppingCarts)
                .where(eq(shoppingCarts.id, first.cartId))
        )[0]?.status,
        'paid',
    );
});

test('reconciliation claim skips a stale fenced row locked by another worker', {
    skip: process.env.GREDICE_TEST_DB_PROVIDER === 'pglite',
}, async () => {
    createTestDb();
    const now = new Date('2026-08-03T20:00:00.000Z');
    const first = await fenceProviderSubmission({
        claimId: 'delivery-reconcile-skip-locked-first',
        now,
        operationId: operationIds[0],
    });
    const second = await fenceProviderSubmission({
        claimId: 'delivery-reconcile-skip-locked-second',
        now,
        operationId: operationIds[1],
    });

    let signalLocked: (() => void) | undefined;
    const locked = new Promise<void>((resolve) => {
        signalLocked = resolve;
    });
    let releaseLock: (() => void) | undefined;
    const release = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });
    const heldTransaction = storage().transaction(async (tx) => {
        await tx
            .select({ id: emailMessages.id })
            .from(emailMessages)
            .where(eq(emailMessages.id, first.emailMessageId))
            .for('update');
        signalLocked?.();
        await release;
    });
    await locked;

    try {
        const claimAt = new Date(now.getTime() + 10 * 60_000);
        const claimed = await claimOrderConfirmationEmailReconciliation({
            claimExpiresAt: new Date(claimAt.getTime() + 60_000),
            claimId: 'reconcile-skip-locked',
            now: claimAt,
            staleBefore: new Date(now.getTime() + 5 * 60_000),
        });
        assert.equal(claimed.status, 'claimed');
        if (claimed.status !== 'claimed') {
            throw new Error('Expected a reconciliation claim');
        }
        assert.equal(claimed.claim.emailMessageId, second.emailMessageId);
    } finally {
        releaseLock?.();
        await heldTransaction;
    }
});
