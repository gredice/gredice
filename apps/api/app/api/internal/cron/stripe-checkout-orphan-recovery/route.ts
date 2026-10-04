import type { NextRequest } from 'next/server';
import { handleDueWorkCron } from '../../../../../lib/cron/dueWork';
import { handleStripeCheckoutOrphanRecoveryCron } from '../../../../../lib/stripe/outletLifecycleCron';
import { isStripeCheckoutProcessingMaintenanceEnabled } from '../../../../../lib/stripe/stripeCheckoutProcessingMaintenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    return handleDueWorkCron(
        request,
        'stripe-checkout-orphan-recovery',
        () => handleStripeCheckoutOrphanRecoveryCron(request),
        {
            recoveryPreflight: true,
            force: isStripeCheckoutProcessingMaintenanceEnabled(),
        },
    );
}
