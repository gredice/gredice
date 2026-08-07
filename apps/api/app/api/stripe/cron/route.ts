import type { NextRequest } from 'next/server';
import { handleStripeCheckoutReconciliationCron } from '../../../../lib/stripe/stripeCheckoutReconciliationCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    return handleStripeCheckoutReconciliationCron(request);
}
