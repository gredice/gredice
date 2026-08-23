import {
    cleanupOutletLifecycle,
    getStripePaymentProcessingDrainPreflight,
} from '@gredice/storage';
import { reconcileStripeCheckoutOrphanAttempts } from '../checkout/stripeCheckoutOrphanReconciliation';
import { isStripeCheckoutProcessingMaintenanceEnabled } from './stripeCheckoutProcessingMaintenance';
import { getStripeOperationalErrorDiagnostic } from './stripeOperationalError';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

type OutletLifecycleCronDependencies = {
    cleanup: typeof cleanupOutletLifecycle;
    drainPreflight: typeof getStripePaymentProcessingDrainPreflight;
    maintenanceEnabled: () => boolean;
    now: () => Date;
    reconcile: typeof reconcileStripeCheckoutOrphanAttempts;
};

const defaultDependencies: OutletLifecycleCronDependencies = {
    cleanup: cleanupOutletLifecycle,
    drainPreflight: getStripePaymentProcessingDrainPreflight,
    maintenanceEnabled: isStripeCheckoutProcessingMaintenanceEnabled,
    now: () => new Date(),
    reconcile: reconcileStripeCheckoutOrphanAttempts,
};

function failureCategory(error: unknown) {
    return getStripeOperationalErrorDiagnostic(error).errorName;
}

async function runOutletCleanup(cleanup: typeof cleanupOutletLifecycle) {
    try {
        return {
            status: 'fulfilled' as const,
            value: await cleanup(),
        };
    } catch (error) {
        const category = failureCategory(error);
        console.error('Outlet lifecycle cleanup failed', {
            category,
            ...getStripeOperationalErrorDiagnostic(error),
        });
        return { category, status: 'rejected' as const };
    }
}

async function runStripeAttemptReconciliation(
    reconcile: typeof reconcileStripeCheckoutOrphanAttempts,
) {
    try {
        return {
            status: 'fulfilled' as const,
            value: await reconcile(),
        };
    } catch (error) {
        const category = failureCategory(error);
        console.error('Stripe checkout attempt reconciliation failed', {
            category,
            ...getStripeOperationalErrorDiagnostic(error),
        });
        return { category, status: 'rejected' as const };
    }
}

export async function handleOutletLifecycleCron(
    request: Request,
    dependencies: Partial<OutletLifecycleCronDependencies> = {},
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }

    const resolved = { ...defaultDependencies, ...dependencies };
    // Keep the established cleanup job independent from Stripe availability
    // and from malformed recovery candidates.
    const cleanup = await runOutletCleanup(resolved.cleanup);
    const maintenance = resolved.maintenanceEnabled();
    const reconciliation = maintenance
        ? null
        : await runStripeAttemptReconciliation(resolved.reconcile);
    let stripePaymentProcessingDrained: boolean | null = null;
    let stripePaymentProcessingDrainFailureCategory: string | null = null;
    if (maintenance) {
        try {
            stripePaymentProcessingDrained = await resolved.drainPreflight();
        } catch (error) {
            stripePaymentProcessingDrainFailureCategory =
                failureCategory(error);
            console.error('Stripe payment processing drain preflight failed', {
                category: stripePaymentProcessingDrainFailureCategory,
                ...getStripeOperationalErrorDiagnostic(error),
            });
        }
    }
    const healthy =
        !maintenance &&
        cleanup.status === 'fulfilled' &&
        reconciliation !== null &&
        reconciliation.status === 'fulfilled' &&
        reconciliation.value.failedCount === 0 &&
        !reconciliation.value.truncated;

    if (maintenance) {
        console.warn('stripe_payment.processing.maintenance_active', {
            drained: stripePaymentProcessingDrained,
            drainFailureCategory: stripePaymentProcessingDrainFailureCategory,
            source: 'outlet_lifecycle',
        });
    }

    return Response.json(
        {
            success: healthy,
            maintenance,
            stripePaymentProcessingDrained,
            stripePaymentProcessingDrainFailureCategory,
            reconciliation:
                reconciliation?.status === 'fulfilled'
                    ? reconciliation.value
                    : null,
            reconciliationFailureCategory:
                reconciliation?.status === 'rejected'
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
            timestamp: resolved.now().toISOString(),
        },
        {
            headers: {
                ...noStoreHeaders,
                ...(maintenance ? { 'Retry-After': '60' } : {}),
            },
            status: healthy ? 200 : 503,
        },
    );
}
