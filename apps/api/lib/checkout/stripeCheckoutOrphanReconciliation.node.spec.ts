import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fingerprintStripeCheckoutValue,
    type StripeCheckoutAttempt,
} from '@gredice/storage';
import {
    reconcileStripeCheckoutOrphanAttempts,
    STRIPE_CHECKOUT_ORPHAN_MISS_GRACE_MS,
    type StripeCheckoutOrphanReconciliationDependencies,
} from './stripeCheckoutOrphanReconciliation';
import { encodeStripeCheckoutAttemptMetadata } from './stripeCheckoutSnapshot';

const attemptId = '93b43108-696d-48ca-92ef-9990c0a84d43';
const cartId = 12;
const beforeDeadline = new Date('2026-08-03T23:00:00.000Z');
const afterDeadline = new Date('2026-08-04T00:05:00.000Z');

function checkoutAttempt(
    expiresAt: string | null = '2026-08-04T00:00:00.000Z',
) {
    return {
        snapshot: {
            attemptId,
            cartId,
            expectedNonStripeCartItemIds: [],
            harvestDates: [],
            items: [],
            stripeSession: {
                allowPromotionCodes: true,
                customerFingerprint: fingerprintStripeCheckoutValue('cus_1'),
                expiresAt,
                items: [],
                returnUrls: {
                    cancel: 'https://example.test/cancel',
                    success: 'https://example.test/success',
                },
            },
            userFingerprint: fingerprintStripeCheckoutValue('user-1'),
            version: 1,
        },
    } satisfies StripeCheckoutAttempt;
}

type Session = Awaited<
    ReturnType<StripeCheckoutOrphanReconciliationDependencies['getSession']>
>;

function checkoutSession({
    amountTotal = 500,
    id = 'cs_1',
    paymentStatus = 'unpaid',
    status = 'open',
}: {
    amountTotal?: number;
    id?: string;
    paymentStatus?: 'no_payment_required' | 'paid' | 'unpaid';
    status?: 'complete' | 'expired' | 'open' | null;
} = {}): Session {
    return {
        amountTotal,
        customerId: 'cus_1',
        id,
        lineItems: {
            data: [],
        },
        metadata: stringMetadata(checkoutAttempt()),
        paymentStatus,
        status,
        url: status === 'open' ? 'https://stripe.test/session' : null,
    };
}

function candidate({
    attempt = checkoutAttempt(),
    lastReconciliationMissAt,
}: {
    attempt?: StripeCheckoutAttempt;
    lastReconciliationMissAt?: Date;
} = {}) {
    return {
        attempt,
        createdAt: new Date('2026-08-03T22:00:00.000Z'),
        createdEventId: 101,
        ...(lastReconciliationMissAt ? { lastReconciliationMissAt } : {}),
    };
}

function stringMetadata(attempt: StripeCheckoutAttempt) {
    const metadata = encodeStripeCheckoutAttemptMetadata(attempt.snapshot);
    return Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, String(value)]),
    );
}

function dependencies({
    attempt = checkoutAttempt(),
    fullSession = checkoutSession(),
    listedItems = [{ id: 'cs_1', metadata: stringMetadata(attempt) }],
    now = beforeDeadline,
    onCall,
    onFailure,
}: {
    attempt?: StripeCheckoutAttempt;
    fullSession?: Session;
    listedItems?: Array<{
        id: string;
        metadata: Record<string, string> | null;
    }>;
    now?: Date;
    onCall?: (name: string) => void;
    onFailure?: (
        diagnostic: Parameters<
            StripeCheckoutOrphanReconciliationDependencies['reportFailure']
        >[0],
    ) => void;
} = {}): StripeCheckoutOrphanReconciliationDependencies {
    let processed = false;
    return {
        bindAttempt: async ({ sessionId }) => {
            onCall?.('bind');
            return { ...attempt, sessionId };
        },
        getAttempt: async () => {
            onCall?.('get_attempt');
            return processed
                ? {
                      ...attempt,
                      releaseReason: 'completed',
                      sessionId: fullSession.id,
                  }
                : attempt;
        },
        getCursor: async () => undefined,
        getSession: async () => {
            onCall?.('retrieve');
            return fullSession;
        },
        listAttempts: async () => ({
            hasMore: false,
            items: [candidate({ attempt })],
        }),
        listSessions: async () => {
            onCall?.('list');
            return {
                items: listedItems,
                pageCount: 1,
                status: 'exhaustive',
            };
        },
        now: () => new Date(now),
        processSession: async () => {
            onCall?.('process');
            processed = true;
        },
        reportFailure: (diagnostic) => onFailure?.(diagnostic),
        recordMiss: async ({ observedAt }) => {
            onCall?.('miss');
            return {
                createdAt: observedAt,
                observedAt,
                status: 'recorded',
            };
        },
        releaseAfterMisses: async () => {
            onCall?.('absence_release');
            return { attempt, status: 'released' };
        },
        releaseAttempt: async ({ sessionId }) => {
            onCall?.('release');
            return {
                ...attempt,
                releaseReason: 'expired',
                sessionId: sessionId ?? undefined,
            };
        },
        resolveIdentity: async () => ({
            accountId: 'account-1',
            customerId: 'cus_1',
            userId: 'user-1',
        }),
        setCursor: async (afterCreatedEventId) =>
            afterCreatedEventId ?? undefined,
        validateSession: async () => {
            onCall?.('validate');
            return {
                accountId: 'account-1',
                customerId: 'cus_1',
                userId: 'user-1',
            };
        },
    };
}

test('validates before binding an open discovered session', async () => {
    const calls: string[] = [];
    const summary = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({ onCall: (name) => calls.push(name) }),
    });

    assert.equal(summary.boundCount, 1);
    assert.equal(summary.failedCount, 0);
    assert.deepEqual(calls, ['list', 'retrieve', 'validate', 'bind']);
});

test('binds and processes a paid completed session', async () => {
    const calls: string[] = [];
    const summary = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            fullSession: checkoutSession({
                paymentStatus: 'paid',
                status: 'complete',
            }),
            onCall: (name) => calls.push(name),
        }),
    });

    assert.equal(summary.processedCount, 1);
    assert.deepEqual(calls, [
        'list',
        'retrieve',
        'validate',
        'bind',
        'process',
        'get_attempt',
    ]);
});

test('retries a bound completed attempt after transient processing failure', async () => {
    const firstCalls: string[] = [];
    const failures: Array<
        Parameters<
            StripeCheckoutOrphanReconciliationDependencies['reportFailure']
        >[0]
    > = [];
    const completed = checkoutSession({
        paymentStatus: 'paid',
        status: 'complete',
    });
    const firstDependencies = dependencies({
        fullSession: completed,
        onCall: (name) => firstCalls.push(name),
        onFailure: (diagnostic) => failures.push(diagnostic),
    });
    firstDependencies.processSession = async () => {
        firstCalls.push('process');
        throw new Error('transient fulfillment failure');
    };
    const first = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: firstDependencies,
    });
    assert.equal(first.failedCount, 1);
    assert.equal(first.failureCategories.unexpected, 1);
    assert.deepEqual(failures, [
        {
            attemptId,
            cartId,
            category: 'unexpected',
            causeName: 'Error',
            stage: 'discovered_session_reconcile',
        },
    ]);
    assert.deepEqual(firstCalls, [
        'list',
        'retrieve',
        'validate',
        'bind',
        'process',
    ]);

    const secondCalls: string[] = [];
    const boundAttempt = { ...checkoutAttempt(), sessionId: 'cs_1' };
    const secondDependencies = dependencies({
        attempt: boundAttempt,
        fullSession: completed,
        onCall: (name) => secondCalls.push(name),
    });
    secondDependencies.listSessions = async () => {
        throw new Error('bound attempts must not scan Stripe session lists');
    };
    const second = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: secondDependencies,
    });
    assert.equal(second.processedCount, 1);
    assert.deepEqual(secondCalls, [
        'retrieve',
        'validate',
        'process',
        'get_attempt',
    ]);
});

test('releases an authoritative expired session after validation', async () => {
    const calls: string[] = [];
    const summary = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            fullSession: checkoutSession({ status: 'expired' }),
            onCall: (name) => calls.push(name),
        }),
    });

    assert.equal(summary.releasedCount, 1);
    assert.deepEqual(calls, ['list', 'retrieve', 'validate', 'release']);
});

test('binds but fails healthy status for an overdue open session', async () => {
    const calls: string[] = [];
    const overdueOpen = checkoutSession({ status: 'open' });
    const overdueDependencies = dependencies({
        fullSession: overdueOpen,
        now: afterDeadline,
        onCall: (name) => calls.push(name),
    });

    const summary = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: overdueDependencies,
    });

    assert.equal(summary.failedCount, 1);
    assert.equal(summary.failureCategories.session_overdue_open, 1);
    assert.deepEqual(calls, ['list', 'retrieve', 'validate', 'bind']);
});

test('records first absence and releases only after a later exhaustive scan', async () => {
    const firstCalls: string[] = [];
    const noSessions: Array<{
        id: string;
        metadata: Record<string, string> | null;
    }> = [];
    const first = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            listedItems: noSessions,
            now: afterDeadline,
            onCall: (name) => firstCalls.push(name),
        }),
    });
    assert.equal(first.missRecordedCount, 1);
    assert.deepEqual(firstCalls, ['list', 'miss']);

    const secondCalls: string[] = [];
    const secondDependencies = dependencies({
        listedItems: noSessions,
        now: new Date(
            afterDeadline.getTime() + STRIPE_CHECKOUT_ORPHAN_MISS_GRACE_MS + 1,
        ),
        onCall: (name) => secondCalls.push(name),
    });
    secondDependencies.listAttempts = async () => ({
        hasMore: false,
        items: [candidate({ lastReconciliationMissAt: afterDeadline })],
    });
    const second = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: secondDependencies,
    });
    assert.equal(second.releasedCount, 1);
    assert.deepEqual(secondCalls, ['list', 'miss', 'absence_release']);
});

test('never records absence for a null deadline or partial Stripe scan', async () => {
    const nullDeadlineCalls: string[] = [];
    const nullDeadline = checkoutAttempt(null);
    const nullDeadlineSummary = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            attempt: nullDeadline,
            listedItems: [],
            now: afterDeadline,
            onCall: (name) => nullDeadlineCalls.push(name),
        }),
    });
    assert.equal(nullDeadlineSummary.failedCount, 1);
    assert.equal(
        nullDeadlineSummary.failureCategories.session_deadline_missing,
        1,
    );
    assert.deepEqual(nullDeadlineCalls, ['list']);

    const partialCalls: string[] = [];
    const partialDependencies = dependencies({
        listedItems: [],
        now: afterDeadline,
        onCall: (name) => partialCalls.push(name),
    });
    partialDependencies.listSessions = async () => ({
        pageCount: 1,
        reason: 'request_failed',
        status: 'partial',
    });
    const partial = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: partialDependencies,
    });
    assert.equal(partial.failedCount, 1);
    assert.equal(partial.failureCategories.stripe_scan_request_failed, 1);
    assert.deepEqual(partialCalls, []);
});

test('fails closed for duplicate sessions and unpaid completion', async () => {
    const duplicate = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            listedItems: [
                { id: 'cs_1', metadata: stringMetadata(checkoutAttempt()) },
                { id: 'cs_2', metadata: stringMetadata(checkoutAttempt()) },
            ],
        }),
    });
    assert.equal(duplicate.failedCount, 1);
    assert.equal(duplicate.failureCategories.multiple_stripe_sessions, 1);

    const unpaid = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: dependencies({
            fullSession: checkoutSession({
                paymentStatus: 'unpaid',
                status: 'complete',
            }),
        }),
    });
    assert.equal(unpaid.failedCount, 1);
    assert.equal(unpaid.failureCategories.session_unpaid, 1);
});

test('rotates the durable cursor so candidate 51 is reached on the next run', async () => {
    const candidates = Array.from({ length: 51 }, (_, index) => ({
        ...candidate({
            attempt: {
                ...checkoutAttempt(),
                sessionId: `cs_${(index + 1).toString()}`,
            },
        }),
        createdEventId: index + 1,
    }));
    let cursor: number | undefined;
    let processedLast = false;
    const rotatingDependencies = dependencies();
    rotatingDependencies.getCursor = async () => cursor;
    rotatingDependencies.setCursor = async (afterCreatedEventId) => {
        cursor = afterCreatedEventId ?? undefined;
        return cursor;
    };
    rotatingDependencies.listAttempts = async ({
        afterCreatedEventId,
        limit = 25,
    } = {}) => {
        const remaining = candidates.filter(
            (entry) =>
                afterCreatedEventId === undefined ||
                entry.createdEventId > afterCreatedEventId,
        );
        const items = remaining.slice(0, limit);
        const hasMore = remaining.length > items.length;
        const lastItem = items.at(-1);
        return {
            hasMore,
            items,
            ...(hasMore && lastItem
                ? { nextCreatedEventId: lastItem.createdEventId }
                : {}),
        };
    };
    rotatingDependencies.listSessions = async () => {
        throw new Error('bound candidates do not need a customer scan');
    };
    rotatingDependencies.getSession = async (sessionId) =>
        sessionId === 'cs_51'
            ? checkoutSession({
                  id: sessionId,
                  paymentStatus: 'paid',
                  status: 'complete',
              })
            : checkoutSession({ id: sessionId, status: 'open' });
    rotatingDependencies.processSession = async (sessionId) => {
        assert.equal(sessionId, 'cs_51');
        processedLast = true;
    };
    rotatingDependencies.getAttempt = async () =>
        processedLast
            ? {
                  ...checkoutAttempt(),
                  releaseReason: 'completed',
                  sessionId: 'cs_51',
              }
            : { ...checkoutAttempt(), sessionId: 'cs_51' };

    const first = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: rotatingDependencies,
        maxAttempts: 50,
        pageSize: 25,
    });
    assert.equal(first.scannedCount, 50);
    assert.equal(first.truncated, true);
    assert.equal(cursor, 50);
    assert.equal(processedLast, false);

    const second = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: rotatingDependencies,
        maxAttempts: 50,
        pageSize: 25,
    });
    assert.equal(second.scannedCount, 1);
    assert.equal(second.processedCount, 1);
    assert.equal(second.truncated, false);
    assert.equal(cursor, undefined);
    assert.equal(processedLast, true);
});

test('advances per candidate so a long fulfillment cannot starve its page peer', async () => {
    const candidates = [
        {
            ...candidate({
                attempt: { ...checkoutAttempt(), sessionId: 'cs_1' },
            }),
            createdEventId: 1,
        },
        {
            ...candidate({
                attempt: { ...checkoutAttempt(), sessionId: 'cs_2' },
            }),
            createdEventId: 2,
        },
    ];
    let cursor: number | undefined;
    let signalFirstStarted: (() => void) | undefined;
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
        signalFirstStarted = resolve;
    });
    const firstCanFinish = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    const sharedDependencies = dependencies();
    sharedDependencies.getCursor = async () => cursor;
    sharedDependencies.setCursor = async (afterCreatedEventId) => {
        cursor = afterCreatedEventId ?? undefined;
        return cursor;
    };
    sharedDependencies.listAttempts = async ({
        afterCreatedEventId,
        limit = 25,
    } = {}) => {
        const remaining = candidates.filter(
            (entry) =>
                afterCreatedEventId === undefined ||
                entry.createdEventId > afterCreatedEventId,
        );
        const items = remaining.slice(0, limit);
        const hasMore = remaining.length > items.length;
        const lastItem = items.at(-1);
        return {
            hasMore,
            items,
            ...(hasMore && lastItem
                ? { nextCreatedEventId: lastItem.createdEventId }
                : {}),
        };
    };
    sharedDependencies.getSession = async (sessionId) =>
        sessionId === 'cs_1'
            ? checkoutSession({
                  id: sessionId,
                  paymentStatus: 'paid',
                  status: 'complete',
              })
            : checkoutSession({ id: sessionId, status: 'open' });
    sharedDependencies.processSession = async (sessionId) => {
        assert.equal(sessionId, 'cs_1');
        signalFirstStarted?.();
        await firstCanFinish;
    };
    sharedDependencies.getAttempt = async () => ({
        ...checkoutAttempt(),
        releaseReason: 'completed',
        sessionId: 'cs_1',
    });

    const firstRun = reconcileStripeCheckoutOrphanAttempts({
        dependencies: sharedDependencies,
        maxAttempts: 2,
        pageSize: 2,
    });
    await firstStarted;
    assert.equal(cursor, 1);

    const secondRun = await reconcileStripeCheckoutOrphanAttempts({
        dependencies: sharedDependencies,
        maxAttempts: 2,
        pageSize: 2,
    });
    assert.equal(secondRun.scannedCount, 1);
    assert.equal(secondRun.retainedCount, 1);
    assert.equal(cursor, undefined);

    releaseFirst?.();
    const completedFirstRun = await firstRun;
    assert.equal(completedFirstRun.scannedCount, 2);
});
