import type { NextRequest } from 'next/server';
import { handleDeliveryLifecycleReconciliationCron } from '../../../../../lib/notifications/deliveryLifecycleReconciliationCron';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return await handleDeliveryLifecycleReconciliationCron(request);
}
