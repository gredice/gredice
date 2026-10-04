import type { NextRequest } from 'next/server';
import { handleOrderConfirmationEmailCron } from '../../../../../lib/checkout/orderConfirmationEmailCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    return await handleOrderConfirmationEmailCron(request);
}
