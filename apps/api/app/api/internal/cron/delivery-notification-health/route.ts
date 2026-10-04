import type { NextRequest } from 'next/server';
import { handleDeliveryNotificationHealthCron } from '../../../../../lib/notifications/deliveryNotificationHealth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return await handleDeliveryNotificationHealthCron(request);
}
