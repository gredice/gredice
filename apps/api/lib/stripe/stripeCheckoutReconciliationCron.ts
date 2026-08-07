import {
    commitStripePaymentDiscoveryCheckpoint,
    getStripePaymentDiscoveryCheckpoint,
    getStripePaymentProcessingHealth,
    getStripePaymentRecoveryCursor,
    takeNextRecoverableStripePaymentCandidate,
} from '@gredice/storage';
import {
    getStripeCheckoutSessionDiscoveryPage,
    type StripeCheckoutSessionDiscoveryPageResult,
} from '@gredice/stripe/server';
import { processCheckoutSessionForReconciliation } from './processCheckoutSession';
import {
    getStripeCheckoutProcessingMaintenanceResponse,
    isStripeCheckoutProcessingMaintenanceEnabled,
} from './stripeCheckoutProcessingMaintenance';

const recentCheckoutWindowMs = 3 * 24 * 60 * 60 * 1_000;
const discoveryOverlapMs = 5 * 60 * 1_000;
const discoverySliceMs = 15_000;
const invocationSoftBudgetMs = 45_000;
const providerRequestBudgetMs = 5_000;
// A reconciliation processor can make two sequential five-second Stripe calls
// before database/fulfillment work. Stop admitting new candidates with 30
// seconds left in the soft budget so one slow candidate cannot crowd a second
// one against the platform's 60-second hard limit.
const recoveryStartReserveMs = 30_000;
const maximumDiscoveryPagesPerInvocation = 100;
const maximumRecoveryCandidatesPerInvocation = 50;
const maximumRecoveryCursorOperationsPerInvocation = 100;
const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

export type StripeCheckoutReconciliationCronDependencies = {
    commitDiscovery: typeof commitStripePaymentDiscoveryCheckpoint;
    discoverPage: (input: {
        rangeGte: Date;
        rangeLte: Date;
        startingAfter: string | null;
    }) => Promise<StripeCheckoutSessionDiscoveryPageResult>;
    getDiscoveryCheckpoint: typeof getStripePaymentDiscoveryCheckpoint;
    getRecoveryCursor: typeof getStripePaymentRecoveryCursor;
    health: typeof getStripePaymentProcessingHealth;
    maintenanceEnabled: () => boolean;
    monotonicNowMs: () => number;
    now: () => Date;
    process: (stripePaymentId: string) => Promise<unknown>;
    takeRecoveryCandidate: typeof takeNextRecoverableStripePaymentCandidate;
};

const defaultDependencies: StripeCheckoutReconciliationCronDependencies = {
    commitDiscovery: commitStripePaymentDiscoveryCheckpoint,
    discoverPage: getStripeCheckoutSessionDiscoveryPage,
    getDiscoveryCheckpoint: getStripePaymentDiscoveryCheckpoint,
    getRecoveryCursor: getStripePaymentRecoveryCursor,
    health: getStripePaymentProcessingHealth,
    maintenanceEnabled: isStripeCheckoutProcessingMaintenanceEnabled,
    monotonicNowMs: () => performance.now(),
    now: () => new Date(),
    process: processCheckoutSessionForReconciliation,
    takeRecoveryCandidate: takeNextRecoverableStripePaymentCandidate,
};

function boundedErrorContext(error: unknown) {
    const errorName =
        error instanceof Error ? error.name.slice(0, 64) : 'UnknownError';
    const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Za-z0-9._:-]{1,64}$/u.test(error.code)
            ? error.code
            : undefined;
    return { errorCode, errorName };
}

function subtractMilliseconds(value: Date, milliseconds: number) {
    return new Date(value.getTime() - milliseconds);
}

function laterDate(left: Date, right: Date) {
    return left.getTime() >= right.getTime() ? left : right;
}

function isInitializedDiscoveryCheckpoint(
    checkpoint: Awaited<ReturnType<typeof getStripePaymentDiscoveryCheckpoint>>,
): checkpoint is Awaited<
    ReturnType<typeof getStripePaymentDiscoveryCheckpoint>
> & {
    exhaustiveUpperBound: Date;
    rangeGte: Date;
    rangeLte: Date;
} {
    return (
        checkpoint.exhaustiveUpperBound !== null &&
        checkpoint.rangeGte !== null &&
        checkpoint.rangeLte !== null
    );
}

async function initializeDiscoveryCheckpoint(
    checkpoint: Awaited<ReturnType<typeof getStripePaymentDiscoveryCheckpoint>>,
    invocationNow: Date,
    dependencies: StripeCheckoutReconciliationCronDependencies,
) {
    if (isInitializedDiscoveryCheckpoint(checkpoint)) {
        return checkpoint;
    }
    const initialized = await dependencies.commitDiscovery({
        enqueueStripePaymentIds: [],
        expectedRevision: checkpoint.revision,
        next: {
            exhaustiveUpperBound: invocationNow,
            rangeGte: subtractMilliseconds(
                invocationNow,
                recentCheckoutWindowMs,
            ),
            rangeLte: invocationNow,
            startingAfter: null,
        },
        now: invocationNow,
    });
    return initialized.checkpoint;
}

async function runDiscovery({
    deadlineMs,
    dependencies,
    invocationNow,
}: {
    deadlineMs: number;
    dependencies: StripeCheckoutReconciliationCronDependencies;
    invocationNow: Date;
}) {
    let checkpoint = await initializeDiscoveryCheckpoint(
        await dependencies.getDiscoveryCheckpoint(),
        invocationNow,
        dependencies,
    );
    let committedSessions = 0;
    let pagesFetched = 0;
    let rangeExhausted = false;
    let stale = false;

    while (pagesFetched < maximumDiscoveryPagesPerInvocation) {
        if (
            dependencies.monotonicNowMs() + providerRequestBudgetMs >
            deadlineMs
        ) {
            break;
        }
        if (!isInitializedDiscoveryCheckpoint(checkpoint)) {
            throw new Error(
                'Stripe checkout discovery checkpoint is not initialized',
            );
        }

        const page = await dependencies.discoverPage({
            rangeGte: checkpoint.rangeGte,
            rangeLte: checkpoint.rangeLte,
            startingAfter: checkpoint.startingAfter,
        });
        pagesFetched += 1;
        const exhaustedThroughInvocation =
            !page.hasMore &&
            checkpoint.rangeLte.getTime() >= invocationNow.getTime();
        const nextUpperBound = laterDate(
            invocationNow,
            checkpoint.exhaustiveUpperBound,
        );
        const next = page.hasMore
            ? {
                  exhaustiveUpperBound: checkpoint.exhaustiveUpperBound,
                  rangeGte: checkpoint.rangeGte,
                  rangeLte: checkpoint.rangeLte,
                  startingAfter: page.nextStartingAfter,
              }
            : {
                  exhaustiveUpperBound: nextUpperBound,
                  rangeGte: subtractMilliseconds(
                      checkpoint.exhaustiveUpperBound,
                      discoveryOverlapMs,
                  ),
                  rangeLte: nextUpperBound,
                  startingAfter: null,
              };
        const commit = await dependencies.commitDiscovery({
            enqueueStripePaymentIds: page.sessions.map((session) => session.id),
            expectedRevision: checkpoint.revision,
            next,
            now: invocationNow,
        });
        checkpoint = commit.checkpoint;
        if (commit.status === 'stale') {
            stale = true;
            break;
        }
        committedSessions += page.sessions.length;
        if (exhaustedThroughInvocation) {
            rangeExhausted = true;
            break;
        }
    }

    return {
        budgetExhausted:
            !rangeExhausted &&
            !stale &&
            dependencies.monotonicNowMs() + providerRequestBudgetMs >
                deadlineMs,
        committedSessions,
        pageLimitReached:
            !rangeExhausted &&
            !stale &&
            pagesFetched >= maximumDiscoveryPagesPerInvocation,
        pagesFetched,
        rangeExhausted,
        stale,
    };
}

async function runRecovery({
    deadlineMs,
    dependencies,
}: {
    deadlineMs: number;
    dependencies: StripeCheckoutReconciliationCronDependencies;
}) {
    if (dependencies.monotonicNowMs() + recoveryStartReserveMs > deadlineMs) {
        return {
            budgetExhausted: true,
            candidateLimitReached: false,
            candidatesTaken: 0,
            cycleComplete: false,
            failures: 0,
            staleReads: 0,
        };
    }
    let cursor = await dependencies.getRecoveryCursor();
    let candidatesTaken = 0;
    let cycleComplete = false;
    let failures = 0;
    let staleReads = 0;
    let cursorOperations = 0;

    while (
        candidatesTaken < maximumRecoveryCandidatesPerInvocation &&
        cursorOperations < maximumRecoveryCursorOperationsPerInvocation
    ) {
        if (
            dependencies.monotonicNowMs() + recoveryStartReserveMs >
            deadlineMs
        ) {
            break;
        }
        const candidate = await dependencies.takeRecoveryCandidate({
            expectedRevision: cursor.revision,
            now: dependencies.now(),
        });
        cursorOperations += 1;
        cursor = candidate.cursor;
        if (candidate.status === 'stale') {
            staleReads += 1;
            continue;
        }
        if (candidate.status === 'cycle_complete') {
            cycleComplete = true;
            break;
        }

        candidatesTaken += 1;
        try {
            await dependencies.process(candidate.candidate.stripePaymentId);
        } catch (error) {
            failures += 1;
            console.error('stripe_payment.reconciliation.processing_failed', {
                ...boundedErrorContext(error),
                schedulerId: candidate.candidate.schedulerId,
                stripePaymentId: candidate.candidate.stripePaymentId,
            });
        }
    }

    return {
        budgetExhausted:
            !cycleComplete &&
            dependencies.monotonicNowMs() + recoveryStartReserveMs > deadlineMs,
        candidateLimitReached:
            !cycleComplete &&
            (candidatesTaken >= maximumRecoveryCandidatesPerInvocation ||
                cursorOperations >=
                    maximumRecoveryCursorOperationsPerInvocation),
        candidatesTaken,
        cycleComplete,
        failures,
        staleReads,
    };
}

export async function handleStripeCheckoutReconciliationCron(
    request: Request,
    dependencies: Partial<StripeCheckoutReconciliationCronDependencies> = {},
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }

    const resolved = { ...defaultDependencies, ...dependencies };
    if (resolved.maintenanceEnabled()) {
        return getStripeCheckoutProcessingMaintenanceResponse('cron');
    }

    const invocationNow = resolved.now();
    const startedAtMs = resolved.monotonicNowMs();
    const discoveryDeadlineMs = startedAtMs + discoverySliceMs;
    const invocationDeadlineMs = startedAtMs + invocationSoftBudgetMs;
    const discovery = await runDiscovery({
        deadlineMs: discoveryDeadlineMs,
        dependencies: resolved,
        invocationNow,
    }).then(
        (result) => ({ result, status: 'fulfilled' as const }),
        (error: unknown) => ({ error, status: 'rejected' as const }),
    );
    if (discovery.status === 'rejected') {
        console.error('stripe_payment.reconciliation.discovery_failed', {
            ...boundedErrorContext(discovery.error),
        });
    }

    const recovery = await runRecovery({
        deadlineMs: invocationDeadlineMs,
        dependencies: resolved,
    }).then(
        (result) => ({ result, status: 'fulfilled' as const }),
        (error: unknown) => ({ error, status: 'rejected' as const }),
    );
    if (recovery.status === 'rejected') {
        console.error('stripe_payment.reconciliation.recovery_failed', {
            ...boundedErrorContext(recovery.error),
        });
    }
    console.info('stripe_payment.reconciliation.progress', {
        discoveryBudgetExhausted:
            discovery.status === 'fulfilled' &&
            discovery.result.budgetExhausted,
        discoveryPages:
            discovery.status === 'fulfilled'
                ? discovery.result.pagesFetched
                : 0,
        discoverySessions:
            discovery.status === 'fulfilled'
                ? discovery.result.committedSessions
                : 0,
        discoveryStale:
            discovery.status === 'fulfilled' && discovery.result.stale,
        recoveryBudgetExhausted:
            recovery.status === 'fulfilled' && recovery.result.budgetExhausted,
        recoveryCandidates:
            recovery.status === 'fulfilled'
                ? recovery.result.candidatesTaken
                : 0,
        recoveryCycleComplete:
            recovery.status === 'fulfilled' && recovery.result.cycleComplete,
        recoveryStaleReads:
            recovery.status === 'fulfilled' ? recovery.result.staleReads : 0,
    });

    try {
        const health = await resolved.health({ now: resolved.now() });
        const claimsHealthy =
            health.queuedCount === 0 &&
            health.dueRetryableCount === 0 &&
            health.expiredLeaseCount === 0 &&
            health.manualReviewCount === 0;
        const discoveryIncomplete =
            discovery.status === 'fulfilled' &&
            (!discovery.result.rangeExhausted ||
                discovery.result.pageLimitReached ||
                discovery.result.stale);
        const recoveryIncomplete =
            recovery.status === 'fulfilled' &&
            (!recovery.result.cycleComplete ||
                recovery.result.candidateLimitReached);
        const failed =
            discovery.status === 'rejected' ||
            recovery.status === 'rejected' ||
            (recovery.status === 'fulfilled' && recovery.result.failures > 0);
        const success =
            !failed &&
            !discoveryIncomplete &&
            !recoveryIncomplete &&
            claimsHealthy;
        const status = failed ? 500 : success ? 200 : 503;
        console.info('stripe_payment.reconciliation.health', {
            ...health,
            observedAt: invocationNow.toISOString(),
        });

        return Response.json(
            {
                checkoutSessionDiscoveryPages:
                    discovery.status === 'fulfilled'
                        ? discovery.result.pagesFetched
                        : 0,
                checkoutSessionDiscoveryBudgetExhausted:
                    discovery.status === 'fulfilled' &&
                    discovery.result.budgetExhausted,
                checkoutSessionDiscoveryStale:
                    discovery.status === 'fulfilled' && discovery.result.stale,
                checkoutSessionDiscoveryTruncated: discoveryIncomplete,
                discoveredCheckoutSessions:
                    discovery.status === 'fulfilled'
                        ? discovery.result.committedSessions
                        : 0,
                failedCheckoutSessions:
                    recovery.status === 'fulfilled'
                        ? recovery.result.failures
                        : 0,
                health,
                processedCheckoutSessions:
                    recovery.status === 'fulfilled'
                        ? recovery.result.candidatesTaken -
                          recovery.result.failures
                        : 0,
                recoverableCheckoutSessions:
                    recovery.status === 'fulfilled'
                        ? recovery.result.candidatesTaken
                        : 0,
                recoveryCycleComplete:
                    recovery.status === 'fulfilled' &&
                    recovery.result.cycleComplete,
                recoveryBudgetExhausted:
                    recovery.status === 'fulfilled' &&
                    recovery.result.budgetExhausted,
                recoveryCandidateLimitReached:
                    recovery.status === 'fulfilled' &&
                    recovery.result.candidateLimitReached,
                success,
            },
            { headers: noStoreHeaders, status },
        );
    } catch (error) {
        console.error('stripe_payment.reconciliation.failed', {
            ...boundedErrorContext(error),
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
