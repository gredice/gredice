import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type {
    SelectStripePaymentDiscoveryCheckpoint,
    SelectStripePaymentRecoveryCursor,
} from '@gredice/storage';
import {
    handleStripeCheckoutReconciliationCron,
    type StripeCheckoutReconciliationCronDependencies,
} from './stripeCheckoutReconciliationCron';

const observedAt = new Date('2026-08-03T09:15:00.000Z');
const initialRangeGte = new Date('2026-07-31T09:00:00.000Z');
const initialRangeLte = new Date('2026-08-03T09:00:00.000Z');
const healthyClaims = {
    dueRetryableCount: 0,
    expiredLeaseCount: 0,
    manualReviewCount: 0,
    maxAttemptCount: 0,
    oldestManualReviewAt: null,
    oldestRecoverableAt: null,
    processingCount: 0,
    queuedCount: 0,
    retryableCount: 0,
};

function configureCronSecret(t: TestContext) {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';
}

function cronRequest(authorization?: string) {
    return new Request('https://api.gredice.com/api/stripe/cron', {
        headers: authorization ? { authorization } : undefined,
    });
}

function baseDependencies(): StripeCheckoutReconciliationCronDependencies {
    let checkpoint: SelectStripePaymentDiscoveryCheckpoint = {
        createdAt: observedAt,
        exhaustiveUpperBound: initialRangeLte,
        id: 1,
        rangeGte: initialRangeGte,
        rangeLte: initialRangeLte,
        revision: 0,
        startingAfter: null,
        updatedAt: observedAt,
    };
    let recoveryCursor: SelectStripePaymentRecoveryCursor = {
        afterSchedulerId: null,
        createdAt: observedAt,
        id: 1,
        revision: 0,
        throughSchedulerId: null,
        updatedAt: observedAt,
    };
    return {
        commitDiscovery: async ({ expectedRevision, next }) => {
            if (expectedRevision !== checkpoint.revision) {
                return { checkpoint, status: 'stale' };
            }
            checkpoint = {
                ...checkpoint,
                ...next,
                revision: checkpoint.revision + 1,
            };
            return { checkpoint, status: 'committed' };
        },
        discoverPage: async () => ({
            hasMore: false,
            nextStartingAfter: null,
            sessions: [],
        }),
        getDiscoveryCheckpoint: async () => checkpoint,
        getRecoveryCursor: async () => recoveryCursor,
        health: async () => healthyClaims,
        maintenanceEnabled: () => false,
        monotonicNowMs: () => 0,
        now: () => observedAt,
        process: async () => undefined,
        takeRecoveryCandidate: async ({ expectedRevision }) => {
            if (expectedRevision !== recoveryCursor.revision) {
                return { cursor: recoveryCursor, status: 'stale' };
            }
            recoveryCursor = {
                ...recoveryCursor,
                afterSchedulerId: null,
                revision: recoveryCursor.revision + 1,
                throughSchedulerId: null,
            };
            return { cursor: recoveryCursor, status: 'cycle_complete' };
        },
    };
}

test('Stripe reconciliation cron fails closed before invoking dependencies', async (t) => {
    configureCronSecret(t);
    let calls = 0;
    const dependencies = baseDependencies();
    dependencies.maintenanceEnabled = () => {
        calls += 1;
        return false;
    };

    const invalid = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer wrong'),
        dependencies,
    );
    assert.strictEqual(invalid.status, 401);
    assert.strictEqual(
        invalid.headers.get('cache-control'),
        'private, no-store',
    );

    delete process.env.CRON_SECRET;
    const missing = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer undefined'),
        dependencies,
    );
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(calls, 0);
});

test('discovery resumes 501 sessions across invocations with one frozen range', async (t) => {
    configureCronSecret(t);
    const firstInvocationAt = new Date('2026-08-03T10:00:00.000Z');
    const secondInvocationAt = new Date('2026-08-03T11:00:00.000Z');
    let invocationAt = firstInvocationAt;
    let monotonicMs = 0;
    let pageIndex = 0;
    let checkpoint: SelectStripePaymentDiscoveryCheckpoint = {
        createdAt: observedAt,
        exhaustiveUpperBound: initialRangeLte,
        id: 1,
        rangeGte: initialRangeGte,
        rangeLte: initialRangeLte,
        revision: 0,
        startingAfter: null,
        updatedAt: observedAt,
    };
    const committedPages: string[][] = [];
    const dependencies = baseDependencies();
    dependencies.now = () => invocationAt;
    dependencies.monotonicNowMs = () => monotonicMs;
    dependencies.getDiscoveryCheckpoint = async () => checkpoint;
    dependencies.discoverPage = async (range) => {
        if (pageIndex >= 6) {
            assert.strictEqual(
                range.rangeGte.toISOString(),
                '2026-08-03T08:55:00.000Z',
            );
            assert.strictEqual(range.rangeLte, secondInvocationAt);
            pageIndex += 1;
            monotonicMs += 5_000;
            return {
                hasMore: false,
                nextStartingAfter: null,
                sessions: [],
            };
        }
        assert.strictEqual(range.rangeGte, initialRangeGte);
        assert.strictEqual(range.rangeLte, initialRangeLte);
        const offset = pageIndex * 100;
        const size = pageIndex === 5 ? 1 : 100;
        const sessions = Array.from({ length: size }, (_, index) => ({
            id: `cs_${(offset + index).toString().padStart(3, '0')}`,
        }));
        pageIndex += 1;
        monotonicMs += 5_000;
        return {
            hasMore: pageIndex < 6,
            nextStartingAfter:
                pageIndex < 6 ? (sessions.at(-1)?.id ?? null) : null,
            sessions,
        };
    };
    dependencies.commitDiscovery = async ({
        enqueueStripePaymentIds,
        expectedRevision,
        next,
    }) => {
        assert.strictEqual(expectedRevision, checkpoint.revision);
        if (next.startingAfter) {
            assert.strictEqual(
                next.startingAfter,
                enqueueStripePaymentIds.at(-1),
            );
        }
        // The page IDs and cursor move arrive in one storage operation; storage
        // commits the enqueue before exposing the new cursor revision.
        committedPages.push([...enqueueStripePaymentIds]);
        checkpoint = {
            ...checkpoint,
            ...next,
            revision: checkpoint.revision + 1,
        };
        return { checkpoint, status: 'committed' };
    };

    const first = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(first.status, 503);
    assert.strictEqual(pageIndex, 3);
    assert.strictEqual(checkpoint.startingAfter, 'cs_299');
    assert.strictEqual(
        (await first.json()).checkoutSessionDiscoveryTruncated,
        true,
    );

    invocationAt = secondInvocationAt;
    const second = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(second.status, 503);
    assert.strictEqual(pageIndex, 6);
    assert.strictEqual(committedPages.flat().length, 501);
    assert.ok(checkpoint.rangeGte);
    assert.strictEqual(
        checkpoint.rangeGte.toISOString(),
        '2026-08-03T08:55:00.000Z',
    );
    assert.strictEqual(checkpoint.rangeLte, secondInvocationAt);
    assert.strictEqual(checkpoint.exhaustiveUpperBound, secondInvocationAt);
    assert.strictEqual(checkpoint.startingAfter, null);

    const third = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(third.status, 200);
    assert.strictEqual(pageIndex, 7);
    assert.strictEqual(committedPages.flat().length, 501);
    assert.ok(checkpoint.rangeGte);
    assert.strictEqual(
        checkpoint.rangeGte.toISOString(),
        '2026-08-03T10:55:00.000Z',
    );
    assert.strictEqual(checkpoint.rangeLte, secondInvocationAt);
});

test('discovery scans a newly opened range in the same invocation', async (t) => {
    configureCronSecret(t);
    const newerSessionCreatedAt = new Date('2026-08-03T09:30:00.000Z');
    let invocationAt = new Date('2026-08-03T10:00:00.000Z');
    let checkpoint: SelectStripePaymentDiscoveryCheckpoint = {
        createdAt: observedAt,
        exhaustiveUpperBound: initialRangeLte,
        id: 1,
        rangeGte: initialRangeGte,
        rangeLte: initialRangeLte,
        revision: 0,
        startingAfter: null,
        updatedAt: observedAt,
    };
    const enqueued: string[] = [];
    const dependencies = baseDependencies();
    dependencies.now = () => invocationAt;
    dependencies.getDiscoveryCheckpoint = async () => checkpoint;
    dependencies.discoverPage = async ({ rangeGte, rangeLte }) => ({
        hasMore: false,
        nextStartingAfter: null,
        sessions:
            newerSessionCreatedAt.getTime() >= rangeGte.getTime() &&
            newerSessionCreatedAt.getTime() <= rangeLte.getTime()
                ? [{ id: 'cs_newer' }]
                : [],
    });
    dependencies.commitDiscovery = async ({
        enqueueStripePaymentIds,
        next,
    }) => {
        enqueued.push(...enqueueStripePaymentIds);
        checkpoint = {
            ...checkpoint,
            ...next,
            revision: checkpoint.revision + 1,
        };
        return { checkpoint, status: 'committed' };
    };

    await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.deepStrictEqual(enqueued, ['cs_newer']);
    assert.strictEqual(checkpoint.rangeLte, invocationAt);

    invocationAt = new Date('2026-08-03T11:00:00.000Z');
    await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.deepStrictEqual(enqueued, ['cs_newer']);
});

test('recovery continues when Stripe discovery fails', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'error', () => undefined);
    const processed: string[] = [];
    let recoveryCursor: SelectStripePaymentRecoveryCursor = {
        afterSchedulerId: null,
        createdAt: observedAt,
        id: 1,
        revision: 0,
        throughSchedulerId: null,
        updatedAt: observedAt,
    };
    let candidatePending = true;
    const dependencies = baseDependencies();
    dependencies.discoverPage = async () => {
        throw new Error('private provider response');
    };
    dependencies.getRecoveryCursor = async () => recoveryCursor;
    dependencies.takeRecoveryCandidate = async () => {
        recoveryCursor = candidatePending
            ? {
                  ...recoveryCursor,
                  afterSchedulerId: 7,
                  revision: recoveryCursor.revision + 1,
                  throughSchedulerId: 7,
              }
            : {
                  ...recoveryCursor,
                  afterSchedulerId: null,
                  revision: recoveryCursor.revision + 1,
                  throughSchedulerId: null,
              };
        if (candidatePending) {
            candidatePending = false;
            return {
                candidate: {
                    schedulerId: 7,
                    stripePaymentId: 'cs_recoverable',
                },
                cursor: recoveryCursor,
                status: 'candidate',
            };
        }
        return { cursor: recoveryCursor, status: 'cycle_complete' };
    };
    dependencies.process = async (stripePaymentId) => {
        processed.push(stripePaymentId);
    };

    const response = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(processed, ['cs_recoverable']);
});

test('fair recovery advances beyond 125 poisoned candidates across invocations', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'error', () => undefined);
    const candidates = Array.from({ length: 126 }, (_, index) => ({
        schedulerId: index + 1,
        stripePaymentId: index === 125 ? 'cs_due' : `cs_poison_${index + 1}`,
    }));
    let cursor: SelectStripePaymentRecoveryCursor = {
        afterSchedulerId: null,
        createdAt: observedAt,
        id: 1,
        revision: 0,
        throughSchedulerId: null,
        updatedAt: observedAt,
    };
    const processed: string[] = [];
    const dependencies = baseDependencies();
    dependencies.getRecoveryCursor = async () => cursor;
    dependencies.takeRecoveryCandidate = async ({ expectedRevision }) => {
        assert.strictEqual(expectedRevision, cursor.revision);
        const throughSchedulerId =
            cursor.throughSchedulerId ?? candidates.at(-1)?.schedulerId ?? null;
        const next = candidates.find(
            (candidate) =>
                candidate.schedulerId > (cursor.afterSchedulerId ?? 0) &&
                candidate.schedulerId <= (throughSchedulerId ?? 0),
        );
        if (!next) {
            cursor = {
                ...cursor,
                afterSchedulerId: null,
                revision: cursor.revision + 1,
                throughSchedulerId: null,
            };
            return { cursor, status: 'cycle_complete' };
        }
        cursor = {
            ...cursor,
            afterSchedulerId: next.schedulerId,
            revision: cursor.revision + 1,
            throughSchedulerId,
        };
        return { candidate: next, cursor, status: 'candidate' };
    };
    dependencies.process = async (stripePaymentId) => {
        assert.strictEqual(
            cursor.afterSchedulerId,
            candidates.find(
                (candidate) => candidate.stripePaymentId === stripePaymentId,
            )?.schedulerId,
        );
        processed.push(stripePaymentId);
        if (stripePaymentId !== 'cs_due') {
            throw new Error('poisoned candidate');
        }
    };

    for (let invocation = 0; invocation < 3; invocation += 1) {
        await handleStripeCheckoutReconciliationCron(
            cronRequest('Bearer cron-secret'),
            dependencies,
        );
    }

    assert.strictEqual(processed.length, 126);
    assert.strictEqual(processed.at(-1), 'cs_due');
    assert.strictEqual(cursor.afterSchedulerId, null);
    assert.strictEqual(cursor.throughSchedulerId, null);
});

test('soft budget stops before new work and preserves the recovery cursor', async (t) => {
    configureCronSecret(t);
    let monotonicMs = 0;
    const candidates = Array.from({ length: 10 }, (_, index) => ({
        schedulerId: index + 1,
        stripePaymentId: `cs_${index + 1}`,
    }));
    let cursor: SelectStripePaymentRecoveryCursor = {
        afterSchedulerId: null,
        createdAt: observedAt,
        id: 1,
        revision: 0,
        throughSchedulerId: null,
        updatedAt: observedAt,
    };
    const processed: string[] = [];
    const dependencies = baseDependencies();
    dependencies.monotonicNowMs = () => monotonicMs;
    dependencies.getRecoveryCursor = async () => cursor;
    dependencies.takeRecoveryCandidate = async () => {
        const throughSchedulerId =
            cursor.throughSchedulerId ?? candidates.at(-1)?.schedulerId ?? null;
        const next = candidates.find(
            (candidate) =>
                candidate.schedulerId > (cursor.afterSchedulerId ?? 0) &&
                candidate.schedulerId <= (throughSchedulerId ?? 0),
        );
        assert.ok(next);
        cursor = {
            ...cursor,
            afterSchedulerId: next.schedulerId,
            revision: cursor.revision + 1,
            throughSchedulerId,
        };
        return { candidate: next, cursor, status: 'candidate' };
    };
    dependencies.process = async (stripePaymentId) => {
        assert.strictEqual(cursor.afterSchedulerId, processed.length + 1);
        processed.push(stripePaymentId);
        monotonicMs += 11_000;
    };

    const response = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(response.status, 503);
    assert.deepStrictEqual(processed, ['cs_1', 'cs_2']);
    assert.strictEqual(cursor.afterSchedulerId, 2);
    assert.strictEqual(cursor.throughSchedulerId, 10);
});

test('one slow recovery candidate prevents another start near the hard limit', async (t) => {
    configureCronSecret(t);
    let monotonicMs = 0;
    let schedulerId = 0;
    const processed: string[] = [];
    const dependencies = baseDependencies();
    dependencies.monotonicNowMs = () => monotonicMs;
    dependencies.takeRecoveryCandidate = async () => {
        schedulerId += 1;
        return {
            candidate: {
                schedulerId,
                stripePaymentId: `cs_slow_${schedulerId.toString()}`,
            },
            cursor: {
                afterSchedulerId: schedulerId,
                createdAt: observedAt,
                id: 1,
                revision: schedulerId,
                throughSchedulerId: 2,
                updatedAt: observedAt,
            },
            status: 'candidate',
        };
    };
    dependencies.process = async (stripePaymentId) => {
        processed.push(stripePaymentId);
        monotonicMs += 26_000;
    };

    const response = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );

    assert.strictEqual(response.status, 503);
    assert.deepStrictEqual(processed, ['cs_slow_1']);
    assert.strictEqual(schedulerId, 1);
    assert.strictEqual(monotonicMs, 26_000);
});

test('a queued claim beyond the frozen recovery high-water keeps cron unhealthy', async (t) => {
    configureCronSecret(t);
    const dependencies = baseDependencies();
    dependencies.health = async () => ({
        ...healthyClaims,
        oldestRecoverableAt: observedAt,
        queuedCount: 1,
    });

    const response = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(response.status, 503);
    assert.strictEqual((await response.json()).success, false);
});

test('maintenance pauses Stripe cron work only after authentication', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'warn', () => undefined);
    let calls = 0;
    const dependencies = baseDependencies();
    dependencies.maintenanceEnabled = () => true;
    dependencies.getDiscoveryCheckpoint = async () => {
        calls += 1;
        return {
            createdAt: observedAt,
            exhaustiveUpperBound: null,
            id: 1,
            rangeGte: null,
            rangeLte: null,
            revision: 0,
            startingAfter: null,
            updatedAt: observedAt,
        };
    };
    dependencies.getRecoveryCursor = async () => {
        calls += 1;
        return {
            afterSchedulerId: null,
            createdAt: observedAt,
            id: 1,
            revision: 0,
            throughSchedulerId: null,
            updatedAt: observedAt,
        };
    };

    const invalid = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer wrong'),
        dependencies,
    );
    assert.strictEqual(invalid.status, 401);

    const response = await handleStripeCheckoutReconciliationCron(
        cronRequest('Bearer cron-secret'),
        dependencies,
    );
    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(
        response.headers.get('cache-control'),
        'private, no-store',
    );
    assert.strictEqual(calls, 0);
});
