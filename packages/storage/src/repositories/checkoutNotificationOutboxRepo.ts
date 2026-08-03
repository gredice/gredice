import 'server-only';

import { createHash } from 'node:crypto';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { accountUsers, emailMessages, users } from '../schema';
import { storage } from '../storage';

export const checkoutNotificationOutboxKind = 'checkout_notification';
export const checkoutNotificationMaxAttempts = 3;

const templateName = 'checkout-notification';
const messageType = 'checkout';
const fromAddress = 'suncokret@obavijesti.gredice.com';
const retryDelaysMs = [60_000, 5 * 60_000] as const;
const configurationRetryDelayMs = 60_000;
const providerOperationIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const intentLockTails = new Map<string, Promise<void>>();

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type CheckoutNotificationDatabaseClient =
    | StorageClient
    | TransactionClient;

export type CheckoutNotificationPayload =
    | {
          kind: 'operation_scheduled_slack';
          operationId: number;
          scheduledDate: string;
      }
    | {
          kind: 'delivery_created_slack';
          requestId: string;
      }
    | {
          kind: 'delivery_scheduled_email';
          requestId: string;
          to: string;
      };

export type CheckoutNotificationClaim = {
    attempt: number;
    claimId: string;
    emailMessageId: number;
    maxAttempts: number;
    payload: CheckoutNotificationPayload;
    providerOperationId: string;
    queuedAt: Date;
};

export type CheckoutNotificationClaimResult =
    | { claim: CheckoutNotificationClaim; status: 'claimed' }
    | { status: 'empty' }
    | {
          emailMessageId: number;
          status: 'attempts_exhausted' | 'invalid';
      };

export type CheckoutNotificationFailureCode =
    | 'configuration_error'
    | 'invalid_payload'
    | 'provider_rejected_retryable'
    | 'provider_rejected_terminal'
    | 'provider_submission_uncertain'
    | 'render_failed'
    | 'transport_before_submission'
    | 'worker_error_before_submission';

type Metadata = Record<string, unknown>;

function requirePositiveInteger(value: number, label: string) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive integer`);
    }
}

function normalizeClaimId(claimId: string) {
    const normalized = claimId.trim();
    if (!normalized || normalized.length > 128) {
        throw new TypeError(
            'Checkout notification claim ID must contain 1 to 128 characters',
        );
    }
    return normalized;
}

function providerOperationId(intentKey: string) {
    const digest = createHash('sha256').update(intentKey).digest('hex');
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

async function withIntentLock<T>(
    intentKey: string,
    db: CheckoutNotificationDatabaseClient,
    callback: () => Promise<T>,
) {
    if (!isPgliteTestDatabase()) {
        await db.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`checkout-notification:${intentKey}`}));`,
        );
        return callback();
    }

    const previous = intentLockTails.get(intentKey) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    intentLockTails.set(intentKey, tail);
    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (intentLockTails.get(intentKey) === tail) {
            intentLockTails.delete(intentKey);
        }
    }
}

function readAttemptCount(metadata: Metadata) {
    const count = metadata.attemptCount;
    return typeof count === 'number' && Number.isInteger(count) && count >= 0
        ? count
        : 0;
}

function parsePayload(
    metadata: Metadata,
    recipient: string | undefined,
): CheckoutNotificationPayload | null {
    if (metadata.outboxKind !== checkoutNotificationOutboxKind) return null;
    const kind = metadata.notificationKind;
    if (kind === 'operation_scheduled_slack') {
        const operationId = metadata.operationId;
        const scheduledDate = metadata.scheduledDate;
        if (
            typeof operationId !== 'number' ||
            !Number.isInteger(operationId) ||
            operationId <= 0 ||
            typeof scheduledDate !== 'string' ||
            Number.isNaN(new Date(scheduledDate).getTime())
        ) {
            return null;
        }
        return { kind, operationId, scheduledDate };
    }
    if (kind === 'delivery_created_slack') {
        const requestId = metadata.requestId;
        return typeof requestId === 'string' && requestId.length > 0
            ? { kind, requestId }
            : null;
    }
    if (kind === 'delivery_scheduled_email') {
        const requestId = metadata.requestId;
        const to = recipient?.trim().toLowerCase();
        return typeof requestId === 'string' &&
            requestId.length > 0 &&
            to &&
            to.length <= 320 &&
            to.includes('@')
            ? { kind, requestId, to }
            : null;
    }
    return null;
}

function initialMetadata(payload: CheckoutNotificationPayload): Metadata {
    const source =
        payload.kind === 'operation_scheduled_slack'
            ? {
                  operationId: payload.operationId,
                  scheduledDate: payload.scheduledDate,
              }
            : { requestId: payload.requestId };
    return {
        ...source,
        attemptCount: 0,
        maxAttempts: checkoutNotificationMaxAttempts,
        nextAttemptAt: null,
        notificationKind: payload.kind,
        outboxKind: checkoutNotificationOutboxKind,
        outboxVersion: 1,
    };
}

async function enqueue(
    payload: CheckoutNotificationPayload,
    intentKey: string,
    db: CheckoutNotificationDatabaseClient,
    now = new Date(),
) {
    return withIntentLock(intentKey, db, async () => {
        const operationId = providerOperationId(intentKey);
        const existing = await db.query.emailMessages.findFirst({
            columns: { id: true },
            where: and(
                eq(emailMessages.providerMessageId, operationId),
                sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
            ),
        });
        if (existing) return existing.id;

        const [created] = await db
            .insert(emailMessages)
            .values({
                attachments: [],
                createdAt: now,
                fromAddress,
                messageType,
                metadata: initialMetadata(payload),
                provider:
                    payload.kind === 'delivery_scheduled_email'
                        ? 'acs'
                        : 'slack',
                providerMessageId: operationId,
                providerStatus: 'outbox_ready',
                queuedAt: now,
                recipients: {
                    to:
                        payload.kind === 'delivery_scheduled_email'
                            ? [{ address: payload.to }]
                            : [],
                },
                status: 'queued',
                subject: `Checkout notification: ${payload.kind}`,
                templateName,
                updatedAt: now,
            })
            .returning({ id: emailMessages.id });
        if (!created) {
            throw new Error('Failed to enqueue checkout notification');
        }
        return created.id;
    });
}

export async function enqueueCheckoutOperationScheduledNotification(
    {
        operationId,
        scheduledDate,
    }: { operationId: number; scheduledDate: Date },
    db: CheckoutNotificationDatabaseClient,
) {
    requirePositiveInteger(operationId, 'Operation ID');
    if (Number.isNaN(scheduledDate.getTime())) {
        throw new TypeError('Scheduled date must be valid');
    }
    return enqueue(
        {
            kind: 'operation_scheduled_slack',
            operationId,
            scheduledDate: scheduledDate.toISOString(),
        },
        `operation-scheduled-slack:${operationId.toString()}`,
        db,
    );
}

export async function enqueueCheckoutDeliveryNotifications(
    {
        accountId,
        addressId,
        mode,
        requestId,
        slotId,
    }: {
        accountId: string;
        addressId?: number;
        mode: 'delivery' | 'pickup';
        requestId: string;
        slotId: number;
    },
    db: CheckoutNotificationDatabaseClient,
) {
    await enqueue(
        { kind: 'delivery_created_slack', requestId },
        `delivery-created-slack:${requestId}`,
        db,
    );
    if (mode !== 'delivery') return;

    const rows = await db
        .select({ email: users.userName })
        .from(accountUsers)
        .innerJoin(users, eq(users.id, accountUsers.userId))
        .where(eq(accountUsers.accountId, accountId));
    const recipients = Array.from(
        new Set(
            rows
                .map(({ email }) => email.trim().toLowerCase())
                .filter((email) => email.length > 0 && email.includes('@')),
        ),
    ).sort();
    const groupKey = [
        accountId,
        mode,
        slotId.toString(),
        ...(addressId === undefined ? [] : [`address:${addressId.toString()}`]),
    ].join('|');
    for (const to of recipients) {
        await enqueue(
            { kind: 'delivery_scheduled_email', requestId, to },
            `delivery-scheduled-email:${groupKey}:${to}`,
            db,
        );
    }
}

function dueWhere(now: Date) {
    const nowIso = now.toISOString();
    return and(
        eq(emailMessages.templateName, templateName),
        sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
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

export async function claimCheckoutNotification({
    claimExpiresAt,
    claimId,
    now = new Date(),
}: {
    claimExpiresAt: Date;
    claimId: string;
    now?: Date;
}): Promise<CheckoutNotificationClaimResult> {
    const normalizedClaimId = normalizeClaimId(claimId);
    if (claimExpiresAt.getTime() <= now.getTime()) {
        throw new RangeError('Checkout notification claim must expire later');
    }
    return storage().transaction(async (tx) => {
        const [candidate] = await tx
            .select()
            .from(emailMessages)
            .where(dueWhere(now))
            .orderBy(asc(emailMessages.queuedAt), asc(emailMessages.id))
            .for('update', { skipLocked: true })
            .limit(1);
        if (!candidate) return { status: 'empty' };

        const attemptCount = readAttemptCount(candidate.metadata);
        if (attemptCount >= checkoutNotificationMaxAttempts) {
            await tx
                .update(emailMessages)
                .set({
                    completedAt: now,
                    errorCode: 'attempts_exhausted',
                    errorMessage:
                        'Checkout notification attempts were exhausted.',
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
        const payload = parsePayload(
            candidate.metadata,
            candidate.recipients.to[0]?.address,
        );
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
                    errorMessage: 'Checkout notification payload is invalid.',
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
                maxAttempts: checkoutNotificationMaxAttempts,
                payload,
                providerOperationId: operationId,
                queuedAt: candidate.queuedAt,
            },
            status: 'claimed',
        };
    });
}

export async function startCheckoutNotificationSubmission({
    claimId,
    emailMessageId,
    now = new Date(),
}: {
    claimId: string;
    emailMessageId: number;
    now?: Date;
}) {
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
            return { reason: 'not_found', status: 'unavailable' } as const;
        }
        if (
            message.status !== 'sending' ||
            message.providerStatus !== 'outbox_claimed' ||
            message.metadata.claimId !== normalizedClaimId
        ) {
            return { reason: 'not_claimed', status: 'unavailable' } as const;
        }
        const expiresAt = message.metadata.claimExpiresAt;
        if (typeof expiresAt !== 'string' || expiresAt <= now.toISOString()) {
            return { reason: 'claim_expired', status: 'unavailable' } as const;
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
        return { status: 'started' } as const;
    });
}

export async function markCheckoutNotificationSent({
    claimId,
    emailMessageId,
    providerDeliveryId,
    providerStatus,
    now = new Date(),
}: {
    claimId: string;
    emailMessageId: number;
    providerDeliveryId?: string | null;
    providerStatus?: string | null;
    now?: Date;
}) {
    const normalizedClaimId = normalizeClaimId(claimId);
    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) return { status: 'unavailable' } as const;
        if (message.status === 'sent') {
            return { status: 'already_sent' } as const;
        }
        if (
            message.status !== 'sending' ||
            message.providerStatus !== 'submission_started' ||
            message.metadata.claimId !== normalizedClaimId
        ) {
            return { status: 'unavailable' } as const;
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
                    providerDeliveryId: providerDeliveryId?.trim() || null,
                },
                providerStatus: providerStatus?.trim() || 'succeeded',
                sentAt: now,
                status: 'sent',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));
        return { status: 'sent' } as const;
    });
}

export async function markCheckoutNotificationSkipped({
    claimId,
    emailMessageId,
    reason,
    now = new Date(),
}: {
    claimId: string;
    emailMessageId: number;
    reason: 'ineligible' | 'missing_destination' | 'source_not_found';
    now?: Date;
}) {
    const normalizedClaimId = normalizeClaimId(claimId);
    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) return { status: 'unavailable' } as const;
        if (
            message.status !== 'sending' ||
            !['outbox_claimed', 'submission_started'].includes(
                message.providerStatus ?? '',
            ) ||
            message.metadata.claimId !== normalizedClaimId
        ) {
            return { status: 'unavailable' } as const;
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
                    skippedReason: reason,
                },
                providerStatus: `skipped_${reason}`,
                sentAt: now,
                status: 'sent',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));
        return { status: 'skipped' } as const;
    });
}

export async function markCheckoutNotificationFailed({
    claimId,
    emailMessageId,
    failureCode,
    failureKind,
    now = new Date(),
}: {
    claimId: string;
    emailMessageId: number;
    failureCode: CheckoutNotificationFailureCode;
    failureKind: 'configuration' | 'retryable' | 'terminal' | 'uncertain';
    now?: Date;
}) {
    const normalizedClaimId = normalizeClaimId(claimId);
    return storage().transaction(async (tx) => {
        const [message] = await tx
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, emailMessageId))
            .for('update')
            .limit(1);
        if (!message) return { status: 'unavailable' } as const;
        const attempt = readAttemptCount(message.metadata);
        if (message.status === 'failed') {
            return { attempt, status: 'failed' } as const;
        }
        if (message.metadata.claimId !== normalizedClaimId) {
            return { status: 'unavailable' } as const;
        }
        const claimed =
            message.status === 'sending' &&
            message.providerStatus === 'outbox_claimed';
        const started =
            message.status === 'sending' &&
            message.providerStatus === 'submission_started';
        if (
            (!claimed && !started) ||
            (failureKind === 'uncertain' && !started)
        ) {
            return { status: 'unavailable' } as const;
        }
        if (failureKind === 'uncertain') {
            await tx
                .update(emailMessages)
                .set({
                    errorCode: failureCode,
                    errorMessage:
                        'Provider outcome is uncertain; automatic retry is fenced.',
                    metadata: {
                        ...message.metadata,
                        submissionUncertainAt: now.toISOString(),
                    },
                    providerStatus: 'submission_uncertain',
                    status: 'sending',
                    updatedAt: now,
                })
                .where(eq(emailMessages.id, emailMessageId));
            return { status: 'fenced' } as const;
        }
        if (failureKind === 'configuration' && claimed) {
            const nextAttemptAt = new Date(
                now.getTime() + configurationRetryDelayMs,
            );
            await tx
                .update(emailMessages)
                .set({
                    errorCode: failureCode,
                    errorMessage: 'Waiting for provider configuration.',
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
            return {
                attempt,
                nextAttemptAt,
                status: 'retry_scheduled',
            } as const;
        }
        if (
            failureKind === 'retryable' &&
            attempt < checkoutNotificationMaxAttempts
        ) {
            const delay =
                retryDelaysMs[attempt - 1] ??
                retryDelaysMs[retryDelaysMs.length - 1];
            const nextAttemptAt = new Date(now.getTime() + delay);
            await tx
                .update(emailMessages)
                .set({
                    errorCode: failureCode,
                    errorMessage:
                        'Checkout notification delivery failed safely.',
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
            return {
                attempt,
                nextAttemptAt,
                status: 'retry_scheduled',
            } as const;
        }
        await tx
            .update(emailMessages)
            .set({
                completedAt: now,
                errorCode: failureCode,
                errorMessage:
                    failureKind === 'retryable'
                        ? 'Checkout notification delivery attempts were exhausted.'
                        : 'Checkout notification delivery failed permanently.',
                metadata: {
                    ...message.metadata,
                    lastFailureAt: now.toISOString(),
                },
                providerStatus:
                    failureKind === 'retryable'
                        ? 'retry_exhausted'
                        : 'terminal_failure',
                status: 'failed',
                updatedAt: now,
            })
            .where(eq(emailMessages.id, emailMessageId));
        return { attempt, status: 'failed' } as const;
    });
}

export type CheckoutNotificationOutboxHealth = {
    claimedCount: number;
    dueCount: number;
    failedCount: number;
    fencedCount: number;
    oldestDueAt: string | null;
    oldestFencedAt: string | null;
    observedAt: string;
    queuedCount: number;
    retryExhaustedCount: number;
    staleClaimedCount: number;
    staleFencedCount: number;
};

function timestamp(value: Date | string | null) {
    if (value === null) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function getCheckoutNotificationOutboxHealth({
    now = new Date(),
    staleBefore,
}: {
    now?: Date;
    staleBefore: Date;
}): Promise<CheckoutNotificationOutboxHealth> {
    const nowIso = now.toISOString();
    const staleIso = staleBefore.toISOString();
    const queued = eq(emailMessages.status, 'queued');
    const due = and(
        queued,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'nextAttemptAt', '') <= ${nowIso}`,
    );
    const claimed = and(
        eq(emailMessages.status, 'sending'),
        eq(emailMessages.providerStatus, 'outbox_claimed'),
    );
    const staleClaimed = and(
        claimed,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'claimExpiresAt', '') <= ${nowIso}`,
    );
    const fenced = and(
        eq(emailMessages.status, 'sending'),
        or(
            eq(emailMessages.providerStatus, 'submission_started'),
            eq(emailMessages.providerStatus, 'submission_uncertain'),
        ),
    );
    const staleFenced = and(
        fenced,
        sql<boolean>`coalesce(${emailMessages.metadata}->>'submissionUncertainAt', ${emailMessages.metadata}->>'submissionStartedAt', '') <= ${staleIso}`,
    );
    const failed = eq(emailMessages.status, 'failed');
    const [result] = await storage()
        .select({
            claimedCount: sql<number>`count(*) filter (where ${claimed})::integer`,
            dueCount: sql<number>`count(*) filter (where ${due})::integer`,
            failedCount: sql<number>`count(*) filter (where ${failed})::integer`,
            fencedCount: sql<number>`count(*) filter (where ${fenced})::integer`,
            oldestDueAt:
                sql<Date | null>`min(${emailMessages.queuedAt}) filter (where ${due})`.mapWith(
                    emailMessages.queuedAt,
                ),
            oldestFencedAt: sql<
                string | null
            >`min(coalesce(${emailMessages.metadata}->>'submissionUncertainAt', ${emailMessages.metadata}->>'submissionStartedAt')) filter (where ${fenced})`,
            queuedCount: sql<number>`count(*) filter (where ${queued})::integer`,
            retryExhaustedCount: sql<number>`count(*) filter (where ${and(failed, eq(emailMessages.providerStatus, 'retry_exhausted'))})::integer`,
            staleClaimedCount: sql<number>`count(*) filter (where ${staleClaimed})::integer`,
            staleFencedCount: sql<number>`count(*) filter (where ${staleFenced})::integer`,
        })
        .from(emailMessages)
        .where(
            and(
                eq(emailMessages.templateName, templateName),
                sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
                or(
                    eq(emailMessages.status, 'failed'),
                    eq(emailMessages.status, 'queued'),
                    eq(emailMessages.status, 'sending'),
                ),
            ),
        );
    if (!result) {
        throw new Error('Failed to inspect checkout notification outbox');
    }
    return {
        ...result,
        observedAt: nowIso,
        oldestDueAt: timestamp(result.oldestDueAt),
        oldestFencedAt: timestamp(result.oldestFencedAt),
    };
}
