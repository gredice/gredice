import type { NextRequest } from 'next/server';
import { handleDeliveryLifecycleEmailCron } from '../../../../../lib/notifications/deliveryLifecycleEmailCron';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return await handleDeliveryLifecycleEmailCron(request);
}
