import 'server-only';

import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import {
    stripePaymentDiscoveryCheckpoints,
    stripePaymentProcessingClaims,
    stripePaymentRecoveryCursors,
} from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type StripePaymentReconciliationDatabaseClient =
    | StorageClient
    | TransactionClient;

const singletonId = 1;
const maximumStripePaymentIdLength = 255;

function normalizeStripePaymentId(stripePaymentId: string) {
    const normalized = stripePaymentId.trim();
    if (!normalized || normalized.length > maximumStripePaymentIdLength) {
        throw new TypeError(
            `Stripe payment ID must contain 1 to ${maximumStripePaymentIdLength.toString()} characters`,
        );
    }
    return normalized;
}

function normalizeStripePaymentIds(stripePaymentIds: readonly string[]) {
    return [...new Set(stripePaymentIds.map(normalizeStripePaymentId))];
}

function requireRevision(revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new RangeError(
            'Stripe reconciliation revision must be a non-negative safe integer',
        );
    }
}

function requireValidDate(value: Date, label: string) {
    if (!Number.isFinite(value.getTime())) {
        throw new RangeError(`${label} must be a valid date`);
    }
}

function normalizeOptionalCursor(value: string | null) {
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > maximumStripePaymentIdLength) {
        throw new TypeError(
            `Stripe pagination cursor must contain 1 to ${maximumStripePaymentIdLength.toString()} characters`,
        );
    }
    return normalized;
}

async function ensureDiscoveryCheckpoint(
    database: StripePaymentReconciliationDatabaseClient,
) {
    await database
        .insert(stripePaymentDiscoveryCheckpoints)
        .values({ id: singletonId })
        .onConflictDoNothing({ target: stripePaymentDiscoveryCheckpoints.id });
    const [checkpoint] = await database
        .select()
        .from(stripePaymentDiscoveryCheckpoints)
        .where(eq(stripePaymentDiscoveryCheckpoints.id, singletonId))
        .limit(1);
    if (!checkpoint) {
        throw new Error('Stripe payment discovery checkpoint is unavailable');
    }
    return checkpoint;
}

async function ensureRecoveryCursor(
    database: StripePaymentReconciliationDatabaseClient,
) {
    await database
        .insert(stripePaymentRecoveryCursors)
        .values({ id: singletonId })
        .onConflictDoNothing({ target: stripePaymentRecoveryCursors.id });
    const [cursor] = await database
        .select()
        .from(stripePaymentRecoveryCursors)
        .where(eq(stripePaymentRecoveryCursors.id, singletonId))
        .limit(1);
    if (!cursor) {
        throw new Error('Stripe payment recovery cursor is unavailable');
    }
    return cursor;
}

export async function enqueueStripePaymentProcessingClaims(
    stripePaymentIds: readonly string[],
    {
        database = storage(),
        now = new Date(),
    }: {
        database?: StripePaymentReconciliationDatabaseClient;
        now?: Date;
    } = {},
) {
    requireValidDate(now, 'Stripe claim enqueue time');
    const normalizedIds = normalizeStripePaymentIds(stripePaymentIds);
    if (normalizedIds.length === 0) {
        return { enqueuedIds: [] as string[] };
    }
    const created = await database
        .insert(stripePaymentProcessingClaims)
        .values(
            normalizedIds.map((stripePaymentId) => ({
                attemptCount: 0,
                createdAt: now,
                status: 'queued' as const,
                stripePaymentId,
                updatedAt: now,
            })),
        )
        .onConflictDoNothing({
            target: stripePaymentProcessingClaims.stripePaymentId,
        })
        .returning({
            stripePaymentId: stripePaymentProcessingClaims.stripePaymentId,
        });
    return { enqueuedIds: created.map((claim) => claim.stripePaymentId) };
}

export async function getStripePaymentDiscoveryCheckpoint({
    database = storage(),
}: {
    database?: StripePaymentReconciliationDatabaseClient;
} = {}) {
    return ensureDiscoveryCheckpoint(database);
}

export type StripePaymentDiscoveryCheckpointNext = {
    exhaustiveUpperBound: Date;
    rangeGte: Date;
    rangeLte: Date;
    startingAfter: string | null;
};

function normalizeDiscoveryCheckpointNext(
    next: StripePaymentDiscoveryCheckpointNext,
) {
    requireValidDate(next.rangeGte, 'Stripe discovery lower bound');
    requireValidDate(next.rangeLte, 'Stripe discovery upper bound');
    requireValidDate(
        next.exhaustiveUpperBound,
        'Stripe discovery exhaustive upper bound',
    );
    if (next.rangeLte.getTime() < next.rangeGte.getTime()) {
        throw new RangeError(
            'Stripe discovery upper bound must not precede its lower bound',
        );
    }
    if (next.exhaustiveUpperBound.getTime() !== next.rangeLte.getTime()) {
        throw new RangeError(
            'Stripe discovery exhaustive upper bound must equal the frozen range upper bound',
        );
    }
    return {
        exhaustiveUpperBound: next.exhaustiveUpperBound,
        rangeGte: next.rangeGte,
        rangeLte: next.rangeLte,
        startingAfter: normalizeOptionalCursor(next.startingAfter),
    };
}

export type StripePaymentDiscoveryCheckpointCommitResult =
    | {
          checkpoint: Awaited<
              ReturnType<typeof getStripePaymentDiscoveryCheckpoint>
          >;
          status: 'committed';
      }
    | {
          checkpoint: Awaited<
              ReturnType<typeof getStripePaymentDiscoveryCheckpoint>
          >;
          status: 'stale';
      };

export async function commitStripePaymentDiscoveryCheckpoint({
    database = storage(),
    enqueueStripePaymentIds,
    expectedRevision,
    next,
    now = new Date(),
}: {
    database?: StorageClient;
    enqueueStripePaymentIds: readonly string[];
    expectedRevision: number;
    next: StripePaymentDiscoveryCheckpointNext;
    now?: Date;
}): Promise<StripePaymentDiscoveryCheckpointCommitResult> {
    requireRevision(expectedRevision);
    requireValidDate(now, 'Stripe discovery checkpoint update time');
    const normalizedNext = normalizeDiscoveryCheckpointNext(next);
    const normalizedIds = normalizeStripePaymentIds(enqueueStripePaymentIds);

    return database.transaction(async (tx) => {
        await tx
            .insert(stripePaymentDiscoveryCheckpoints)
            .values({ id: singletonId })
            .onConflictDoNothing({
                target: stripePaymentDiscoveryCheckpoints.id,
            });
        const [current] = await tx
            .select()
            .from(stripePaymentDiscoveryCheckpoints)
            .where(eq(stripePaymentDiscoveryCheckpoints.id, singletonId))
            .for('update')
            .limit(1);
        if (!current) {
            throw new Error(
                'Stripe payment discovery checkpoint is unavailable',
            );
        }
        if (current.revision !== expectedRevision) {
            return { checkpoint: current, status: 'stale' as const };
        }

        await enqueueStripePaymentProcessingClaims(normalizedIds, {
            database: tx,
            now,
        });
        const [checkpoint] = await tx
            .update(stripePaymentDiscoveryCheckpoints)
            .set({
                ...normalizedNext,
                revision: current.revision + 1,
                updatedAt: now,
            })
            .where(
                and(
                    eq(stripePaymentDiscoveryCheckpoints.id, singletonId),
                    eq(
                        stripePaymentDiscoveryCheckpoints.revision,
                        expectedRevision,
                    ),
                ),
            )
            .returning();
        if (!checkpoint) {
            throw new Error(
                'Stripe payment discovery checkpoint revision changed while locked',
            );
        }
        return { checkpoint, status: 'committed' as const };
    });
}

export async function getStripePaymentRecoveryCursor({
    database = storage(),
}: {
    database?: StripePaymentReconciliationDatabaseClient;
} = {}) {
    return ensureRecoveryCursor(database);
}

export type StripePaymentRecoveryCandidateResult =
    | {
          candidate: { schedulerId: number; stripePaymentId: string };
          cursor: Awaited<ReturnType<typeof getStripePaymentRecoveryCursor>>;
          status: 'candidate';
      }
    | {
          cursor: Awaited<ReturnType<typeof getStripePaymentRecoveryCursor>>;
          status: 'cycle_complete';
      }
    | {
          cursor: Awaited<ReturnType<typeof getStripePaymentRecoveryCursor>>;
          status: 'stale';
      };

export async function takeNextRecoverableStripePaymentCandidate({
    database = storage(),
    expectedRevision,
    now = new Date(),
}: {
    database?: StorageClient;
    expectedRevision: number;
    now?: Date;
}): Promise<StripePaymentRecoveryCandidateResult> {
    requireRevision(expectedRevision);
    requireValidDate(now, 'Stripe recovery cursor time');

    return database.transaction(async (tx) => {
        await tx
            .insert(stripePaymentRecoveryCursors)
            .values({ id: singletonId })
            .onConflictDoNothing({ target: stripePaymentRecoveryCursors.id });
        const [current] = await tx
            .select()
            .from(stripePaymentRecoveryCursors)
            .where(eq(stripePaymentRecoveryCursors.id, singletonId))
            .for('update')
            .limit(1);
        if (!current) {
            throw new Error('Stripe payment recovery cursor is unavailable');
        }
        if (current.revision !== expectedRevision) {
            return { cursor: current, status: 'stale' as const };
        }

        let throughSchedulerId = current.throughSchedulerId;
        if (throughSchedulerId === null) {
            const [highest] = await tx
                .select({
                    schedulerId: stripePaymentProcessingClaims.schedulerId,
                })
                .from(stripePaymentProcessingClaims)
                // Selecting the mapped bigint column avoids an unparsed
                // node-postgres `max(bigint)` string.
                .orderBy(desc(stripePaymentProcessingClaims.schedulerId))
                .limit(1);
            throughSchedulerId = highest?.schedulerId ?? null;
        }

        const recoverable = or(
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
        );
        const candidate =
            throughSchedulerId === null
                ? undefined
                : (
                      await tx
                          .select({
                              schedulerId:
                                  stripePaymentProcessingClaims.schedulerId,
                              stripePaymentId:
                                  stripePaymentProcessingClaims.stripePaymentId,
                          })
                          .from(stripePaymentProcessingClaims)
                          .where(
                              and(
                                  lte(
                                      stripePaymentProcessingClaims.schedulerId,
                                      throughSchedulerId,
                                  ),
                                  current.afterSchedulerId === null
                                      ? undefined
                                      : gt(
                                            stripePaymentProcessingClaims.schedulerId,
                                            current.afterSchedulerId,
                                        ),
                                  recoverable,
                              ),
                          )
                          .orderBy(
                              asc(stripePaymentProcessingClaims.schedulerId),
                          )
                          .limit(1)
                  )[0];

        const [cursor] = await tx
            .update(stripePaymentRecoveryCursors)
            .set({
                afterSchedulerId: candidate?.schedulerId ?? null,
                revision: current.revision + 1,
                throughSchedulerId: candidate ? throughSchedulerId : null,
                updatedAt: now,
            })
            .where(
                and(
                    eq(stripePaymentRecoveryCursors.id, singletonId),
                    eq(stripePaymentRecoveryCursors.revision, expectedRevision),
                ),
            )
            .returning();
        if (!cursor) {
            throw new Error(
                'Stripe payment recovery cursor revision changed while locked',
            );
        }
        return candidate
            ? { candidate, cursor, status: 'candidate' as const }
            : { cursor, status: 'cycle_complete' as const };
    });
}
