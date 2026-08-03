import { cleanupOutletLifecycle } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { reconcileStripeCheckoutOrphanAttempts } from '../../../../../lib/checkout/stripeCheckoutOrphanReconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function failureCategory(error: unknown) {
    return error instanceof Error ? error.name : 'unknown';
}

async function runOutletCleanup() {
    try {
        return {
            status: 'fulfilled' as const,
            value: await cleanupOutletLifecycle(),
        };
    } catch (error) {
        const category = failureCategory(error);
        console.error('Outlet lifecycle cleanup failed', { category });
        return { category, status: 'rejected' as const };
    }
}

async function runStripeAttemptReconciliation() {
    try {
        return {
            status: 'fulfilled' as const,
            value: await reconcileStripeCheckoutOrphanAttempts(),
        };
    } catch (error) {
        const category = failureCategory(error);
        console.error('Stripe checkout attempt reconciliation failed', {
            category,
        });
        return { category, status: 'rejected' as const };
    }
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    // Keep the established cleanup job independent from Stripe availability
    // and from malformed recovery candidates.
    const cleanup = await runOutletCleanup();
    const reconciliation = await runStripeAttemptReconciliation();
    const healthy =
        cleanup.status === 'fulfilled' &&
        reconciliation.status === 'fulfilled' &&
        reconciliation.value.failedCount === 0 &&
        !reconciliation.value.truncated;

    return Response.json(
        {
            success: healthy,
            reconciliation:
                reconciliation.status === 'fulfilled'
                    ? reconciliation.value
                    : null,
            reconciliationFailureCategory:
                reconciliation.status === 'rejected'
                    ? reconciliation.category
                    : null,
            releasedReservationsCount:
                cleanup.status === 'fulfilled'
                    ? cleanup.value.releasedReservationIds.length
                    : 0,
            closedOffersCount:
                cleanup.status === 'fulfilled'
                    ? cleanup.value.closedOfferIds.length
                    : 0,
            cleanupFailureCategory:
                cleanup.status === 'rejected' ? cleanup.category : null,
            timestamp: new Date().toISOString(),
        },
        { status: healthy ? 200 : 503 },
    );
}
