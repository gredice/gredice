const truthyMaintenanceValues = new Set(['1', 'enabled', 'on', 'true', 'yes']);

// This prerequisite release must pause completed-payment processing before
// migration 0078 can run. Issue #4388 removes this forced default only after
// the advisory drain fence and claim schema have been verified in production.
export const stripeCheckoutClaimCutoverMaintenanceDefault = true;

export type StripeCheckoutProcessingMaintenanceSource = 'cron' | 'webhook';

export function parseStripeCheckoutProcessingMaintenanceFlag(
    value: string | undefined,
) {
    return truthyMaintenanceValues.has(value?.trim().toLowerCase() ?? '');
}

export function isStripeCheckoutProcessingMaintenanceEnabled() {
    return (
        stripeCheckoutClaimCutoverMaintenanceDefault ||
        parseStripeCheckoutProcessingMaintenanceFlag(
            process.env.GREDICE_STRIPE_CHECKOUT_PROCESSING_MAINTENANCE_ENABLED,
        )
    );
}

export function getStripeCheckoutProcessingMaintenanceResponse(
    source: StripeCheckoutProcessingMaintenanceSource,
) {
    console.warn('stripe_payment.processing.maintenance_active', { source });
    return Response.json(
        { maintenance: true, success: false },
        {
            headers: {
                'Cache-Control': 'private, no-store',
                'Retry-After': '60',
            },
            status: 503,
        },
    );
}
