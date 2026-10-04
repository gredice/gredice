import type { NextRequest } from 'next/server';
import { handleCheckoutNotificationCron } from '../../../../../lib/checkout/checkoutNotificationCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    return await handleCheckoutNotificationCron(request);
}
