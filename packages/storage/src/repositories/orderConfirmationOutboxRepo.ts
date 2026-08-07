import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { emailMessages, shoppingCartItems, shoppingCarts } from '../schema';
import { storage } from '../storage';

const orderConfirmationOutboxKind = 'order_confirmation';
const orderConfirmationTemplateName = 'commerce-order-confirmation';
const orderConfirmationMessageType = 'commerce';
const orderConfirmationFromAddress = 'suncokret@obavijesti.gredice.com';
const orderConfirmationSubject = 'Gredice - potvrda narudžbe';
const providerOperationIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const orderConfirmationEmailMaxAttempts = 3;
export const orderConfirmationEmailReconciliationMaxClaimLeaseMs = 5 * 60_000;

const retryDelayMsByCompletedAttempt = [60_000, 5 * 60_000] as const;
const configurationRetryDelayMs = 60_000;
const reconciliationDelayMsByCompletedCheck = [
    60_000,
    5 * 60_000,
    15 * 60_000,
    60 * 60_000,
    6 * 60 * 60_000,
] as const;

export type OrderConfirmationEmailItemPayload = {
    amountSubtotal?: number | null;
    currency?: string | null;
    name?: string | null;
    quantity?: number | null;
};

export type OrderConfirmationEmailPayload = {
    cartId: number | null;
    currency: string | null;
    items: OrderConfirmationEmailItemPayload[];
    manageUrl: string;
    to: string;
    totalAmountCents: number | null;
};

export type MarkCartPaidAndEnqueueOrderConfirmationResult =
    | {
          emailMessageId: number;
          operationId: string;
          status: 'enqueued';
      }
    | {
          emailMessageId: number | null;
          operationId: string | null;
          status: 'already_paid';
      }
    | {
          status: 'cart_not_found' | 'cart_not_ready';
      };

export type OrderConfirmationEmailClaim = {
    attempt: number;
    claimId: string;
    emailMessageId: number;
    maxAttempts: number;
    operationId: string;
    payload: OrderConfirmationEmailPayload;
    queuedAt: Date;
};

export type OrderConfirmationEmailClaimResult =
    | {
          claim: OrderConfirmationEmailClaim;
          status: 'claimed';
      }
    | {
          status: 'empty';
      }
    | {
          emailMessageId: number;
          status: 'attempts_exhausted' | 'invalid';
      };

export type OrderConfirmationEmailSubmissionStartResult =
    | {
          operationId: string;
          status: 'started';
      }
    | {
          reason:
              | 'claim_expired'
              | 'claim_mismatch'
              | 'email_not_found'
              | 'not_claimed';
          status: 'unavailable';
      };

export type OrderConfirmationEmailSentResult =
    | {
          status: 'already_sent' | 'sent';
      }
    | {
          reason:
              | 'claim_mismatch'
              | 'email_not_found'
              | 'submission_not_started';
          status: 'unavailable';
      };

export type OrderConfirmationEmailFailureCode =
    | 'configuration_error'
    | 'invalid_payload'
    | 'provider_rejected_retryable'
    | 'provider_rejected_terminal'
    | 'provider_submission_uncertain'
    | 'render_failed'
    | 'transport_before_submission'
    | 'worker_error_before_submission';

export type OrderConfirmationEmailDefiniteFailureCode = Exclude<
    OrderConfirmationEmailFailureCode,
    'provider_submission_uncertain'
>;

export type OrderConfirmationEmailFailureResult =
    | {
          attempt: number;
          nextAttemptAt: Date;
          status: 'retry_scheduled';
      }
    | {
          attempt: number;
          status: 'failed';
      }
    | {
          status: 'fenced';
      }
    | {
          reason:
              | 'claim_mismatch'
              | 'email_not_found'
              | 'submission_not_started';
          status: 'unavailable';
      };

export type OrderConfirmationEmailReconciliationClaim = {
    attempt: number;
    claimId: string;
    emailMessageId: number;
    operationId: string;
};

export type OrderConfirmationEmailReconciliationClaimResult =
    | {
          claim: OrderConfirmationEmailReconciliationClaim;
          status: 'claimed';
      }
    | {
          status: 'empty';
      };

export type OrderConfirmationEmailReconciliationProviderStatus =
    | 'Canceled'
    | 'Failed'
    | 'NotStarted'
    | 'Running'
    | 'Succeeded';

export type OrderConfirmationEmailReconciliationOutcome =
    | {
          kind: 'provider_status';
          status: OrderConfirmationEmailReconciliationProviderStatus;
      }
    | {
          kind: 'lookup_unavailable' | 'unknown_status';
      };

export type OrderConfirmationEmailReconciliationResult =
    | {
          status: 'already_sent' | 'sent';
      }
    | {
          providerStatus: 'Canceled' | 'Failed' | null;
          status: 'already_failed' | 'failed';
      }
    | {
          attempt: number;
          nextCheckAt: Date;
          status: 'pending';
      }
    | {
          reason:
              | 'claim_expired'
              | 'claim_mismatch'
              | 'email_not_found'
              | 'not_claimed';
          status: 'unavailable';
      };

export type OrderConfirmationOutboxHealthSnapshot = {
    fencedSubmissions: {
        count: number;
        oldestFencedAt: string | null;
        oldestStaleAt: string | null;
        staleCount: number;
    };
    observedAt: string;
    pendingQueued: {
        count: number;
        dueCount: number;
        oldestDueAt: string | null;
        oldestQueuedAt: string | null;
    };
    preSubmissionClaims: {
        expiredCount: number;
        inFlightCount: number;
        oldestExpiredClaimedAt: string | null;
        oldestInFlightClaimedAt: string | null;
    };
    reconciliation: {
        claimedCount: number;
        dueCount: number;
        expiredClaimCount: number;
        oldestClaimedAt: string | null;
        oldestPendingAt: string | null;
        oldestStaleAt: string | null;
        pendingCount: number;
        staleCount: number;
    };
    staleBefore: string;
    staleSubmissionStarted: {
        count: number;
        oldestStartedAt: string | null;
    };
    submissionUncertain: {
        count: number;
        oldestUncertainAt: string | null;
        oldestStaleUncertainAt: string | null;
        staleCount: number;
    };
    terminalFailures: {
        count: number;
        oldestFailedAt: string | null;
        retryExhaustedCount: number;
    };
};

function isRetryableDefiniteFailure(
    failureCode: OrderConfirmationEmailDefiniteFailureCode,
) {
    return (
        failureCode === 'provider_rejected_retryable' ||
        failureCode === 'transport_before_submission' ||
        failureCode === 'worker_error_before_submission'
    );
}

type OrderConfirmationOutboxMetadata = Record<string, unknown>;

function requirePositiveInteger(value: number, label: string) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive integer`);
    }
}

function normalizeOperationId(operationId?: string) {
    const normalized = (operationId ?? randomUUID()).trim().toLowerCase();
    if (!providerOperationIdPattern.test(normalized)) {
        throw new TypeError(
            'Order confirmation operation ID must be a canonical UUID',
        );
    }
    return normalized;
}

function normalizeClaimId(claimId: string) {
    const normalized = claimId.trim();
    if (!normalized || normalized.length > 128) {
        throw new TypeError(
            'Order confirmation claim ID must contain 1 to 128 characters',
        );
    }
    return normalized;
}

function normalizePayload(
    cartId: number,
    payload: OrderConfirmationEmailPayload,
): OrderConfirmationEmailPayload {
    requirePositiveInteger(cartId, 'Cart ID');
    if (payload.cartId !== cartId) {
        throw new TypeError('Order confirmation cart ID does not match');
    }

    const to = payload.to.trim();
    if (!to || to.length > 320 || !to.includes('@')) {
        throw new TypeError('Order confirmation recipient is invalid');
    }
    if (!Array.isArray(payload.items)) {
        throw new TypeError('Order confirmation items must be an array');
    }
    if (
        payload.totalAmountCents !== null &&
        (!Number.isInteger(payload.totalAmountCents) ||
            payload.totalAmountCents < 0)
    ) {
        throw new TypeError(
            'Order confirmation total amount must be a non-negative integer or null',
        );
    }

    const manageUrl = payload.manageUrl.trim();
    const parsedManageUrl = new URL(manageUrl);
    if (!['http:', 'https:'].includes(parsedManageUrl.protocol)) {
        throw new TypeError('Order confirmation manage URL must use HTTP(S)');
    }

    return {
        cartId,
        currency: payload.currency?.trim().toLowerCase() || null,
        items: payload.items.map((item) => ({ ...item })),
        manageUrl,
        to,
        totalAmountCents: payload.totalAmountCents,
    };
}

function buildInitialMetadata(
    payload: OrderConfirmationEmailPayload,
): OrderConfirmationOutboxMetadata {
    return {
        attemptCount: 0,
        cartId: payload.cartId,
        currency: payload.currency,
        items: payload.items,
        manageUrl: payload.manageUrl,
        maxAttempts: orderConfirmationEmailMaxAttempts,
        nextAttemptAt: null,
        outboxKind: orderConfirmationOutboxKind,
        outboxVersion: 1,
        totalAmountCents: payload.totalAmountCents,
    };
}

function readInteger(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readNullableString(value: unknown) {
    return value === null || typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredItem(
    value: unknown,
): OrderConfirmationEmailItemPayload | null {
    if (!isRecord(value)) {
        return null;
    }

    const amountSubtotal = value.amountSubtotal;
    const currency = value.currency;
    const name = value.name;
    const quantity = value.quantity;
    if (
        !(
            amountSubtotal === undefined ||
            amountSubtotal === null ||
            typeof amountSubtotal === 'number'
        ) ||
        !(
            currency === undefined ||
            currency === null ||
            typeof currency === 'string'
        ) ||
        !(name === undefined || name === null || typeof name === 'string') ||
        !(
            quantity === undefined ||
            quantity === null ||
            typeof quantity === 'number'
        )
    ) {
        return null;
    }

    return { amountSubtotal, currency, name, quantity };
}

function parseStoredPayload({
    metadata,
    providerMessageId,
    recipient,
}: {
    metadata: OrderConfirmationOutboxMetadata;
    providerMessageId: string | null;
    recipient: string | undefined;
}): OrderConfirmationEmailPayload | null {
    const cartId =
        metadata.cartId === null ? null : readInteger(metadata.cartId);
    const stripePaymentId = metadata.stripePaymentId;
    const expectedStripeOperationId =
        typeof stripePaymentId === 'string'
            ? (() => {
                  const digest = createHash('sha256')
                      .update(
                          `stripe-payment-completion:${stripePaymentId}:order_confirmation`,
                      )
                      .digest('hex');
                  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
              })()
            : null;
    const isStripeCompletion =
        metadata.completionOutputKind === 'order_confirmation' &&
        metadata.completionOutputVersion === 1 &&
        typeof stripePaymentId === 'string' &&
        stripePaymentId.length > 0 &&
        stripePaymentId.length <= 255 &&
        typeof metadata.completionFingerprint === 'string' &&
        /^[a-f0-9]{64}$/u.test(metadata.completionFingerprint) &&
        providerMessageId === expectedStripeOperationId;
    const items = metadata.items;
    const manageUrl = metadata.manageUrl;
    const totalAmountCents = metadata.totalAmountCents;
    const currency = readNullableString(metadata.currency);
    const to = recipient?.trim();
    if (
        !('cartId' in metadata) ||
        (cartId !== null && cartId <= 0) ||
        (cartId === null && !isStripeCompletion) ||
        !to ||
        !Array.isArray(items) ||
        typeof manageUrl !== 'string' ||
        !(
            totalAmountCents === null ||
            (typeof totalAmountCents === 'number' &&
                Number.isInteger(totalAmountCents) &&
                totalAmountCents >= 0)
        )
    ) {
        return null;
    }

    const parsedItems = items.map(parseStoredItem);
    if (parsedItems.some((item) => item === null)) {
        return null;
    }

    return {
        cartId,
        currency,
        items: parsedItems.flatMap((item) => (item ? [item] : [])),
        manageUrl,
        to,
        totalAmountCents,
    };
}

function readAttemptCount(metadata: OrderConfirmationOutboxMetadata) {
    const count = readInteger(metadata.attemptCount);
    return count !== null && count >= 0 ? count : 0;
}

function metadataClaimMatches(
    metadata: OrderConfirmationOutboxMetadata,
    claimId: string,
) {
    return metadata.claimId === claimId;
}

function requireValidDate(value: Date, label: string) {
    if (Number.isNaN(value.getTime())) {
        throw new TypeError(`${label} must be a valid date`);
    }
}

function aggregateTimestampToIso(value: Date | string | null) {
    if (value === null) {
        return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Returns aggregate-only operational health for the confirmation outbox.
 * Recipient, body, item, and cart data are neither selected nor returned.
 */
export async function getOrderConfirmationOutboxHealthSnapshot({
    staleBefore,
    now = new Date(),
}: {
    staleBefore: Date;
    now?: Date;
}): Promise<OrderConfirmationOutboxHealthSnapshot> {
    requireValidDate(staleBefore, 'Order confirmation stale cutoff');
    requireValidDate(now, 'Order confirmation observation time');
    if (staleBefore.getTime() > now.getTime()) {
        throw new RangeError(
            'Order confirmation stale cutoff cannot be after the observation time',
        );
    }

    const nowIso = now.toISOString();
    const staleBeforeIso = staleBefore.toISOString();
    const pendingQueuedWhere = eq(emailMessages.status, 'queued');
    const dueQueuedWhere = and(
        pendingQueuedWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'nextAttemptAt', '') <= ${nowIso}`,
    );
    const preSubmissionClaimWhere = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'outbox_claimed'),
    );
    const inFlightPreSubmissionClaimWhere = and(
        preSubmissionClaimWhere,
        sql<boolean>`${emailMessages.metadata}->>'claimExpiresAt' > ${nowIso}`,
    );
    const expiredPreSubmissionClaimWhere = and(
        preSubmissionClaimWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'claimExpiresAt', '') <= ${nowIso}`,
    );
    const submissionStartedWhere = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'submission_started'),
    );
    const staleSubmissionStartedWhere = and(
        submissionStartedWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'submissionStartedAt', '') <= ${staleBeforeIso}`,
    );
    const submissionUncertainWhere = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'submission_uncertain'),
    );
    const staleSubmissionUncertainWhere = and(
        submissionUncertainWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'submissionUncertainAt', '') <= ${staleBeforeIso}`,
    );
    const reconciliationPendingWhere = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'reconciliation_pending'),
    );
    const dueReconciliationPendingWhere = and(
        reconciliationPendingWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'nextReconciliationAt', '') <= ${nowIso}`,
    );
    const staleReconciliationPendingWhere = and(
        reconciliationPendingWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'nextReconciliationAt', '') <= ${staleBeforeIso}`,
    );
    const reconciliationClaimedWhere = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'reconciliation_claimed'),
    );
    const expiredReconciliationClaimWhere = and(
        reconciliationClaimedWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'reconciliationClaimExpiresAt', '') <= ${nowIso}`,
    );
    const staleReconciliationClaimWhere = and(
        reconciliationClaimedWhere,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'reconciliationClaimExpiresAt', '') <= ${staleBeforeIso}`,
    );
    const staleReconciliationWhere = or(
        staleReconciliationPendingWhere,
        staleReconciliationClaimWhere,
    );
    const fencedSubmissionWhere = or(
        submissionStartedWhere,
        submissionUncertainWhere,
        reconciliationPendingWhere,
        reconciliationClaimedWhere,
    );
    const staleFencedSubmissionWhere = or(
        staleSubmissionStartedWhere,
        staleSubmissionUncertainWhere,
        staleReconciliationPendingWhere,
        staleReconciliationClaimWhere,
    );
    const terminalFailureWhere = eq(emailMessages.status, 'failed');
    const retryExhaustedWhere = and(
        terminalFailureWhere,
        eq(emailMessages.providerStatus, 'retry_exhausted'),
        or(
            eq(emailMessages.errorCode, 'attempts_exhausted'),
            sql<boolean>`${emailMessages.metadata}->>'attemptCount' = ${emailMessages.metadata}->>'maxAttempts'`,
        ),
    );

    const [aggregate] = await storage()
        .select({
            dueQueuedCount: sql<number>`count(*) filter (where ${dueQueuedWhere})::integer`,
            dueReconciliationCount: sql<number>`count(*) filter (where ${dueReconciliationPendingWhere})::integer`,
            expiredPreSubmissionClaimCount: sql<number>`count(*) filter (where ${expiredPreSubmissionClaimWhere})::integer`,
            expiredReconciliationClaimCount: sql<number>`count(*) filter (where ${expiredReconciliationClaimWhere})::integer`,
            fencedSubmissionCount: sql<number>`count(*) filter (where ${fencedSubmissionWhere})::integer`,
            inFlightPreSubmissionClaimCount: sql<number>`count(*) filter (where ${inFlightPreSubmissionClaimWhere})::integer`,
            oldestDueAt:
                sql<Date | null>`min(${emailMessages.queuedAt}) filter (where ${dueQueuedWhere})`.mapWith(
                    emailMessages.queuedAt,
                ),
            oldestExpiredClaimedAt:
                sql<Date | null>`min(${emailMessages.lastAttemptAt}) filter (where ${expiredPreSubmissionClaimWhere})`.mapWith(
                    emailMessages.lastAttemptAt,
                ),
            oldestFailedAt:
                sql<Date | null>`min(${emailMessages.completedAt}) filter (where ${terminalFailureWhere})`.mapWith(
                    emailMessages.completedAt,
                ),
            oldestInFlightClaimedAt:
                sql<Date | null>`min(${emailMessages.lastAttemptAt}) filter (where ${inFlightPreSubmissionClaimWhere})`.mapWith(
                    emailMessages.lastAttemptAt,
                ),
            oldestFencedAt: sql<
                string | null
            >`min(coalesce(${emailMessages.metadata}->>'reconciliationFencedAt', ${emailMessages.metadata}->>'submissionUncertainAt', ${emailMessages.metadata}->>'submissionStartedAt')) filter (where ${fencedSubmissionWhere})`,
            oldestQueuedAt:
                sql<Date | null>`min(${emailMessages.queuedAt}) filter (where ${pendingQueuedWhere})`.mapWith(
                    emailMessages.queuedAt,
                ),
            oldestReconciliationClaimedAt: sql<
                string | null
            >`min(${emailMessages.metadata}->>'reconciliationClaimedAt') filter (where ${reconciliationClaimedWhere})`,
            oldestReconciliationPendingAt: sql<
                string | null
            >`min(${emailMessages.metadata}->>'nextReconciliationAt') filter (where ${reconciliationPendingWhere})`,
            oldestReconciliationStaleAt: sql<
                string | null
            >`min(coalesce(${emailMessages.metadata}->>'nextReconciliationAt', ${emailMessages.metadata}->>'reconciliationClaimExpiresAt')) filter (where ${staleReconciliationWhere})`,
            oldestStaleFencedAt: sql<
                string | null
            >`min(coalesce(${emailMessages.metadata}->>'reconciliationFencedAt', ${emailMessages.metadata}->>'submissionUncertainAt', ${emailMessages.metadata}->>'submissionStartedAt')) filter (where ${staleFencedSubmissionWhere})`,
            oldestStaleSubmissionStartedAt: sql<
                string | null
            >`min(${emailMessages.metadata}->>'submissionStartedAt') filter (where ${staleSubmissionStartedWhere})`,
            oldestStaleSubmissionUncertainAt: sql<
                string | null
            >`min(${emailMessages.metadata}->>'submissionUncertainAt') filter (where ${staleSubmissionUncertainWhere})`,
            oldestSubmissionUncertainAt: sql<
                string | null
            >`min(${emailMessages.metadata}->>'submissionUncertainAt') filter (where ${submissionUncertainWhere})`,
            pendingQueuedCount: sql<number>`count(*) filter (where ${pendingQueuedWhere})::integer`,
            reconciliationClaimedCount: sql<number>`count(*) filter (where ${reconciliationClaimedWhere})::integer`,
            reconciliationPendingCount: sql<number>`count(*) filter (where ${reconciliationPendingWhere})::integer`,
            reconciliationStaleCount: sql<number>`count(*) filter (where ${staleReconciliationWhere})::integer`,
            retryExhaustedCount: sql<number>`count(*) filter (where ${retryExhaustedWhere})::integer`,
            staleFencedSubmissionCount: sql<number>`count(*) filter (where ${staleFencedSubmissionWhere})::integer`,
            staleSubmissionStartedCount: sql<number>`count(*) filter (where ${staleSubmissionStartedWhere})::integer`,
            staleSubmissionUncertainCount: sql<number>`count(*) filter (where ${staleSubmissionUncertainWhere})::integer`,
            submissionUncertainCount: sql<number>`count(*) filter (where ${submissionUncertainWhere})::integer`,
            terminalFailureCount: sql<number>`count(*) filter (where ${terminalFailureWhere})::integer`,
        })
        .from(emailMessages)
        .where(
            and(
                eq(emailMessages.templateName, orderConfirmationTemplateName),
                sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${orderConfirmationOutboxKind}`,
                or(
                    eq(emailMessages.status, 'failed'),
                    eq(emailMessages.status, 'queued'),
                    eq(emailMessages.status, 'sending'),
                ),
            ),
        );

    if (!aggregate) {
        throw new Error('Failed to read order confirmation outbox health');
    }

    return {
        fencedSubmissions: {
            count: aggregate.fencedSubmissionCount,
            oldestFencedAt: aggregateTimestampToIso(aggregate.oldestFencedAt),
            oldestStaleAt: aggregateTimestampToIso(
                aggregate.oldestStaleFencedAt,
            ),
            staleCount: aggregate.staleFencedSubmissionCount,
        },
        observedAt: nowIso,
        pendingQueued: {
            count: aggregate.pendingQueuedCount,
            dueCount: aggregate.dueQueuedCount,
            oldestDueAt: aggregateTimestampToIso(aggregate.oldestDueAt),
            oldestQueuedAt: aggregateTimestampToIso(aggregate.oldestQueuedAt),
        },
        preSubmissionClaims: {
            expiredCount: aggregate.expiredPreSubmissionClaimCount,
            inFlightCount: aggregate.inFlightPreSubmissionClaimCount,
            oldestExpiredClaimedAt: aggregateTimestampToIso(
                aggregate.oldestExpiredClaimedAt,
            ),
            oldestInFlightClaimedAt: aggregateTimestampToIso(
                aggregate.oldestInFlightClaimedAt,
            ),
        },
        reconciliation: {
            claimedCount: aggregate.reconciliationClaimedCount,
            dueCount: aggregate.dueReconciliationCount,
            expiredClaimCount: aggregate.expiredReconciliationClaimCount,
            oldestClaimedAt: aggregateTimestampToIso(
                aggregate.oldestReconciliationClaimedAt,
            ),
            oldestPendingAt: aggregateTimestampToIso(
                aggregate.oldestReconciliationPendingAt,
            ),
            oldestStaleAt: aggregateTimestampToIso(
                aggregate.oldestReconciliationStaleAt,
            ),
            pendingCount: aggregate.reconciliationPendingCount,
            staleCount: aggregate.reconciliationStaleCount,
        },
        staleBefore: staleBeforeIso,
        staleSubmissionStarted: {
            count: aggregate.staleSubmissionStartedCount,
            oldestStartedAt: aggregateTimestampToIso(
                aggregate.oldestStaleSubmissionStartedAt,
            ),
        },
        submissionUncertain: {
            count: aggregate.submissionUncertainCount,
            oldestUncertainAt: aggregateTimestampToIso(
                aggregate.oldestSubmissionUncertainAt,
            ),
            oldestStaleUncertainAt: aggregateTimestampToIso(
                aggregate.oldestStaleSubmissionUncertainAt,
            ),
            staleCount: aggregate.staleSubmissionUncertainCount,
        },
        terminalFailures: {
            count: aggregate.terminalFailureCount,
            oldestFailedAt: aggregateTimestampToIso(aggregate.oldestFailedAt),
            retryExhaustedCount: aggregate.retryExhaustedCount,
        },
    };
}

function findOrderConfirmationForCart(
    cartId: number,
    db: Parameters<Parameters<ReturnType<typeof storage>['transaction']>[0]>[0],
) {
    return db.query.emailMessages.findFirst({
        where: and(
            eq(emailMessages.templateName, orderConfirmationTemplateName),
            sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${orderConfirmationOutboxKind}`,
            sql<boolean>`${emailMessages.metadata}->>'cartId' = ${cartId.toString()}`,
        ),
        orderBy: [asc(emailMessages.id)],
    });
}

/**
 * Marks a ready cart paid and writes its confirmation-email intent in the same
 * transaction. The cart status transition is the idempotency fence: replays of
 * an already-paid cart never enqueue a second message.
 */
export async function markCartPaidAndEnqueueOrderConfirmation({
    cartId,
    payload,
    operationId,
    now = new Date(),
}: {
    cartId: number;
    payload: OrderConfirmationEmailPayload;
    operationId?: string;
    now?: Date;
}): Promise<MarkCartPaidAndEnqueueOrderConfirmationResult> {
    const normalizedPayload = normalizePayload(cartId, payload);
    const normalizedOperationId = normalizeOperationId(operationId);

    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`shopping-cart-checkout:${cartId.toString()}`}));`,
        );

        const [cart] = await tx
            .select({ id: shoppingCarts.id, status: shoppingCarts.status })
            .from(shoppingCarts)
            .where(
                and(
                    eq(shoppingCarts.id, cartId),
                    eq(shoppingCarts.isDeleted, false),
                ),
            )
            .for('update')
            .limit(1);
        if (!cart) {
            return { status: 'cart_not_found' };
        }
        if (cart.status === 'paid') {
            const existing = await findOrderConfirmationForCart(cartId, tx);
            return {
                emailMessageId: existing?.id ?? null,
                operationId: existing?.providerMessageId ?? null,
                status: 'already_paid',
            };
        }
        if (cart.status !== 'new') {
            return { status: 'cart_not_ready' };
        }

        const items = await tx
            .select({ status: shoppingCartItems.status })
            .from(shoppingCartItems)
            .where(
                and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.isDeleted, false),
                ),
            );
        if (
            items.length === 0 ||
            items.some((item) => item.status !== 'paid')
        ) {
            return { status: 'cart_not_ready' };
        }

        const [transitioned] = await tx
            .update(shoppingCarts)
            .set({ status: 'paid', updatedAt: now })
            .where(
                and(
                    eq(shoppingCarts.id, cartId),
                    eq(shoppingCarts.status, 'new'),
                    eq(shoppingCarts.isDeleted, false),
                ),
            )
            .returning({ id: shoppingCarts.id });
        if (!transitioned) {
            return { status: 'cart_not_ready' };
        }

        const [emailMessage] = await tx
            .insert(emailMessages)
            .values({
                attachments: [],
                createdAt: now,
                fromAddress: orderConfirmationFromAddress,
                metadata: buildInitialMetadata(normalizedPayload),
                messageType: orderConfirmationMessageType,
                provider: 'acs',
                providerMessageId: normalizedOperationId,
                providerStatus: 'outbox_ready',
                queuedAt: now,
                recipients: {
                    to: [{ address: normalizedPayload.to }],
                },
                status: 'queued',
                subject: orderConfirmationSubject,
                templateName: orderConfirmationTemplateName,
                updatedAt: now,
            })
            .returning({ id: emailMessages.id });
        if (!emailMessage) {
            throw new Error('Failed to enqueue order confirmation email');
        }

        return {
            emailMessageId: emailMessage.id,
            operationId: normalizedOperationId,
            status: 'enqueued',
        };
    });
}

function dueOrderConfirmationWhere(now: Date) {
    const nowIso = now.toISOString();
    return and(
        eq(emailMessages.templateName, orderConfirmationTemplateName),
        sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${orderConfirmationOutboxKind}`,
        or(
            and(
                eq(emailMessages.status, 'queued'),
                sql<boolean>`coalesce(${emailMessages.metadata}->>'nextAttemptAt', '') <= ${nowIso}`,
            ),
            and(
                eq(emailMessages.status, 'sending'),
                eq(emailMessages.providerStatus, 'outbox_claimed'),
                sql<boolean>`${emailMessages.metadata}->>'claimExpiresAt' <= ${nowIso}`,
            ),
        ),
    );
}

/** Claims one due intent without waiting for rows held by another worker. */
export async function claimOrderConfirmationEmail({
    claimId,
    claimExpiresAt,
    now = new Date(),
}: {
    claimId: string;
    claimExpiresAt: Date;
    now?: Date;
}): Promise<OrderConfirmationEmailClaimResult> {
    const normalizedClaimId = normalizeClaimId(claimId);
    if (claimExpiresAt.getTime() <= now.getTime()) {
        throw new RangeError(
            'Order confirmation claim expiration must be in the future',
        );
    }

    return storage().transaction(async (tx) => {
        const [candidate] = await tx
            .select()
            .from(emailMessages)
            .where(dueOrderConfirmationWhere(now))
            .orderBy(asc(emailMessages.queuedAt), asc(emailMessages.id))
            .for('update', { skipLocked: true })
            .limit(1);
        if (!candidate) {
            return { status: 'empty' };
        }

        const attemptCount = readAttemptCount(candidate.metadata);
        if (attemptCount >= orderConfirmationEmailMaxAttempts) {
            await tx
                .update(emailMessages)
                .set({
                    completedAt: now,
                    errorCode: 'attempts_exhausted',
                    errorMessage:
                        'Order confirmation delivery attempts were exhausted before provider submission.',
                    providerStatus: 'retry_exhausted',
                    status: 'failed',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, candidate.id));
            return {
                emailMessageId: candidate.id,
                status: 'attempts_exhausted',
            };
        }

        const payload = parseStoredPayload({
            metadata: candidate.metadata,
            providerMessageId: candidate.providerMessageId,
            recipient: candidate.recipients.to[0]?.address,
        });
        const operationId = candidate.providerMessageId?.trim().toLowerCase();
        if (
            !payload ||
            !operationId ||
            !providerOperationIdPattern.test(operationId)
        ) {
            await tx
                .update(emailMessages)
                .set({
                    completedAt: now,
                    errorCode: 'invalid_payload',
                    errorMessage:
                        'Order confirmation outbox payload is invalid.',
                    providerStatus: 'outbox_invalid',
                    status: 'failed',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, candidate.id));
            return { emailMessageId: candidate.id, status: 'invalid' };
        }

        const attempt = attemptCount + 1;
        await tx
            .update(emailMessages)
            .set({
                completedAt: null,
                errorCode: null,
                errorMessage: null,
                lastAttemptAt: now,
                metadata: {
                    ...candidate.metadata,
                    attemptCount: attempt,
                    claimExpiresAt: claimExpiresAt.toISOString(),
                    claimId: normalizedClaimId,
                    claimedAt: now.toISOString(),
                    nextAttemptAt: null,
                },
                providerStatus: 'outbox_claimed',
                status: 'sending',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, candidate.id));

        return {
            claim: {
                attempt,
                claimId: normalizedClaimId,
                emailMessageId: candidate.id,
                maxAttempts: orderConfirmationEmailMaxAttempts,
                operationId,
                payload,
                queuedAt: candidate.queuedAt,
            },
            status: 'claimed',
        };
    });
}

export async function startOrderConfirmationEmailSubmission({
    emailMessageId,
    claimId,
    now = new Date(),
}: {
    emailMessageId: number;
    claimId: string;
    now?: Date;
}): Promise<OrderConfirmationEmailSubmissionStartResult> {
    requirePositiveInteger(emailMessageId, 'Email message ID');
    const normalizedClaimId = normalizeClaimId(claimId);

    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) {
            return { reason: 'email_not_found', status: 'unavailable' };
        }
        if (
            message.status !== 'sending' ||
            message.providerStatus !== 'outbox_claimed'
        ) {
            return { reason: 'not_claimed', status: 'unavailable' };
        }
        if (!metadataClaimMatches(message.metadata, normalizedClaimId)) {
            return { reason: 'claim_mismatch', status: 'unavailable' };
        }
        const claimExpiresAt = message.metadata.claimExpiresAt;
        if (
            typeof claimExpiresAt !== 'string' ||
            claimExpiresAt <= now.toISOString()
        ) {
            return { reason: 'claim_expired', status: 'unavailable' };
        }

        const operationId = message.providerMessageId?.trim().toLowerCase();
        if (!operationId || !providerOperationIdPattern.test(operationId)) {
            return { reason: 'not_claimed', status: 'unavailable' };
        }

        await tx
            .update(emailMessages)
            .set({
                metadata: {
                    ...message.metadata,
                    submissionStartedAt: now.toISOString(),
                },
                providerStatus: 'submission_started',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));

        return { operationId, status: 'started' };
    });
}

export async function markOrderConfirmationEmailSent({
    emailMessageId,
    claimId,
    providerMessageId,
    providerStatus,
    now = new Date(),
}: {
    emailMessageId: number;
    claimId: string;
    providerMessageId?: string | null;
    providerStatus?: string | null;
    now?: Date;
}): Promise<OrderConfirmationEmailSentResult> {
    requirePositiveInteger(emailMessageId, 'Email message ID');
    const normalizedClaimId = normalizeClaimId(claimId);

    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) {
            return { reason: 'email_not_found', status: 'unavailable' };
        }
        if (message.status === 'sent') {
            return { status: 'already_sent' };
        }
        if (!metadataClaimMatches(message.metadata, normalizedClaimId)) {
            return { reason: 'claim_mismatch', status: 'unavailable' };
        }
        if (
            message.status !== 'sending' ||
            message.providerStatus !== 'submission_started'
        ) {
            return {
                reason: 'submission_not_started',
                status: 'unavailable',
            };
        }

        await tx
            .update(emailMessages)
            .set({
                completedAt: now,
                errorCode: null,
                errorMessage: null,
                metadata: {
                    ...message.metadata,
                    deliveryCompletedAt: now.toISOString(),
                },
                providerMessageId:
                    providerMessageId?.trim() || message.providerMessageId,
                providerStatus: providerStatus?.trim() || 'succeeded',
                sentAt: now,
                status: 'sent',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));

        return { status: 'sent' };
    });
}

export async function markOrderConfirmationEmailFailed({
    emailMessageId,
    claimId,
    failureKind,
    failureCode,
    now = new Date(),
}: {
    emailMessageId: number;
    claimId: string;
    now?: Date;
} & (
    | {
          failureKind: 'definite';
          failureCode: OrderConfirmationEmailDefiniteFailureCode;
      }
    | {
          failureKind: 'uncertain';
          failureCode: 'provider_submission_uncertain';
      }
)): Promise<OrderConfirmationEmailFailureResult> {
    requirePositiveInteger(emailMessageId, 'Email message ID');
    const normalizedClaimId = normalizeClaimId(claimId);

    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) {
            return { reason: 'email_not_found', status: 'unavailable' };
        }

        const attempt = readAttemptCount(message.metadata);
        if (message.status === 'failed') {
            return { attempt, status: 'failed' };
        }
        if (
            failureKind === 'uncertain' &&
            message.status === 'sending' &&
            message.providerStatus === 'submission_uncertain'
        ) {
            return { status: 'fenced' };
        }
        if (!metadataClaimMatches(message.metadata, normalizedClaimId)) {
            return { reason: 'claim_mismatch', status: 'unavailable' };
        }

        const submissionStarted =
            message.status === 'sending' &&
            message.providerStatus === 'submission_started';
        const claimedBeforeSubmission =
            message.status === 'sending' &&
            message.providerStatus === 'outbox_claimed';
        if (
            (!submissionStarted && !claimedBeforeSubmission) ||
            (failureKind === 'uncertain' && !submissionStarted)
        ) {
            return {
                reason: 'submission_not_started',
                status: 'unavailable',
            };
        }

        if (failureKind === 'uncertain') {
            await tx
                .update(emailMessages)
                .set({
                    errorCode: failureCode,
                    errorMessage:
                        'Order confirmation provider submission outcome is uncertain; automatic retry is fenced.',
                    metadata: {
                        ...message.metadata,
                        submissionUncertainAt: now.toISOString(),
                    },
                    providerStatus: 'submission_uncertain',
                    status: 'sending',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { status: 'fenced' };
        }

        if (failureCode === 'configuration_error' && claimedBeforeSubmission) {
            const nextAttemptAt = new Date(
                now.getTime() + configurationRetryDelayMs,
            );
            await tx
                .update(emailMessages)
                .set({
                    completedAt: null,
                    errorCode: failureCode,
                    errorMessage:
                        'Order confirmation delivery is waiting for provider configuration.',
                    metadata: {
                        ...message.metadata,
                        attemptCount: Math.max(0, attempt - 1),
                        claimExpiresAt: null,
                        claimId: null,
                        lastFailureAt: now.toISOString(),
                        nextAttemptAt: nextAttemptAt.toISOString(),
                        submissionStartedAt: null,
                    },
                    providerStatus: 'retry_scheduled',
                    status: 'queued',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { attempt, nextAttemptAt, status: 'retry_scheduled' };
        }

        const retryIsProvenSafe = isRetryableDefiniteFailure(failureCode);
        if (retryIsProvenSafe && attempt < orderConfirmationEmailMaxAttempts) {
            const retryDelayMs =
                retryDelayMsByCompletedAttempt[attempt - 1] ??
                retryDelayMsByCompletedAttempt[
                    retryDelayMsByCompletedAttempt.length - 1
                ];
            const nextAttemptAt = new Date(now.getTime() + retryDelayMs);
            await tx
                .update(emailMessages)
                .set({
                    completedAt: null,
                    errorCode: failureCode,
                    errorMessage:
                        'Order confirmation delivery failed before a provider submission could be confirmed.',
                    metadata: {
                        ...message.metadata,
                        claimExpiresAt: null,
                        claimId: null,
                        lastFailureAt: now.toISOString(),
                        nextAttemptAt: nextAttemptAt.toISOString(),
                        submissionStartedAt: null,
                    },
                    providerStatus: 'retry_scheduled',
                    status: 'queued',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { attempt, nextAttemptAt, status: 'retry_scheduled' };
        }

        await tx
            .update(emailMessages)
            .set({
                completedAt: now,
                errorCode: failureCode,
                errorMessage: retryIsProvenSafe
                    ? 'Order confirmation delivery attempts were exhausted before provider submission.'
                    : 'Order confirmation delivery failed with a non-retryable error.',
                metadata: {
                    ...message.metadata,
                    lastFailureAt: now.toISOString(),
                },
                providerStatus: 'retry_exhausted',
                status: 'failed',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));
        return { attempt, status: 'failed' };
    });
}

function dueOrderConfirmationReconciliationWhere({
    now,
    staleBefore,
}: {
    now: Date;
    staleBefore: Date;
}) {
    const nowIso = now.toISOString();
    const staleBeforeIso = staleBefore.toISOString();
    return and(
        eq(emailMessages.templateName, orderConfirmationTemplateName),
        eq(emailMessages.status, 'sending'),
        sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${orderConfirmationOutboxKind}`,
        sql<boolean>`${emailMessages.providerMessageId} ~ ${providerOperationIdPattern.source}`,
        or(
            and(
                eq(emailMessages.providerStatus, 'submission_started'),
                sql<boolean>`coalesce(${emailMessages.metadata}->>'submissionStartedAt', '') <= ${staleBeforeIso}`,
            ),
            and(
                eq(emailMessages.providerStatus, 'submission_uncertain'),
                sql<boolean>`coalesce(${emailMessages.metadata}->>'submissionUncertainAt', '') <= ${staleBeforeIso}`,
            ),
            and(
                eq(emailMessages.providerStatus, 'reconciliation_pending'),
                sql<boolean>`coalesce(${emailMessages.metadata}->>'nextReconciliationAt', '') <= ${nowIso}`,
            ),
            and(
                eq(emailMessages.providerStatus, 'reconciliation_claimed'),
                sql<boolean>`coalesce(${emailMessages.metadata}->>'reconciliationClaimExpiresAt', '') <= ${nowIso}`,
            ),
        ),
    );
}

function reconciliationDelayMs(attempt: number) {
    const delayIndex = Math.min(
        Math.max(attempt - 1, 0),
        reconciliationDelayMsByCompletedCheck.length - 1,
    );
    return reconciliationDelayMsByCompletedCheck[delayIndex];
}

/**
 * Claims one stale or due provider submission for a read-only provider-status
 * lookup. The claim intentionally contains no recipient, body, cart, or item
 * data and can never be consumed by the delivery worker as a send retry.
 */
export async function claimOrderConfirmationEmailReconciliation({
    claimId,
    claimExpiresAt,
    staleBefore,
    now = new Date(),
}: {
    claimId: string;
    claimExpiresAt: Date;
    staleBefore: Date;
    now?: Date;
}): Promise<OrderConfirmationEmailReconciliationClaimResult> {
    const normalizedClaimId = normalizeClaimId(claimId);
    requireValidDate(claimExpiresAt, 'Reconciliation claim expiration');
    requireValidDate(staleBefore, 'Reconciliation stale cutoff');
    requireValidDate(now, 'Reconciliation claim time');
    if (staleBefore.getTime() > now.getTime()) {
        throw new RangeError(
            'Reconciliation stale cutoff cannot be after the claim time',
        );
    }
    const leaseMs = claimExpiresAt.getTime() - now.getTime();
    if (
        leaseMs <= 0 ||
        leaseMs > orderConfirmationEmailReconciliationMaxClaimLeaseMs
    ) {
        throw new RangeError(
            `Reconciliation claim lease must be between 1 and ${orderConfirmationEmailReconciliationMaxClaimLeaseMs.toString()} milliseconds`,
        );
    }

    return storage().transaction(async (tx) => {
        const [candidate] = await tx
            .select({
                emailMessageId: emailMessages.id,
                operationId: emailMessages.providerMessageId,
                providerStatus: emailMessages.providerStatus,
                reconciliationAttempt: sql<
                    string | null
                >`${emailMessages.metadata}->>'reconciliationAttempt'`,
                reconciliationFencedAt: sql<
                    string | null
                >`coalesce(${emailMessages.metadata}->>'reconciliationFencedAt', ${emailMessages.metadata}->>'submissionUncertainAt', ${emailMessages.metadata}->>'submissionStartedAt')`,
                updatedAt: emailMessages.updatedAt,
            })
            .from(emailMessages)
            .where(
                dueOrderConfirmationReconciliationWhere({ now, staleBefore }),
            )
            .orderBy(asc(emailMessages.updatedAt), asc(emailMessages.id))
            .for('update', { skipLocked: true })
            .limit(1);
        if (!candidate) {
            return { status: 'empty' };
        }

        const operationId = candidate.operationId?.trim().toLowerCase();
        if (!operationId || !providerOperationIdPattern.test(operationId)) {
            return { status: 'empty' };
        }
        const priorAttempt = Number(candidate.reconciliationAttempt);
        const attempt =
            Number.isSafeInteger(priorAttempt) && priorAttempt >= 0
                ? priorAttempt + 1
                : 1;
        const sourceStatus =
            candidate.providerStatus === 'submission_started' ||
            candidate.providerStatus === 'submission_uncertain'
                ? candidate.providerStatus
                : null;
        const metadataPatch = {
            nextReconciliationAt: null,
            reconciliationAttempt: attempt,
            reconciliationClaimExpiresAt: claimExpiresAt.toISOString(),
            reconciliationClaimId: normalizedClaimId,
            reconciliationClaimedAt: now.toISOString(),
            reconciliationFencedAt:
                candidate.reconciliationFencedAt ??
                candidate.updatedAt.toISOString(),
            ...(sourceStatus
                ? { reconciliationFenceStatus: sourceStatus }
                : {}),
        };

        await tx
            .update(emailMessages)
            .set({
                metadata: sql`${emailMessages.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`,
                providerStatus: 'reconciliation_claimed',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, candidate.emailMessageId));

        return {
            claim: {
                attempt,
                claimId: normalizedClaimId,
                emailMessageId: candidate.emailMessageId,
                operationId,
            },
            status: 'claimed',
        };
    });
}

/**
 * Applies a read-only provider-status result to a reconciliation claim. Only a
 * terminal provider result can leave the fenced sending state. Every other
 * result schedules another bounded-backoff lookup without re-queuing the send.
 */
export async function finalizeOrderConfirmationEmailReconciliation({
    emailMessageId,
    claimId,
    outcome,
    now = new Date(),
}: {
    emailMessageId: number;
    claimId: string;
    outcome: OrderConfirmationEmailReconciliationOutcome;
    now?: Date;
}): Promise<OrderConfirmationEmailReconciliationResult> {
    requirePositiveInteger(emailMessageId, 'Email message ID');
    const normalizedClaimId = normalizeClaimId(claimId);
    requireValidDate(now, 'Reconciliation finalization time');

    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select({
                claimExpiresAt: sql<
                    string | null
                >`${emailMessages.metadata}->>'reconciliationClaimExpiresAt'`,
                claimId: sql<
                    string | null
                >`${emailMessages.metadata}->>'reconciliationClaimId'`,
                providerStatus: emailMessages.providerStatus,
                reconciliationAttempt: sql<
                    string | null
                >`${emailMessages.metadata}->>'reconciliationAttempt'`,
                status: emailMessages.status,
            })
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) {
            return { reason: 'email_not_found', status: 'unavailable' };
        }
        if (message.status === 'sent') {
            return { status: 'already_sent' };
        }
        if (message.status === 'failed') {
            return {
                providerStatus:
                    message.providerStatus === 'Canceled' ||
                    message.providerStatus === 'Failed'
                        ? message.providerStatus
                        : null,
                status: 'already_failed',
            };
        }
        if (
            message.status !== 'sending' ||
            message.providerStatus !== 'reconciliation_claimed'
        ) {
            return { reason: 'not_claimed', status: 'unavailable' };
        }
        if (message.claimId !== normalizedClaimId) {
            return { reason: 'claim_mismatch', status: 'unavailable' };
        }
        if (
            typeof message.claimExpiresAt !== 'string' ||
            message.claimExpiresAt <= now.toISOString()
        ) {
            return { reason: 'claim_expired', status: 'unavailable' };
        }

        const parsedAttempt = Number(message.reconciliationAttempt);
        const attempt =
            Number.isSafeInteger(parsedAttempt) && parsedAttempt > 0
                ? parsedAttempt
                : 1;
        const providerStatus =
            outcome.kind === 'provider_status' ? outcome.status : null;

        if (providerStatus === 'Succeeded') {
            const metadataPatch = {
                nextReconciliationAt: null,
                reconciliationClaimExpiresAt: null,
                reconciliationClaimId: null,
                reconciliationCompletedAt: now.toISOString(),
                reconciliationLastCheckedAt: now.toISOString(),
                reconciliationLastOutcome: 'succeeded',
                reconciliationLastProviderStatus: providerStatus,
            };
            await tx
                .update(emailMessages)
                .set({
                    completedAt: now,
                    errorCode: null,
                    errorMessage: null,
                    metadata: sql`${emailMessages.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`,
                    providerStatus,
                    sentAt: now,
                    status: 'sent',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { status: 'sent' };
        }

        if (providerStatus === 'Failed' || providerStatus === 'Canceled') {
            const metadataPatch = {
                nextReconciliationAt: null,
                reconciliationClaimExpiresAt: null,
                reconciliationClaimId: null,
                reconciliationCompletedAt: now.toISOString(),
                reconciliationLastCheckedAt: now.toISOString(),
                reconciliationLastOutcome: 'terminal_failure',
                reconciliationLastProviderStatus: providerStatus,
            };
            await tx
                .update(emailMessages)
                .set({
                    completedAt: now,
                    errorCode:
                        providerStatus === 'Canceled'
                            ? 'provider_reconciliation_canceled'
                            : 'provider_reconciliation_failed',
                    errorMessage:
                        'Order confirmation provider submission reached a terminal non-success status.',
                    metadata: sql`${emailMessages.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`,
                    providerStatus,
                    status: 'failed',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { providerStatus, status: 'failed' };
        }

        const nextCheckAt = new Date(
            now.getTime() + reconciliationDelayMs(attempt),
        );
        const lastOutcome =
            outcome.kind === 'provider_status'
                ? 'provider_non_terminal'
                : outcome.kind;
        const metadataPatch = {
            nextReconciliationAt: nextCheckAt.toISOString(),
            reconciliationClaimExpiresAt: null,
            reconciliationClaimId: null,
            reconciliationLastCheckedAt: now.toISOString(),
            reconciliationLastOutcome: lastOutcome,
            reconciliationLastProviderStatus: providerStatus,
        };
        await tx
            .update(emailMessages)
            .set({
                metadata: sql`${emailMessages.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`,
                providerStatus: 'reconciliation_pending',
                status: 'sending',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));
        return { attempt, nextCheckAt, status: 'pending' };
    });
}
