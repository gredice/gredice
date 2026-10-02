import type { NextRequest } from 'next/server';
import { handleStripeCheckoutOrphanRecoveryCron } from '../../../../../lib/stripe/outletLifecycleCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    return handleStripeCheckoutOrphanRecoveryCron(request);
}
