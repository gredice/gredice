import {
    type ActiveStripeCheckoutAttemptReconciliationCandidate,
    bindStripeCheckoutAttempt,
    getStripeCheckoutAttempt,
    getStripeCheckoutAttemptReconciliationCursor,
    listActiveStripeCheckoutAttemptsForReconciliation,
    recordStripeCheckoutAttemptReconciliationMiss,
    releaseStripeCheckoutAttempt,
    releaseStripeCheckoutAttemptAfterReconciliationMisses,
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
    setStripeCheckoutAttemptReconciliationCursor,
} from '@gredice/storage';
import {
    getStripeCheckoutSessionForReconciliation,
    listStripeCheckoutSessionsForCustomerExhaustively,
} from '@gredice/stripe/server';
import { processCheckoutSessionForReconciliation } from '../stripe/processCheckoutSession';
import {
    resolveStripeCheckoutAttemptIdentity,
    type StripeCheckoutSessionForReconciliation,
    validateStripeCheckoutSessionAgainstAttempt,
} from './stripeCheckoutAttemptValidation';
import {
    decodeStripeCheckoutAttemptMetadata,
    stripeCheckoutAttemptMetadataKeys,
} from './stripeCheckoutSnapshot';

const RECONCILIATION_PAGE_SIZE = 25;
const RECONCILIATION_MAX_PAGES = 20;
const RECONCILIATION_MAX_ATTEMPTS = 50;
const RECONCILIATION_TIME_BUDGET_MS = 15_000;
export const STRIPE_CHECKOUT_ORPHAN_MISS_GRACE_MS = 2 * 60 * 1000;

type ListedStripeCheckoutSession = {
    id: string;
    metadata: Record<string, string> | null;
};

type StripeSessionListResult =
    | {
          items: ListedStripeCheckoutSession[];
          pageCount: number;
          status: 'exhaustive';
      }
    | {
          pageCount: number;
          reason:
              | 'invalid_pagination'
              | 'page_limit'
              | 'request_failed'
              | 'time_limit';
          status: 'partial';
      };

export type StripeCheckoutOrphanReconciliationDependencies = {
    bindAttempt: typeof bindStripeCheckoutAttempt;
    getAttempt: typeof getStripeCheckoutAttempt;
    getSession: (
        sessionId: string,
    ) => Promise<StripeCheckoutSessionForReconciliation>;
    getCursor: typeof getStripeCheckoutAttemptReconciliationCursor;
    listAttempts: typeof listActiveStripeCheckoutAttemptsForReconciliation;
    listSessions: (input: {
        createdAt: Date;
        customerId: string;
        expiresAt: Date | null;
    }) => Promise<StripeSessionListResult>;
    now: () => Date;
    processSession: typeof processCheckoutSessionForReconciliation;
    recordMiss: typeof recordStripeCheckoutAttemptReconciliationMiss;
    releaseAfterMisses: typeof releaseStripeCheckoutAttemptAfterReconciliationMisses;
    releaseAttempt: typeof releaseStripeCheckoutAttempt;
    resolveIdentity: typeof resolveStripeCheckoutAttemptIdentity;
    setCursor: typeof setStripeCheckoutAttemptReconciliationCursor;
    validateSession: typeof validateStripeCheckoutSessionAgainstAttempt;
};

const realDependencies: StripeCheckoutOrphanReconciliationDependencies = {
    bindAttempt: bindStripeCheckoutAttempt,
    getAttempt: getStripeCheckoutAttempt,
    getCursor: getStripeCheckoutAttemptReconciliationCursor,
    getSession: getStripeCheckoutSessionForReconciliation,
    listAttempts: listActiveStripeCheckoutAttemptsForReconciliation,
    listSessions: listStripeCheckoutSessionsForCustomerExhaustively,
    now: () => new Date(),
    processSession: processCheckoutSessionForReconciliation,
    recordMiss: recordStripeCheckoutAttemptReconciliationMiss,
    releaseAfterMisses: releaseStripeCheckoutAttemptAfterReconciliationMisses,
    releaseAttempt: releaseStripeCheckoutAttempt,
    resolveIdentity: resolveStripeCheckoutAttemptIdentity,
    setCursor: setStripeCheckoutAttemptReconciliationCursor,
    validateSession: validateStripeCheckoutSessionAgainstAttempt,
};

type AttemptOutcome =
    | {
          status:
              | 'bound'
              | 'miss_recorded'
              | 'processed'
              | 'released'
              | 'retained';
      }
    | { category: string; status: 'failed' };

export type StripeCheckoutOrphanReconciliationSummary = {
    boundCount: number;
    failedCount: number;
    failureCategories: Record<string, number>;
    missRecordedCount: number;
    processedCount: number;
    releasedCount: number;
    retainedCount: number;
    scannedCount: number;
    truncated: boolean;
};

function attemptFailureCategory(error: unknown) {
    return error instanceof StripeCheckoutAttemptConflictError
        ? error.category
        : 'unexpected';
}

function deadlineForAttempt(attempt: StripeCheckoutAttempt) {
    const value = attempt.snapshot.stripeSession.expiresAt;
    if (!value) {
        return null;
    }
    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) {
        throw new StripeCheckoutAttemptConflictError(
            'session_deadline_invalid',
        );
    }
    return deadline;
}

function correlatedSessions(
    sessions: readonly ListedStripeCheckoutSession[],
    attempt: StripeCheckoutAttempt,
) {
    const correlated = sessions.filter(
        (session) =>
            session.metadata?.[stripeCheckoutAttemptMetadataKeys.attemptId] ===
            attempt.snapshot.attemptId,
    );
    for (const session of correlated) {
        const metadata = decodeStripeCheckoutAttemptMetadata(session.metadata);
        if (
            !metadata ||
            metadata.attemptId !== attempt.snapshot.attemptId ||
            metadata.cartId !== attempt.snapshot.cartId
        ) {
            throw new StripeCheckoutAttemptConflictError(
                'snapshot_identity_changed',
            );
        }
    }
    if (correlated.length > 1) {
        throw new StripeCheckoutAttemptConflictError(
            'multiple_stripe_sessions',
        );
    }
    return correlated;
}

async function reconcileProvenAbsentSession(
    candidate: ActiveStripeCheckoutAttemptReconciliationCandidate,
    dependencies: StripeCheckoutOrphanReconciliationDependencies,
): Promise<AttemptOutcome> {
    const { attempt } = candidate;
    const deadline = deadlineForAttempt(attempt);
    if (!deadline) {
        return { category: 'session_deadline_missing', status: 'failed' };
    }
    const observedAt = dependencies.now();
    if (deadline.getTime() > observedAt.getTime()) {
        return { status: 'retained' };
    }

    const missBefore = new Date(
        observedAt.getTime() - STRIPE_CHECKOUT_ORPHAN_MISS_GRACE_MS,
    );
    const recorded = await dependencies.recordMiss({
        attemptId: attempt.snapshot.attemptId,
        cartId: attempt.snapshot.cartId,
        observedAt,
    });
    if (recorded.status === 'released' || recorded.status === 'bound') {
        return { status: 'retained' };
    }
    if (recorded.status === 'attempt_missing') {
        return { category: 'attempt_missing', status: 'failed' };
    }

    if (
        candidate.lastReconciliationMissAt &&
        candidate.lastReconciliationMissAt.getTime() <= missBefore.getTime()
    ) {
        const released = await dependencies.releaseAfterMisses({
            attemptId: attempt.snapshot.attemptId,
            cartId: attempt.snapshot.cartId,
            missBefore,
            now: observedAt,
        });
        if (released.status === 'released') {
            return { status: 'released' };
        }
        if (
            released.status === 'already_released' ||
            released.status === 'bound'
        ) {
            return { status: 'retained' };
        }
        if (
            released.status === 'too_soon' ||
            released.status === 'not_expired'
        ) {
            return { status: 'miss_recorded' };
        }
        return {
            category: `absence_release_${released.status}`,
            status: 'failed',
        };
    }
    return { status: 'miss_recorded' };
}

async function reconcileAuthoritativeSession(
    attempt: StripeCheckoutAttempt,
    initialSession: StripeCheckoutSessionForReconciliation,
    dependencies: StripeCheckoutOrphanReconciliationDependencies,
): Promise<AttemptOutcome> {
    await dependencies.validateSession({ attempt, session: initialSession });
    const deadline = deadlineForAttempt(attempt);

    if (initialSession.status === 'open') {
        if (!attempt.sessionId) {
            await dependencies.bindAttempt({
                attemptId: attempt.snapshot.attemptId,
                cartId: attempt.snapshot.cartId,
                sessionId: initialSession.id,
            });
        }
        if (deadline && deadline.getTime() <= dependencies.now().getTime()) {
            return { category: 'session_overdue_open', status: 'failed' };
        }
        return { status: attempt.sessionId ? 'retained' : 'bound' };
    }

    if (initialSession.status === 'expired') {
        await dependencies.releaseAttempt({
            attemptId: attempt.snapshot.attemptId,
            cartId: attempt.snapshot.cartId,
            reason: 'expired',
            sessionId: initialSession.id,
        });
        return { status: 'released' };
    }

    if (initialSession.status === 'complete') {
        const isPaid = initialSession.paymentStatus === 'paid';
        const isZeroTotal =
            initialSession.paymentStatus === 'no_payment_required' &&
            initialSession.amountTotal === 0;
        if (!isPaid && !isZeroTotal) {
            return { category: 'session_unpaid', status: 'failed' };
        }
        if (!attempt.sessionId) {
            await dependencies.bindAttempt({
                attemptId: attempt.snapshot.attemptId,
                cartId: attempt.snapshot.cartId,
                sessionId: initialSession.id,
            });
        }
        await dependencies.processSession(initialSession.id);
        const processedAttempt = await dependencies.getAttempt(
            attempt.snapshot.cartId,
            attempt.snapshot.attemptId,
        );
        return processedAttempt?.releaseReason === 'completed'
            ? { status: 'processed' }
            : { category: 'fulfillment_incomplete', status: 'failed' };
    }

    return { category: 'session_status_unknown', status: 'failed' };
}

async function reconcileCandidate(
    candidate: ActiveStripeCheckoutAttemptReconciliationCandidate,
    dependencies: StripeCheckoutOrphanReconciliationDependencies,
): Promise<AttemptOutcome> {
    try {
        if (candidate.attempt.sessionId) {
            const session = await dependencies.getSession(
                candidate.attempt.sessionId,
            );
            return await reconcileAuthoritativeSession(
                candidate.attempt,
                session,
                dependencies,
            );
        }
        const identity = await dependencies.resolveIdentity(candidate.attempt);
        const deadline = deadlineForAttempt(candidate.attempt);
        const listed = await dependencies.listSessions({
            createdAt: candidate.createdAt,
            customerId: identity.customerId,
            expiresAt: deadline,
        });
        if (listed.status === 'partial') {
            return {
                category: `stripe_scan_${listed.reason}`,
                status: 'failed',
            };
        }
        const matchingSessions = correlatedSessions(
            listed.items,
            candidate.attempt,
        );
        const matchingSession = matchingSessions[0];
        if (!matchingSession) {
            return await reconcileProvenAbsentSession(candidate, dependencies);
        }
        const session = await dependencies.getSession(matchingSession.id);
        return await reconcileAuthoritativeSession(
            candidate.attempt,
            session,
            dependencies,
        );
    } catch (error) {
        return { category: attemptFailureCategory(error), status: 'failed' };
    }
}

function emptySummary(): StripeCheckoutOrphanReconciliationSummary {
    return {
        boundCount: 0,
        failedCount: 0,
        failureCategories: {},
        missRecordedCount: 0,
        processedCount: 0,
        releasedCount: 0,
        retainedCount: 0,
        scannedCount: 0,
        truncated: false,
    };
}

function recordOutcome(
    summary: StripeCheckoutOrphanReconciliationSummary,
    outcome: AttemptOutcome,
) {
    if (outcome.status === 'failed') {
        summary.failedCount += 1;
        summary.failureCategories[outcome.category] =
            (summary.failureCategories[outcome.category] ?? 0) + 1;
        return;
    }
    if (outcome.status === 'bound') {
        summary.boundCount += 1;
    } else if (outcome.status === 'miss_recorded') {
        summary.missRecordedCount += 1;
    } else if (outcome.status === 'processed') {
        summary.processedCount += 1;
    } else if (outcome.status === 'released') {
        summary.releasedCount += 1;
    } else {
        summary.retainedCount += 1;
    }
}

export async function reconcileStripeCheckoutOrphanAttempts({
    dependencies = realDependencies,
    maxAttempts = RECONCILIATION_MAX_ATTEMPTS,
    maxPages = RECONCILIATION_MAX_PAGES,
    pageSize = RECONCILIATION_PAGE_SIZE,
    timeBudgetMs = RECONCILIATION_TIME_BUDGET_MS,
}: {
    dependencies?: StripeCheckoutOrphanReconciliationDependencies;
    maxAttempts?: number;
    maxPages?: number;
    pageSize?: number;
    timeBudgetMs?: number;
} = {}): Promise<StripeCheckoutOrphanReconciliationSummary> {
    const summary = emptySummary();
    const startedAt = Date.now();
    let afterCreatedEventId = await dependencies.getCursor();

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const remainingAttempts = maxAttempts - summary.scannedCount;
        if (remainingAttempts <= 0 || Date.now() - startedAt >= timeBudgetMs) {
            summary.truncated = true;
            return summary;
        }
        const page = await dependencies.listAttempts({
            afterCreatedEventId,
            limit: Math.min(pageSize, remainingAttempts),
        });
        if (page.hasMore && !page.nextCreatedEventId) {
            summary.truncated = true;
            summary.failedCount += 1;
            summary.failureCategories.local_cursor_missing =
                (summary.failureCategories.local_cursor_missing ?? 0) + 1;
            return summary;
        }

        for (const candidate of page.items) {
            if (
                summary.scannedCount >= maxAttempts ||
                Date.now() - startedAt >= timeBudgetMs
            ) {
                summary.truncated = true;
                return summary;
            }
            // Advance immediately before external work so a hard timeout on
            // this candidate cannot pin later peers in the same page.
            await dependencies.setCursor(candidate.createdEventId);
            summary.scannedCount += 1;
            const outcome = await reconcileCandidate(candidate, dependencies);
            recordOutcome(summary, outcome);
            if (outcome.status === 'failed') {
                console.error('Stripe checkout orphan reconciliation failed', {
                    attemptId: candidate.attempt.snapshot.attemptId,
                    cartId: candidate.attempt.snapshot.cartId,
                    category: outcome.category,
                });
            }
        }
        if (!page.hasMore) {
            await dependencies.setCursor(null);
            return summary;
        }
        await dependencies.setCursor(page.nextCreatedEventId ?? null);
        afterCreatedEventId = page.nextCreatedEventId;
        if (
            summary.scannedCount >= maxAttempts ||
            Date.now() - startedAt >= timeBudgetMs
        ) {
            summary.truncated = true;
            return summary;
        }
    }

    summary.truncated = true;
    return summary;
}
