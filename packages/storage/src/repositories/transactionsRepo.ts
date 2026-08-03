import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
    type InsertTransaction,
    invoices,
    stripePaymentProcessingClaimReviews,
    stripePaymentProcessingClaims,
    transactions,
    type UpdateTransaction,
} from '../schema';
import { storage } from '../storage';
import { createEvent, knownEvents } from './eventsRepo';
import { getStripePaymentCompletionOutputs } from './stripePaymentCompletionOutputsRepo';

type StorageClient = ReturnType<typeof storage>;
export type StripePaymentProcessingLockTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

// These signed int32 values encode "GRDC" and "STRP". Keep them stable: the
// Stripe claim migration takes the matching exclusive two-key advisory lock
// before it seeds durable processing claims.
export const STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE = 1_196_573_763;
export const STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY = 1_398_035_024;

export async function acquireStripePaymentProcessingDrainFenceSharedLock(
    transaction: StripePaymentProcessingLockTransaction,
) {
    await transaction.execute(
        sql`select pg_advisory_xact_lock_shared(${STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE}, ${STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY});`,
    );
}

export async function tryAcquireStripePaymentProcessingDrainFenceExclusiveLock(
    transaction: StripePaymentProcessingLockTransaction,
) {
    const [result] = await transaction
        .select({
            acquired: sql<boolean>`pg_try_advisory_xact_lock(${STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_NAMESPACE}, ${STRIPE_PAYMENT_PROCESSING_DRAIN_FENCE_LOCK_KEY})`,
        })
        .from(sql`(select 1) as stripe_payment_processing_drain_probe`);

    return result?.acquired === true;
}

/**
 * Probes whether every legacy advisory-lock Stripe processor has committed.
 * The exclusive lock is released when this read-only transaction completes.
 */
export async function getStripePaymentProcessingDrainPreflight() {
    return storage().transaction(async (transaction) => {
        await transaction.execute(sql`set transaction read only;`);
        return tryAcquireStripePaymentProcessingDrainFenceExclusiveLock(
            transaction,
        );
    });
}

type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type StripePaymentProcessingDatabaseClient =
    | StorageClient
    | TransactionClient;

export const stripePaymentProcessingClaimDefaults = {
    heartbeatIntervalMs: 30_000,
    leaseDurationMs: 120_000,
    maxAttempts: 5,
    retryDelayMs: 60_000,
} as const;

export class StripeTransactionIdentityConflictError extends Error {
    override readonly name = 'StripeTransactionIdentityConflictError';

    constructor(readonly stripePaymentId: string) {
        super('Stripe payment identity conflicts with an existing transaction');
    }
}

export class StripePaymentProcessingClaimLostError extends Error {
    override readonly name = 'StripePaymentProcessingClaimLostError';

    constructor(readonly stripePaymentId: string) {
        super('Stripe payment processing claim is no longer owned');
    }
}

export class StripePaymentProcessingUnavailableError extends Error {
    override readonly name = 'StripePaymentProcessingUnavailableError';

    constructor(
        readonly stripePaymentId: string,
        readonly claimStatus: 'processing' | 'retryable',
        readonly availableAt: Date | null,
        readonly attempt: number,
    ) {
        super('Stripe payment processing is temporarily unavailable');
    }
}

export class StripePaymentProcessingPermanentError extends Error {
    override readonly name = 'StripePaymentProcessingPermanentError';

    constructor(readonly failureCode: string) {
        if (!/^[A-Za-z0-9_.:-]{1,120}$/u.test(failureCode)) {
            throw new TypeError(
                'Permanent Stripe payment failure code is invalid',
            );
        }
        super('Stripe payment cannot be processed without manual review');
    }
}

/**
 * The provider session is complete but its payment has not settled yet.
 * Deferrals preserve the lifetime attempt count for observability while they
 * reset the current manual-review cycle, so a legitimate delayed settlement
 * cannot exhaust the ordinary processing retry budget.
 */
export class StripePaymentProcessingDeferredError extends Error {
    override readonly name = 'StripePaymentProcessingDeferredError';

    constructor(readonly failureCode: string) {
        if (!/^[A-Za-z0-9_.:-]{1,120}$/u.test(failureCode)) {
            throw new TypeError(
                'Deferred Stripe payment failure code is invalid',
            );
        }
        super(
            'Stripe payment processing is deferred until provider state changes',
        );
    }
}

class StripePaymentProcessingIncompleteError extends Error {
    override readonly name = 'StripePaymentProcessingIncompleteError';

    constructor(readonly failureCode: StripePaymentProcessingIncompleteReason) {
        super(
            'Stripe payment processing finished without its durable completion prerequisites',
        );
    }
}

function normalizeStripePaymentId(stripePaymentId: string) {
    const normalized = stripePaymentId.trim();
    if (!normalized || normalized.length > 255) {
        throw new Error('Stripe payment ID must contain 1 to 255 characters');
    }
    return normalized;
}

function assertPositiveInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive safe integer`);
    }
}

function addMilliseconds(date: Date, milliseconds: number) {
    return new Date(date.getTime() + milliseconds);
}

function getAttemptCountInCurrentReviewCycle({
    attemptCount,
    attemptCountAtLastRequeue,
}: {
    attemptCount: number;
    attemptCountAtLastRequeue: number;
}) {
    const attemptCountInCycle = attemptCount - attemptCountAtLastRequeue;
    if (attemptCountInCycle < 0) {
        throw new Error(
            'Stripe payment processing claim has an invalid attempt baseline',
        );
    }
    return attemptCountInCycle;
}

function normalizeManualReviewText(
    value: string,
    label: string,
    maximumLength: number,
) {
    const normalized = value.trim();
    if (!normalized || normalized.length > maximumLength) {
        throw new Error(
            `${label} must contain 1 to ${maximumLength.toString()} characters`,
        );
    }
    return normalized;
}

export async function createTransaction(
    transaction: InsertTransaction,
    database: StorageClient = storage(),
) {
    if (!transaction.accountId) {
        throw new Error('Transaction must have an accountId');
    }
    const accountId = transaction.accountId;

    const stripePaymentId = normalizeStripePaymentId(
        transaction.stripePaymentId,
    );
    return database.transaction(async (tx) => {
        const [created] = await tx
            .insert(transactions)
            .values({ ...transaction, stripePaymentId })
            .onConflictDoNothing({ target: transactions.stripePaymentId })
            .returning({ id: transactions.id });
        if (created) {
            await createEvent(
                knownEvents.transactions.createdV1(created.id.toString(), {
                    accountId,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    status: transaction.status,
                }),
                tx,
            );
            return created.id;
        }

        const existing = await tx.query.transactions.findFirst({
            where: eq(transactions.stripePaymentId, stripePaymentId),
        });
        const isIdenticalReplay =
            existing !== undefined &&
            !existing.isDeleted &&
            existing.accountId === accountId &&
            existing.gardenId === (transaction.gardenId ?? null) &&
            existing.amount === transaction.amount &&
            existing.currency === transaction.currency &&
            existing.status === transaction.status;
        if (!isIdenticalReplay) {
            throw new StripeTransactionIdentityConflictError(stripePaymentId);
        }

        return existing.id;
    });
}

export async function getCompletedTransactionByStripePaymentId(
    stripePaymentId: string,
    database: StorageClient = storage(),
) {
    return database.query.transactions.findFirst({
        where: and(
            eq(
                transactions.stripePaymentId,
                normalizeStripePaymentId(stripePaymentId),
            ),
            eq(transactions.status, 'completed'),
            eq(transactions.isDeleted, false),
        ),
    });
}

export type StripePaymentProcessingClaimResult =
    | {
          attempt: number;
          claimToken: string;
          leaseExpiresAt: Date;
          recovered: boolean;
          status: 'acquired';
      }
    | {
          attempt: number;
          availableAt: Date | null;
          claimStatus: 'processing' | 'retryable';
          status: 'unavailable';
      }
    | {
          attempt: number;
          completedTransactionId: number | null;
          status: 'completed';
      }
    | {
          attempt: number;
          reason: string | null;
          status: 'manual_review';
      };

export async function acquireStripePaymentProcessingClaim(
    stripePaymentId: string,
    {
        database = storage(),
        leaseDurationMs = stripePaymentProcessingClaimDefaults.leaseDurationMs,
        maxAttempts = stripePaymentProcessingClaimDefaults.maxAttempts,
        now = new Date(),
    }: {
        database?: StorageClient;
        leaseDurationMs?: number;
        maxAttempts?: number;
        now?: Date;
    } = {},
) {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    assertPositiveInteger(leaseDurationMs, 'Stripe claim lease duration');
    assertPositiveInteger(maxAttempts, 'Stripe claim maximum attempts');
    const claimToken = randomUUID();
    const leaseExpiresAt = addMilliseconds(now, leaseDurationMs);

    return database.transaction(
        async (tx): Promise<StripePaymentProcessingClaimResult> => {
            let [claim] = await tx
                .select()
                .from(stripePaymentProcessingClaims)
                .where(
                    eq(
                        stripePaymentProcessingClaims.stripePaymentId,
                        normalizedPaymentId,
                    ),
                )
                .for('update')
                .limit(1);
            if (!claim) {
                // Migration 0078 seeds every completed transaction visible in
                // its snapshot. A transaction without a claim committed after
                // that snapshot and must run the idempotent output-repair path.
                await tx
                    .insert(stripePaymentProcessingClaims)
                    .values({
                        attemptCount: 1,
                        claimedAt: now,
                        claimToken,
                        leaseExpiresAt,
                        status: 'processing',
                        stripePaymentId: normalizedPaymentId,
                        updatedAt: now,
                    })
                    .onConflictDoNothing({
                        target: stripePaymentProcessingClaims.stripePaymentId,
                    });
                [claim] = await tx
                    .select()
                    .from(stripePaymentProcessingClaims)
                    .where(
                        eq(
                            stripePaymentProcessingClaims.stripePaymentId,
                            normalizedPaymentId,
                        ),
                    )
                    .for('update')
                    .limit(1);
            }
            if (!claim) {
                throw new Error('Stripe payment processing claim disappeared');
            }

            if (
                claim.status === 'processing' &&
                claim.claimToken === claimToken
            ) {
                return {
                    attempt: claim.attemptCount,
                    claimToken,
                    leaseExpiresAt,
                    recovered: false,
                    status: 'acquired',
                };
            }
            if (claim.status === 'completed') {
                return {
                    attempt: claim.attemptCount,
                    completedTransactionId: claim.completedTransactionId,
                    status: 'completed',
                };
            }
            if (claim.status === 'manual_review') {
                return {
                    attempt: claim.attemptCount,
                    reason: claim.manualReviewReason,
                    status: 'manual_review',
                };
            }

            const availableAt =
                claim.status === 'processing'
                    ? claim.leaseExpiresAt
                    : claim.nextAttemptAt;
            if (
                claim.status !== 'queued' &&
                availableAt &&
                availableAt.getTime() > now.getTime()
            ) {
                return {
                    attempt: claim.attemptCount,
                    availableAt,
                    claimStatus: claim.status,
                    status: 'unavailable',
                };
            }

            if (getAttemptCountInCurrentReviewCycle(claim) >= maxAttempts) {
                await tx
                    .update(stripePaymentProcessingClaims)
                    .set({
                        claimToken: null,
                        leaseExpiresAt: null,
                        manualReviewAt: now,
                        manualReviewReason: 'attempt_limit_reached',
                        nextAttemptAt: null,
                        status: 'manual_review',
                        updatedAt: now,
                    })
                    .where(
                        eq(
                            stripePaymentProcessingClaims.stripePaymentId,
                            normalizedPaymentId,
                        ),
                    );
                return {
                    attempt: claim.attemptCount,
                    reason: 'attempt_limit_reached',
                    status: 'manual_review',
                };
            }

            const attempt = claim.attemptCount + 1;
            await tx
                .update(stripePaymentProcessingClaims)
                .set({
                    attemptCount: attempt,
                    claimedAt: now,
                    claimToken,
                    leaseExpiresAt,
                    nextAttemptAt: null,
                    status: 'processing',
                    updatedAt: now,
                })
                .where(
                    eq(
                        stripePaymentProcessingClaims.stripePaymentId,
                        normalizedPaymentId,
                    ),
                );
            return {
                attempt,
                claimToken,
                leaseExpiresAt,
                recovered: claim.status === 'processing',
                status: 'acquired',
            };
        },
    );
}

export async function renewStripePaymentProcessingClaim({
    claimToken,
    database = storage(),
    leaseDurationMs = stripePaymentProcessingClaimDefaults.leaseDurationMs,
    now = new Date(),
    stripePaymentId,
}: {
    claimToken: string;
    database?: StripePaymentProcessingDatabaseClient;
    leaseDurationMs?: number;
    now?: Date;
    stripePaymentId: string;
}) {
    assertPositiveInteger(leaseDurationMs, 'Stripe claim lease duration');
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const requestedLeaseExpiresAt = addMilliseconds(now, leaseDurationMs);
    const [renewed] = await database
        .update(stripePaymentProcessingClaims)
        .set({
            leaseExpiresAt: sql`greatest(${stripePaymentProcessingClaims.leaseExpiresAt}, ${requestedLeaseExpiresAt})`,
            updatedAt: sql`greatest(${stripePaymentProcessingClaims.updatedAt}, ${now})`,
        })
        .where(
            and(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
                eq(stripePaymentProcessingClaims.status, 'processing'),
                eq(stripePaymentProcessingClaims.claimToken, claimToken),
                gt(stripePaymentProcessingClaims.leaseExpiresAt, now),
            ),
        )
        .returning({
            leaseExpiresAt: stripePaymentProcessingClaims.leaseExpiresAt,
        });
    return renewed?.leaseExpiresAt ?? null;
}

export type StripePaymentProcessingCompletionResult =
    | { status: 'completed'; transactionId: number }
    | { status: 'claim_lost' }
    | { status: 'incomplete'; reason: StripePaymentProcessingIncompleteReason };

export type StripePaymentProcessingIncompleteReason =
    | 'completed_transaction_missing'
    | 'completion_outputs_missing';

export async function completeStripePaymentProcessingClaim({
    claimToken,
    database = storage(),
    now = new Date(),
    stripePaymentId,
}: {
    claimToken: string;
    database?: StorageClient;
    now?: Date;
    stripePaymentId: string;
}): Promise<StripePaymentProcessingCompletionResult> {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select()
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (
            claim?.status !== 'processing' ||
            claim.claimToken !== claimToken ||
            !claim.leaseExpiresAt ||
            claim.leaseExpiresAt.getTime() <= now.getTime()
        ) {
            return { status: 'claim_lost' as const };
        }

        const transaction = await tx.query.transactions.findFirst({
            columns: { id: true },
            where: and(
                eq(transactions.stripePaymentId, normalizedPaymentId),
                eq(transactions.status, 'completed'),
                eq(transactions.isDeleted, false),
            ),
        });
        if (!transaction) {
            return {
                reason: 'completed_transaction_missing' as const,
                status: 'incomplete' as const,
            };
        }

        const outputs = await getStripePaymentCompletionOutputs(
            normalizedPaymentId,
            tx,
        );
        if (!outputs) {
            return {
                reason: 'completion_outputs_missing' as const,
                status: 'incomplete' as const,
            };
        }

        const [transitioned] = await tx
            .update(stripePaymentProcessingClaims)
            .set({
                claimToken: null,
                completedAt: now,
                completedTransactionId: transaction.id,
                leaseExpiresAt: null,
                nextAttemptAt: null,
                status: 'completed',
                updatedAt: now,
            })
            .where(
                and(
                    eq(
                        stripePaymentProcessingClaims.stripePaymentId,
                        normalizedPaymentId,
                    ),
                    eq(stripePaymentProcessingClaims.status, 'processing'),
                    eq(stripePaymentProcessingClaims.claimToken, claimToken),
                    gt(stripePaymentProcessingClaims.leaseExpiresAt, now),
                ),
            )
            .returning({
                stripePaymentId: stripePaymentProcessingClaims.stripePaymentId,
            });
        if (!transitioned) {
            return { status: 'claim_lost' as const };
        }
        return { status: 'completed' as const, transactionId: transaction.id };
    });
}

export type StripePaymentProcessingFailureResult =
    | { attempt: number; status: 'retryable'; nextAttemptAt: Date }
    | { attempt: number; status: 'manual_review'; reason: string }
    | { status: 'claim_lost' };

export async function recordStripePaymentProcessingFailure({
    claimToken,
    countsTowardManualReview = true,
    database = storage(),
    failureCode,
    maxAttempts = stripePaymentProcessingClaimDefaults.maxAttempts,
    now = new Date(),
    retryDelayMs = stripePaymentProcessingClaimDefaults.retryDelayMs,
    retryable = true,
    stripePaymentId,
}: {
    claimToken: string;
    countsTowardManualReview?: boolean;
    database?: StorageClient;
    failureCode: string;
    maxAttempts?: number;
    now?: Date;
    retryDelayMs?: number;
    retryable?: boolean;
    stripePaymentId: string;
}): Promise<StripePaymentProcessingFailureResult> {
    assertPositiveInteger(maxAttempts, 'Stripe claim maximum attempts');
    if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0) {
        throw new RangeError(
            'Stripe claim retry delay must be a non-negative safe integer',
        );
    }
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const normalizedFailureCode = failureCode.trim().slice(0, 120) || 'unknown';

    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select()
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (
            claim?.status !== 'processing' ||
            claim.claimToken !== claimToken ||
            !claim.leaseExpiresAt ||
            claim.leaseExpiresAt.getTime() <= now.getTime()
        ) {
            return { status: 'claim_lost' as const };
        }

        if (
            !retryable ||
            (countsTowardManualReview &&
                getAttemptCountInCurrentReviewCycle(claim) >= maxAttempts)
        ) {
            const reason = retryable
                ? 'attempt_limit_reached'
                : normalizedFailureCode;
            const [transitioned] = await tx
                .update(stripePaymentProcessingClaims)
                .set({
                    claimToken: null,
                    lastFailureAt: now,
                    lastFailureCode: normalizedFailureCode,
                    leaseExpiresAt: null,
                    manualReviewAt: now,
                    manualReviewReason: reason,
                    nextAttemptAt: null,
                    status: 'manual_review',
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(
                            stripePaymentProcessingClaims.stripePaymentId,
                            normalizedPaymentId,
                        ),
                        eq(stripePaymentProcessingClaims.status, 'processing'),
                        eq(
                            stripePaymentProcessingClaims.claimToken,
                            claimToken,
                        ),
                        gt(stripePaymentProcessingClaims.leaseExpiresAt, now),
                    ),
                )
                .returning({
                    stripePaymentId:
                        stripePaymentProcessingClaims.stripePaymentId,
                });
            if (!transitioned) {
                return { status: 'claim_lost' as const };
            }
            return {
                attempt: claim.attemptCount,
                reason,
                status: 'manual_review' as const,
            };
        }

        const nextAttemptAt = addMilliseconds(now, retryDelayMs);
        const [transitioned] = await tx
            .update(stripePaymentProcessingClaims)
            .set({
                ...(countsTowardManualReview
                    ? {}
                    : { attemptCountAtLastRequeue: claim.attemptCount }),
                claimToken: null,
                lastFailureAt: now,
                lastFailureCode: normalizedFailureCode,
                leaseExpiresAt: null,
                nextAttemptAt,
                status: 'retryable',
                updatedAt: now,
            })
            .where(
                and(
                    eq(
                        stripePaymentProcessingClaims.stripePaymentId,
                        normalizedPaymentId,
                    ),
                    eq(stripePaymentProcessingClaims.status, 'processing'),
                    eq(stripePaymentProcessingClaims.claimToken, claimToken),
                    gt(stripePaymentProcessingClaims.leaseExpiresAt, now),
                ),
            )
            .returning({
                stripePaymentId: stripePaymentProcessingClaims.stripePaymentId,
            });
        if (!transitioned) {
            return { status: 'claim_lost' as const };
        }
        return {
            attempt: claim.attemptCount,
            nextAttemptAt,
            status: 'retryable' as const,
        };
    });
}

export type StripePaymentProcessingClaimRequeueResult =
    | { attemptCount: number; status: 'requeued' }
    | { status: 'already_completed'; transactionId: number | null }
    | {
          claimStatus: 'processing' | 'queued' | 'retryable';
          status: 'not_in_manual_review';
      }
    | { status: 'not_found' };

export async function requeueStripePaymentProcessingClaim({
    database = storage(),
    now = new Date(),
    reason,
    reviewedBy,
    stripePaymentId,
}: {
    database?: StorageClient;
    now?: Date;
    reason: string;
    reviewedBy: string;
    stripePaymentId: string;
}): Promise<StripePaymentProcessingClaimRequeueResult> {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const normalizedReason = normalizeManualReviewText(
        reason,
        'Stripe claim review reason',
        500,
    );
    const normalizedReviewedBy = normalizeManualReviewText(
        reviewedBy,
        'Stripe claim reviewer',
        120,
    );

    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select()
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (!claim) {
            return { status: 'not_found' as const };
        }
        if (claim.status === 'completed') {
            return {
                status: 'already_completed' as const,
                transactionId: claim.completedTransactionId,
            };
        }
        if (claim.status !== 'manual_review') {
            return {
                claimStatus: claim.status,
                status: 'not_in_manual_review' as const,
            };
        }

        await tx.insert(stripePaymentProcessingClaimReviews).values({
            action: 'requeued',
            previousAttemptCount: claim.attemptCount,
            previousManualReviewReason: claim.manualReviewReason,
            reason: normalizedReason,
            reviewedBy: normalizedReviewedBy,
            stripePaymentId: normalizedPaymentId,
        });
        await tx
            .update(stripePaymentProcessingClaims)
            .set({
                attemptCountAtLastRequeue: claim.attemptCount,
                claimToken: null,
                leaseExpiresAt: null,
                manualReviewAt: null,
                manualReviewReason: null,
                nextAttemptAt: now,
                status: 'retryable',
                updatedAt: now,
            })
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            );
        return {
            attemptCount: claim.attemptCount,
            status: 'requeued' as const,
        };
    });
}

export type StripePaymentProcessingClaimResolveResult =
    | { status: 'resolved_completed'; transactionId: number }
    | { status: 'already_completed'; transactionId: number | null }
    | {
          claimStatus: 'processing' | 'queued' | 'retryable';
          status: 'not_in_manual_review';
      }
    | { status: 'completed_transaction_missing' }
    | { status: 'completion_outputs_missing' }
    | { status: 'not_found' };

export async function resolveStripePaymentProcessingClaim({
    database = storage(),
    now = new Date(),
    reason,
    reviewedBy,
    stripePaymentId,
}: {
    database?: StorageClient;
    now?: Date;
    reason: string;
    reviewedBy: string;
    stripePaymentId: string;
}): Promise<StripePaymentProcessingClaimResolveResult> {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const normalizedReason = normalizeManualReviewText(
        reason,
        'Stripe claim review reason',
        500,
    );
    const normalizedReviewedBy = normalizeManualReviewText(
        reviewedBy,
        'Stripe claim reviewer',
        120,
    );

    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select()
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (!claim) {
            return { status: 'not_found' as const };
        }
        if (claim.status === 'completed') {
            return {
                status: 'already_completed' as const,
                transactionId: claim.completedTransactionId,
            };
        }
        if (claim.status !== 'manual_review') {
            return {
                claimStatus: claim.status,
                status: 'not_in_manual_review' as const,
            };
        }

        const transaction = await tx.query.transactions.findFirst({
            columns: { id: true },
            where: and(
                eq(transactions.stripePaymentId, normalizedPaymentId),
                eq(transactions.status, 'completed'),
                eq(transactions.isDeleted, false),
            ),
        });
        if (!transaction) {
            return { status: 'completed_transaction_missing' as const };
        }
        if (
            !(await getStripePaymentCompletionOutputs(normalizedPaymentId, tx))
        ) {
            return { status: 'completion_outputs_missing' as const };
        }

        await tx.insert(stripePaymentProcessingClaimReviews).values({
            action: 'resolved_completed',
            completedTransactionId: transaction.id,
            previousAttemptCount: claim.attemptCount,
            previousManualReviewReason: claim.manualReviewReason,
            reason: normalizedReason,
            reviewedBy: normalizedReviewedBy,
            stripePaymentId: normalizedPaymentId,
        });
        await tx
            .update(stripePaymentProcessingClaims)
            .set({
                claimToken: null,
                completedAt: now,
                completedTransactionId: transaction.id,
                leaseExpiresAt: null,
                manualReviewAt: null,
                manualReviewReason: null,
                nextAttemptAt: null,
                status: 'completed',
                updatedAt: now,
            })
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            );
        return {
            status: 'resolved_completed' as const,
            transactionId: transaction.id,
        };
    });
}

export async function getStripePaymentProcessingClaimReviews(
    stripePaymentId: string,
    database: StorageClient = storage(),
) {
    return database.query.stripePaymentProcessingClaimReviews.findMany({
        orderBy: [
            asc(stripePaymentProcessingClaimReviews.createdAt),
            asc(stripePaymentProcessingClaimReviews.id),
        ],
        where: eq(
            stripePaymentProcessingClaimReviews.stripePaymentId,
            normalizeStripePaymentId(stripePaymentId),
        ),
    });
}

function stripePaymentFailureCode(error: unknown) {
    if (
        error instanceof StripePaymentProcessingDeferredError ||
        error instanceof StripePaymentProcessingPermanentError ||
        error instanceof StripePaymentProcessingIncompleteError
    ) {
        return error.failureCode;
    }
    if (
        error instanceof Error &&
        /^[A-Za-z0-9_.:-]{1,120}$/u.test(error.name)
    ) {
        return error.name;
    }
    return 'unknown_error';
}

export type StripePaymentProcessingClaimControl = {
    /** Opaque durable fencing token used by atomic completion-output writes. */
    readonly claimToken: string;
    /**
     * Aborted after this worker observes that its durable claim was lost.
     * Long-running work can pass this signal to APIs that support cancellation.
     */
    readonly signal: AbortSignal;
    /**
     * Revalidates and renews the durable claim before the next side-effect
     * boundary. Throws when another worker owns the claim or its lease expired.
     */
    assertOwned: (
        database?: StripePaymentProcessingDatabaseClient,
    ) => Promise<void>;
};

/**
 * Compatibility wrapper for paid-session processing. Unlike the former
 * advisory lock, this only holds a database client while claiming, heartbeating,
 * failing, or completing. The callback always runs outside a transaction.
 */
export async function withStripePaymentProcessingLock<T>(
    stripePaymentId: string,
    callback: (control: StripePaymentProcessingClaimControl) => Promise<T>,
    {
        database = storage(),
        heartbeatIntervalMs = stripePaymentProcessingClaimDefaults.heartbeatIntervalMs,
        leaseDurationMs = stripePaymentProcessingClaimDefaults.leaseDurationMs,
        maxAttempts = stripePaymentProcessingClaimDefaults.maxAttempts,
        now = () => new Date(),
        retryDelayMs = stripePaymentProcessingClaimDefaults.retryDelayMs,
    }: {
        database?: StorageClient;
        heartbeatIntervalMs?: number;
        leaseDurationMs?: number;
        maxAttempts?: number;
        now?: () => Date;
        retryDelayMs?: number;
    } = {},
): Promise<T | undefined> {
    assertPositiveInteger(
        heartbeatIntervalMs,
        'Stripe claim heartbeat interval',
    );
    if (heartbeatIntervalMs >= leaseDurationMs) {
        throw new RangeError(
            'Stripe claim heartbeat interval must be shorter than its lease',
        );
    }
    const claim = await acquireStripePaymentProcessingClaim(stripePaymentId, {
        database,
        leaseDurationMs,
        maxAttempts,
        now: now(),
    });
    if (claim.status === 'completed') {
        console.info('stripe_payment.processing.duplicate_suppressed', {
            attempt: claim.attempt,
            stripePaymentId,
            transactionId: claim.completedTransactionId,
        });
        return;
    }
    if (claim.status === 'manual_review') {
        console.error('stripe_payment.processing.manual_review', {
            attempt: claim.attempt,
            reason: claim.reason,
            stripePaymentId,
        });
        return;
    }
    if (claim.status === 'unavailable') {
        console.info('stripe_payment.processing.claim_unavailable', {
            attempt: claim.attempt,
            availableAt: claim.availableAt?.toISOString() ?? null,
            claimStatus: claim.claimStatus,
            stripePaymentId,
        });
        throw new StripePaymentProcessingUnavailableError(
            stripePaymentId,
            claim.claimStatus,
            claim.availableAt,
            claim.attempt,
        );
    }
    if (claim.recovered) {
        console.warn('stripe_payment.processing.claim_recovered', {
            attempt: claim.attempt,
            stripePaymentId,
        });
    }

    let claimLost = false;
    const abortController = new AbortController();
    let renewalTail: Promise<void> = Promise.resolve();
    const claimLostError = () =>
        new StripePaymentProcessingClaimLostError(stripePaymentId);
    const markClaimLost = () => {
        if (claimLost) {
            return;
        }
        claimLost = true;
        abortController.abort(claimLostError());
    };
    const queueRenewal = () => {
        const renewal = renewalTail.then(async () => {
            if (claimLost) {
                throw claimLostError();
            }
            const renewedLease = await renewStripePaymentProcessingClaim({
                claimToken: claim.claimToken,
                database,
                leaseDurationMs,
                now: now(),
                stripePaymentId,
            });
            if (!renewedLease) {
                markClaimLost();
                throw claimLostError();
            }
        });
        renewalTail = renewal.catch(() => undefined);
        return renewal;
    };
    const claimControl: StripePaymentProcessingClaimControl = {
        assertOwned: async (activeDatabase) => {
            if (claimLost) {
                throw claimLostError();
            }
            if (activeDatabase) {
                const renewedLease = await renewStripePaymentProcessingClaim({
                    claimToken: claim.claimToken,
                    database: activeDatabase,
                    leaseDurationMs,
                    now: now(),
                    stripePaymentId,
                });
                if (!renewedLease) {
                    markClaimLost();
                    throw claimLostError();
                }
            } else {
                await queueRenewal();
            }
            if (claimLost) {
                throw claimLostError();
            }
        },
        claimToken: claim.claimToken,
        signal: abortController.signal,
    };
    const heartbeat = setInterval(() => {
        void queueRenewal().catch((error: unknown) => {
            if (error instanceof StripePaymentProcessingClaimLostError) {
                return;
            }
            console.error('stripe_payment.processing.heartbeat_failed', {
                attempt: claim.attempt,
                errorCode: stripePaymentFailureCode(error),
                stripePaymentId,
            });
        });
    }, heartbeatIntervalMs);
    heartbeat.unref();

    try {
        const value = await callback(claimControl);
        clearInterval(heartbeat);
        await renewalTail;
        await claimControl.assertOwned();
        const completion = await completeStripePaymentProcessingClaim({
            claimToken: claim.claimToken,
            database,
            now: now(),
            stripePaymentId,
        });
        if (completion.status === 'claim_lost') {
            throw new StripePaymentProcessingClaimLostError(stripePaymentId);
        }
        if (completion.status === 'incomplete') {
            throw new StripePaymentProcessingIncompleteError(completion.reason);
        }
        return value;
    } catch (error) {
        clearInterval(heartbeat);
        await renewalTail;
        const failure = await recordStripePaymentProcessingFailure({
            claimToken: claim.claimToken,
            countsTowardManualReview: !(
                error instanceof StripePaymentProcessingDeferredError
            ),
            database,
            failureCode: stripePaymentFailureCode(error),
            maxAttempts,
            now: now(),
            retryDelayMs,
            retryable: !(
                error instanceof StripePaymentProcessingPermanentError
            ),
            stripePaymentId,
        });
        if (failure.status === 'manual_review') {
            console.error('stripe_payment.processing.manual_review', {
                attempt: failure.attempt,
                errorCode: stripePaymentFailureCode(error),
                reason: failure.reason,
                stripePaymentId,
            });
            return;
        }
        throw error;
    }
}

export async function getStripePaymentProcessingClaim(
    stripePaymentId: string,
    database: StorageClient = storage(),
) {
    return database.query.stripePaymentProcessingClaims.findFirst({
        where: eq(
            stripePaymentProcessingClaims.stripePaymentId,
            normalizeStripePaymentId(stripePaymentId),
        ),
    });
}

function stripePaymentProcessingRecoverableAt() {
    return sql<Date>`case
        when ${stripePaymentProcessingClaims.status} = 'processing'
            then coalesce(
                ${stripePaymentProcessingClaims.leaseExpiresAt},
                ${stripePaymentProcessingClaims.updatedAt}
            )
        when ${stripePaymentProcessingClaims.status} = 'queued'
            then ${stripePaymentProcessingClaims.updatedAt}
        else coalesce(
            ${stripePaymentProcessingClaims.nextAttemptAt},
            ${stripePaymentProcessingClaims.updatedAt}
        )
    end`;
}

export async function getRecoverableStripePaymentIds({
    database = storage(),
    limit = 50,
    now = new Date(),
}: {
    database?: StorageClient;
    limit?: number;
    now?: Date;
} = {}) {
    assertPositiveInteger(limit, 'Stripe claim recovery limit');
    const recoverableAt = stripePaymentProcessingRecoverableAt();
    const claims = await database
        .select({
            stripePaymentId: stripePaymentProcessingClaims.stripePaymentId,
        })
        .from(stripePaymentProcessingClaims)
        .where(
            or(
                eq(stripePaymentProcessingClaims.status, 'queued'),
                and(
                    eq(stripePaymentProcessingClaims.status, 'processing'),
                    or(
                        isNull(stripePaymentProcessingClaims.leaseExpiresAt),
                        lte(stripePaymentProcessingClaims.leaseExpiresAt, now),
                    ),
                ),
                and(
                    eq(stripePaymentProcessingClaims.status, 'retryable'),
                    or(
                        isNull(stripePaymentProcessingClaims.nextAttemptAt),
                        lte(stripePaymentProcessingClaims.nextAttemptAt, now),
                    ),
                ),
            ),
        )
        .orderBy(
            asc(recoverableAt),
            asc(stripePaymentProcessingClaims.updatedAt),
            asc(stripePaymentProcessingClaims.stripePaymentId),
        )
        .limit(limit);
    return claims.map((claim) => claim.stripePaymentId);
}

export async function getStripePaymentProcessingHealth({
    database = storage(),
    now = new Date(),
}: {
    database?: StorageClient;
    now?: Date;
} = {}) {
    const status = stripePaymentProcessingClaims.status;
    const leaseExpiresAt = stripePaymentProcessingClaims.leaseExpiresAt;
    const nextAttemptAt = stripePaymentProcessingClaims.nextAttemptAt;
    const updatedAt = stripePaymentProcessingClaims.updatedAt;
    const recoverableAt = stripePaymentProcessingRecoverableAt();
    const nullableUpdatedAtDecoder = {
        mapFromDriverValue(value: unknown): Date | null {
            if (value === null || value instanceof Date) {
                return value;
            }
            if (typeof value === 'string') {
                const hasExplicitTimeZone =
                    /(?:z|[+-]\d{2}(?::?\d{2})?)$/iu.test(value);
                const date = new Date(
                    hasExplicitTimeZone ? value : `${value}+0000`,
                );
                if (!Number.isNaN(date.getTime())) {
                    return date;
                }
            }
            throw new Error(
                'Stripe payment processing health returned an invalid timestamp',
            );
        },
    };
    const [health] = await database
        .select({
            dueRetryableCount: sql<number>`count(*) filter (
                where ${status} = 'retryable'
                  and (${nextAttemptAt} is null or ${nextAttemptAt} <= ${now})
            )::integer`,
            expiredLeaseCount: sql<number>`count(*) filter (
                where ${status} = 'processing'
                  and (${leaseExpiresAt} is null or ${leaseExpiresAt} <= ${now})
            )::integer`,
            manualReviewCount: sql<number>`count(*) filter (
                where ${status} = 'manual_review'
            )::integer`,
            maxAttemptCount: sql<number>`coalesce(
                max(${stripePaymentProcessingClaims.attemptCount}),
                0
            )::integer`,
            oldestManualReviewAt: sql`min(${updatedAt}) filter (
                where ${status} = 'manual_review'
            )`.mapWith(nullableUpdatedAtDecoder),
            oldestRecoverableAt: sql`min(${recoverableAt}) filter (
                where ${status} = 'queued' or (
                    ${status} = 'processing'
                    and (${leaseExpiresAt} is null or ${leaseExpiresAt} <= ${now})
                ) or (
                    ${status} = 'retryable'
                    and (${nextAttemptAt} is null or ${nextAttemptAt} <= ${now})
                )
            )`.mapWith(nullableUpdatedAtDecoder),
            processingCount: sql<number>`count(*) filter (
                where ${status} = 'processing'
            )::integer`,
            queuedCount: sql<number>`count(*) filter (
                where ${status} = 'queued'
            )::integer`,
            retryableCount: sql<number>`count(*) filter (
                where ${status} = 'retryable'
            )::integer`,
        })
        .from(stripePaymentProcessingClaims)
        .where(
            inArray(status, [
                'queued',
                'processing',
                'retryable',
                'manual_review',
            ]),
        );
    if (!health) {
        throw new Error(
            'Stripe payment processing health query returned no row',
        );
    }
    return health;
}

export async function getTransaction(transactionId: number) {
    return storage().query.transactions.findFirst({
        where: and(
            eq(transactions.id, transactionId),
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: true,
        },
    });
}

export async function getAllTransactions({
    filter,
}: {
    filter?: { accountId?: string };
} = {}) {
    return storage().query.transactions.findMany({
        where: and(
            filter?.accountId
                ? eq(transactions.accountId, filter.accountId)
                : undefined,
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: {
                where: eq(invoices.isDeleted, false),
            },
        },
        orderBy: transactions.createdAt,
    });
}

export async function getTransactionByStripeId(stripePaymentId: string) {
    return storage().query.transactions.findFirst({
        where: and(
            eq(transactions.stripePaymentId, stripePaymentId),
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: true,
        },
    });
}

export async function updateTransaction(transaction: UpdateTransaction) {
    await storage()
        .update(transactions)
        .set(transaction)
        .where(
            and(
                eq(transactions.id, transaction.id),
                eq(transactions.isDeleted, false),
            ),
        );

    if (transaction.status) {
        await createEvent(
            knownEvents.transactions.updatedV1(transaction.id.toString(), {
                status: transaction.status,
            }),
        );
    }
}

export async function deleteTransaction(transactionId: number) {
    await storage()
        .update(transactions)
        .set({ isDeleted: true })
        .where(eq(transactions.id, transactionId));

    await createEvent(
        knownEvents.transactions.deletedV1(transactionId.toString()),
    );
}
