import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    commitStripePaymentDiscoveryCheckpoint,
    enqueueStripePaymentProcessingClaims,
    getStripePaymentDiscoveryCheckpoint,
    getStripePaymentProcessingClaim,
    getStripePaymentRecoveryCursor,
    takeNextRecoverableStripePaymentCandidate,
} from '@gredice/storage';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
// @ts-expect-error Type definitions for the pg ESM entry are not resolved under NodeNext
import { Pool } from 'pg';
import * as schema from '../src/schema';
import { createTestDb } from './testDb';

const realPostgresTestOptions = {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'TEST_POSTGRES_URL is required for real PostgreSQL reconciliation concurrency',
    timeout: 15_000,
};

function paymentId(label: string) {
    return `cs_test_${label}_${randomUUID()}`;
}

function createRealPostgresTestDatabase() {
    const connectionString = process.env.TEST_POSTGRES_URL;
    assert.ok(connectionString);
    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 1_000,
        max: 4,
    });
    return { database: drizzle(pool, { schema }), pool };
}

type RealPostgresTestDatabase = ReturnType<
    typeof createRealPostgresTestDatabase
>['database'];

async function prepareRecoveryWindow(
    database: RealPostgresTestDatabase,
    schedulerIds: readonly number[],
    now: Date,
) {
    assert.ok(schedulerIds.length > 0);
    const current = await getStripePaymentRecoveryCursor({ database });
    const firstSchedulerId = Math.min(...schedulerIds);
    const lastSchedulerId = Math.max(...schedulerIds);
    const [cursor] = await database
        .update(schema.stripePaymentRecoveryCursors)
        .set({
            afterSchedulerId: firstSchedulerId - 1,
            revision: current.revision + 1,
            throughSchedulerId: lastSchedulerId,
            updatedAt: now,
        })
        .where(
            and(
                eq(schema.stripePaymentRecoveryCursors.id, 1),
                eq(
                    schema.stripePaymentRecoveryCursors.revision,
                    current.revision,
                ),
            ),
        )
        .returning();
    assert.ok(cursor);
    return cursor;
}

async function resetRecoveryWindow(database: RealPostgresTestDatabase) {
    await database
        .update(schema.stripePaymentRecoveryCursors)
        .set({
            afterSchedulerId: null,
            revision: sql`${schema.stripePaymentRecoveryCursors.revision} + 1`,
            throughSchedulerId: null,
            updatedAt: new Date(),
        })
        .where(eq(schema.stripePaymentRecoveryCursors.id, 1));
}

async function deleteTestClaims(
    database: RealPostgresTestDatabase,
    stripePaymentIds: readonly string[],
) {
    if (stripePaymentIds.length === 0) return;
    await database
        .delete(schema.stripePaymentProcessingClaims)
        .where(
            inArray(
                schema.stripePaymentProcessingClaims.stripePaymentId,
                stripePaymentIds,
            ),
        );
}

async function closeRealPostgresTestDatabase(
    testDatabase: ReturnType<typeof createRealPostgresTestDatabase>,
    stripePaymentIds: readonly string[],
    { resetRecovery = false }: { resetRecovery?: boolean } = {},
) {
    try {
        if (resetRecovery) {
            await resetRecoveryWindow(testDatabase.database);
        }
    } finally {
        try {
            await deleteTestClaims(testDatabase.database, stripePaymentIds);
        } finally {
            await testDatabase.pool.end();
        }
    }
}

async function takeCandidateAfterStaleRevision(
    database: RealPostgresTestDatabase,
    initialRevision: number,
    now: Date,
) {
    let expectedRevision = initialRevision;
    let staleRevisionCount = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await takeNextRecoverableStripePaymentCandidate({
            database,
            expectedRevision,
            now,
        });
        if (result.status === 'candidate') {
            return { candidate: result.candidate, staleRevisionCount };
        }
        if (result.status === 'cycle_complete') {
            throw new Error(
                'Recovery cycle completed before a candidate was taken',
            );
        }
        staleRevisionCount += 1;
        expectedRevision = result.cursor.revision;
    }
    throw new Error('Recovery cursor remained stale after five attempts');
}

async function finishCurrentRecoveryCycle(maximumCandidates = 2_000) {
    let cursor = await getStripePaymentRecoveryCursor();
    for (let index = 0; index < maximumCandidates; index += 1) {
        const result = await takeNextRecoverableStripePaymentCandidate({
            expectedRevision: cursor.revision,
        });
        cursor = result.cursor;
        if (result.status === 'cycle_complete') return cursor;
    }
    throw new Error('Existing Stripe recovery cycle did not complete');
}

test('discovery commit durably enqueues IDs before advancing its frozen cursor', async () => {
    createTestDb();
    const firstId = paymentId('discovery-first');
    const secondId = paymentId('discovery-second');
    const staleId = paymentId('discovery-stale');
    const checkpoint = await getStripePaymentDiscoveryCheckpoint();
    const rangeGte = new Date('2026-08-01T00:00:00.000Z');
    const rangeLte = new Date('2026-08-02T00:00:00.000Z');

    const committed = await commitStripePaymentDiscoveryCheckpoint({
        enqueueStripePaymentIds: [firstId, secondId, firstId],
        expectedRevision: checkpoint.revision,
        next: {
            exhaustiveUpperBound: rangeLte,
            rangeGte,
            rangeLte,
            startingAfter: secondId,
        },
        now: rangeLte,
    });
    assert.equal(committed.status, 'committed');
    assert.equal(committed.checkpoint.revision, checkpoint.revision + 1);
    assert.equal(
        committed.checkpoint.rangeGte?.toISOString(),
        rangeGte.toISOString(),
    );
    assert.equal(
        committed.checkpoint.rangeLte?.toISOString(),
        rangeLte.toISOString(),
    );
    assert.equal(committed.checkpoint.startingAfter, secondId);
    assert.equal(
        (await getStripePaymentProcessingClaim(firstId))?.status,
        'queued',
    );
    assert.equal(
        (await getStripePaymentProcessingClaim(secondId))?.status,
        'queued',
    );

    const stale = await commitStripePaymentDiscoveryCheckpoint({
        enqueueStripePaymentIds: [staleId],
        expectedRevision: checkpoint.revision,
        next: {
            exhaustiveUpperBound: rangeLte,
            rangeGte,
            rangeLte,
            startingAfter: staleId,
        },
        now: rangeLte,
    });
    assert.equal(stale.status, 'stale');
    assert.equal(await getStripePaymentProcessingClaim(staleId), undefined);
});

test('recovery cursor advances fairly past 125 poisoned queued claims and freezes its high-water mark', async () => {
    createTestDb();
    await finishCurrentRecoveryCycle();

    const expectedIds = Array.from({ length: 125 }, (_, index) =>
        paymentId(`fair-${index.toString().padStart(3, '0')}`),
    );
    const enqueue = await enqueueStripePaymentProcessingClaims(expectedIds);
    assert.equal(enqueue.enqueuedIds.length, expectedIds.length);

    let cursor = await getStripePaymentRecoveryCursor();
    const first = await takeNextRecoverableStripePaymentCandidate({
        expectedRevision: cursor.revision,
    });
    assert.equal(first.status, 'candidate');
    if (first.status !== 'candidate') return;
    cursor = first.cursor;

    const lateId = paymentId('late-high-water');
    await enqueueStripePaymentProcessingClaims([lateId]);
    const selected = new Set([first.candidate.stripePaymentId]);
    for (let index = 0; index < 2_000; index += 1) {
        const result = await takeNextRecoverableStripePaymentCandidate({
            expectedRevision: cursor.revision,
        });
        cursor = result.cursor;
        if (result.status === 'candidate') {
            assert.equal(selected.has(result.candidate.stripePaymentId), false);
            selected.add(result.candidate.stripePaymentId);
            continue;
        }
        assert.equal(result.status, 'cycle_complete');
        break;
    }

    assert.equal(selected.has(lateId), false);
    for (const stripePaymentId of expectedIds) {
        assert.equal(selected.has(stripePaymentId), true);
    }

    let lateSelected = false;
    for (let index = 0; index < 2_000; index += 1) {
        const nextCycle = await takeNextRecoverableStripePaymentCandidate({
            expectedRevision: cursor.revision,
        });
        cursor = nextCycle.cursor;
        if (nextCycle.status === 'candidate') {
            lateSelected ||= nextCycle.candidate.stripePaymentId === lateId;
            continue;
        }
        assert.equal(nextCycle.status, 'cycle_complete');
        break;
    }
    // The poisoned rows are eligible again only after the prior fair pass
    // wrapped; the late row is now inside the newly frozen high-water.
    assert.equal(lateSelected, true);
});

test('recovery cursor rejects stale concurrent revisions without consuming a candidate', async () => {
    createTestDb();
    await finishCurrentRecoveryCycle();
    const stripePaymentId = paymentId('stale-recovery');
    await enqueueStripePaymentProcessingClaims([stripePaymentId]);
    const cursor = await getStripePaymentRecoveryCursor();

    const winner = await takeNextRecoverableStripePaymentCandidate({
        expectedRevision: cursor.revision,
    });
    assert.equal(winner.status, 'candidate');
    const stale = await takeNextRecoverableStripePaymentCandidate({
        expectedRevision: cursor.revision,
    });
    assert.equal(stale.status, 'stale');
    assert.equal(stale.cursor.revision, winner.cursor.revision);
});

test(
    'real PostgreSQL commits exactly one simultaneous discovery revision without orphan enqueue',
    realPostgresTestOptions,
    async () => {
        const testDatabase = createRealPostgresTestDatabase();
        const { database } = testDatabase;
        const stripePaymentIds = [
            paymentId('postgres-discovery-first'),
            paymentId('postgres-discovery-second'),
        ];
        let originalCheckpoint:
            | Awaited<ReturnType<typeof getStripePaymentDiscoveryCheckpoint>>
            | undefined;

        try {
            originalCheckpoint = await getStripePaymentDiscoveryCheckpoint({
                database,
            });
            const expectedRevision = originalCheckpoint.revision;
            const rangeGte = new Date('2026-08-03T00:00:00.000Z');
            const rangeLte = new Date('2026-08-04T00:00:00.000Z');
            const results = await Promise.all(
                stripePaymentIds.map((stripePaymentId) =>
                    commitStripePaymentDiscoveryCheckpoint({
                        database,
                        enqueueStripePaymentIds: [stripePaymentId],
                        expectedRevision,
                        next: {
                            exhaustiveUpperBound: rangeLte,
                            rangeGte,
                            rangeLte,
                            startingAfter: stripePaymentId,
                        },
                        now: rangeLte,
                    }),
                ),
            );

            assert.deepEqual(results.map((result) => result.status).sort(), [
                'committed',
                'stale',
            ]);
            const committedIndex = results.findIndex(
                (result) => result.status === 'committed',
            );
            assert.notEqual(committedIndex, -1);
            const committedStripePaymentId = stripePaymentIds[committedIndex];
            assert.ok(committedStripePaymentId);
            const claims = await database
                .select({
                    stripePaymentId:
                        schema.stripePaymentProcessingClaims.stripePaymentId,
                })
                .from(schema.stripePaymentProcessingClaims)
                .where(
                    inArray(
                        schema.stripePaymentProcessingClaims.stripePaymentId,
                        stripePaymentIds,
                    ),
                );
            assert.deepEqual(claims, [
                { stripePaymentId: committedStripePaymentId },
            ]);
        } finally {
            try {
                if (originalCheckpoint) {
                    await database
                        .update(schema.stripePaymentDiscoveryCheckpoints)
                        .set({
                            exhaustiveUpperBound:
                                originalCheckpoint.exhaustiveUpperBound,
                            rangeGte: originalCheckpoint.rangeGte,
                            rangeLte: originalCheckpoint.rangeLte,
                            revision: sql`${schema.stripePaymentDiscoveryCheckpoints.revision} + 1`,
                            startingAfter: originalCheckpoint.startingAfter,
                            updatedAt: new Date(),
                        })
                        .where(
                            eq(schema.stripePaymentDiscoveryCheckpoints.id, 1),
                        );
                }
            } finally {
                await closeRealPostgresTestDatabase(
                    testDatabase,
                    stripePaymentIds,
                );
            }
        }
    },
);

test(
    'real PostgreSQL simultaneous recovery takers advance to distinct candidates',
    realPostgresTestOptions,
    async () => {
        const testDatabase = createRealPostgresTestDatabase();
        const { database } = testDatabase;
        const now = new Date('2026-08-04T09:00:00.000Z');
        const stripePaymentIds = [
            paymentId('postgres-recovery-first'),
            paymentId('postgres-recovery-second'),
        ];
        let recoveryWindowPrepared = false;

        try {
            const claims = await database
                .insert(schema.stripePaymentProcessingClaims)
                .values(
                    stripePaymentIds.map((stripePaymentId) => ({
                        createdAt: now,
                        status: 'queued' as const,
                        stripePaymentId,
                        updatedAt: now,
                    })),
                )
                .returning({
                    schedulerId:
                        schema.stripePaymentProcessingClaims.schedulerId,
                });
            const cursor = await prepareRecoveryWindow(
                database,
                claims.map((claim) => claim.schedulerId),
                now,
            );
            recoveryWindowPrepared = true;

            const candidates = await Promise.all([
                takeCandidateAfterStaleRevision(database, cursor.revision, now),
                takeCandidateAfterStaleRevision(database, cursor.revision, now),
            ]);
            assert.deepEqual(
                new Set(
                    candidates.map(
                        ({ candidate }) => candidate.stripePaymentId,
                    ),
                ),
                new Set(stripePaymentIds),
            );
            assert.equal(
                new Set(
                    candidates.map(({ candidate }) => candidate.schedulerId),
                ).size,
                2,
            );
            assert.equal(
                candidates.reduce(
                    (total, candidate) => total + candidate.staleRevisionCount,
                    0,
                ),
                1,
            );
        } finally {
            await closeRealPostgresTestDatabase(
                testDatabase,
                stripePaymentIds,
                { resetRecovery: recoveryWindowPrepared },
            );
        }
    },
);

test(
    'real PostgreSQL checkpoint update failure rolls back its claim enqueue',
    realPostgresTestOptions,
    async () => {
        const testDatabase = createRealPostgresTestDatabase();
        const { database } = testDatabase;
        const stripePaymentId = paymentId('postgres-checkpoint-rollback');
        const failureCursor =
            '__stripe_payment_checkpoint_forced_failure_test__';
        const constraintName = `stripe_payment_checkpoint_failure_${randomUUID().replaceAll('-', '')}`;
        let constraintInstalled = false;

        try {
            await database.execute(sql`
                ALTER TABLE ${schema.stripePaymentDiscoveryCheckpoints}
                ADD CONSTRAINT ${sql.identifier(constraintName)}
                CHECK (
                    "starting_after" IS DISTINCT FROM
                    '__stripe_payment_checkpoint_forced_failure_test__'
                ) NOT VALID
            `);
            constraintInstalled = true;
            const before = await getStripePaymentDiscoveryCheckpoint({
                database,
            });
            const rangeGte = new Date('2026-08-03T00:00:00.000Z');
            const rangeLte = new Date('2026-08-04T00:00:00.000Z');

            await assert.rejects(() =>
                commitStripePaymentDiscoveryCheckpoint({
                    database,
                    enqueueStripePaymentIds: [stripePaymentId],
                    expectedRevision: before.revision,
                    next: {
                        exhaustiveUpperBound: rangeLte,
                        rangeGte,
                        rangeLte,
                        startingAfter: failureCursor,
                    },
                    now: rangeLte,
                }),
            );

            const after = await getStripePaymentDiscoveryCheckpoint({
                database,
            });
            assert.equal(after.revision, before.revision);
            assert.equal(after.startingAfter, before.startingAfter);
            assert.equal(
                await getStripePaymentProcessingClaim(
                    stripePaymentId,
                    database,
                ),
                undefined,
            );
        } finally {
            try {
                if (constraintInstalled) {
                    await database.execute(sql`
                        ALTER TABLE ${schema.stripePaymentDiscoveryCheckpoints}
                        DROP CONSTRAINT ${sql.identifier(constraintName)}
                    `);
                }
            } finally {
                await closeRealPostgresTestDatabase(testDatabase, [
                    stripePaymentId,
                ]);
            }
        }
    },
);

test(
    'real PostgreSQL recovery skips active and future claims while selecting queued, expired, and due claims',
    realPostgresTestOptions,
    async () => {
        const testDatabase = createRealPostgresTestDatabase();
        const { database } = testDatabase;
        const now = new Date('2026-08-04T10:00:00.000Z');
        const past = new Date(now.getTime() - 60_000);
        const future = new Date(now.getTime() + 60_000);
        const stripePaymentIds = {
            active: paymentId('postgres-active-processing'),
            due: paymentId('postgres-due-retry'),
            expired: paymentId('postgres-expired-processing'),
            future: paymentId('postgres-future-retry'),
            queued: paymentId('postgres-queued'),
        };
        const allStripePaymentIds = Object.values(stripePaymentIds);
        let recoveryWindowPrepared = false;

        try {
            const claims = await database
                .insert(schema.stripePaymentProcessingClaims)
                .values([
                    {
                        createdAt: now,
                        status: 'queued',
                        stripePaymentId: stripePaymentIds.queued,
                        updatedAt: now,
                    },
                    {
                        claimToken: randomUUID(),
                        claimedAt: now,
                        createdAt: now,
                        leaseExpiresAt: future,
                        status: 'processing',
                        stripePaymentId: stripePaymentIds.active,
                        updatedAt: now,
                    },
                    {
                        claimToken: randomUUID(),
                        claimedAt: past,
                        createdAt: past,
                        leaseExpiresAt: past,
                        status: 'processing',
                        stripePaymentId: stripePaymentIds.expired,
                        updatedAt: past,
                    },
                    {
                        createdAt: now,
                        nextAttemptAt: future,
                        status: 'retryable',
                        stripePaymentId: stripePaymentIds.future,
                        updatedAt: now,
                    },
                    {
                        createdAt: past,
                        nextAttemptAt: past,
                        status: 'retryable',
                        stripePaymentId: stripePaymentIds.due,
                        updatedAt: past,
                    },
                ])
                .returning({
                    schedulerId:
                        schema.stripePaymentProcessingClaims.schedulerId,
                });
            let cursor = await prepareRecoveryWindow(
                database,
                claims.map((claim) => claim.schedulerId),
                now,
            );
            recoveryWindowPrepared = true;
            const selected = new Set<string>();

            for (let index = 0; index < 3; index += 1) {
                const result = await takeNextRecoverableStripePaymentCandidate({
                    database,
                    expectedRevision: cursor.revision,
                    now,
                });
                assert.equal(result.status, 'candidate');
                if (result.status !== 'candidate') return;
                selected.add(result.candidate.stripePaymentId);
                cursor = result.cursor;
            }

            const completed = await takeNextRecoverableStripePaymentCandidate({
                database,
                expectedRevision: cursor.revision,
                now,
            });
            assert.equal(completed.status, 'cycle_complete');
            assert.deepEqual(
                selected,
                new Set([
                    stripePaymentIds.queued,
                    stripePaymentIds.expired,
                    stripePaymentIds.due,
                ]),
            );
            assert.equal(selected.has(stripePaymentIds.active), false);
            assert.equal(selected.has(stripePaymentIds.future), false);
        } finally {
            await closeRealPostgresTestDatabase(
                testDatabase,
                allStripePaymentIds,
                { resetRecovery: recoveryWindowPrepared },
            );
        }
    },
);
