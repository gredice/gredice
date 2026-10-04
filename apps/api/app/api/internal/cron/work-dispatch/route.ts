import type { NextRequest } from 'next/server';
import { runDueWork } from '../../../../../lib/cron/dueWork';
import { readDeliveryLifecycleEmailEnabled } from '../../../../../lib/notifications/deliveryLifecycleEmailWorker';
import { deliveryLifecycleReconciliationEnabled } from '../../../../../lib/notifications/deliveryLifecycleReconciliationWorker';
import { GET as automations } from '../automations/route';
import { GET as checkoutNotifications } from '../checkout-notifications/route';
import { GET as deliveryEmails } from '../delivery-lifecycle-emails/route';
import { GET as deliveryReconciliation } from '../delivery-lifecycle-reconciliation/route';
import { GET as orderConfirmations } from '../order-confirmation-emails/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
        return new Response('Unauthorized', { status: 401 });

    // Existing workers keep their own bounded batches, claims and ordering.
    // Independent queues can drain concurrently within the minute's budget.
    const results = await Promise.all(
        [
            runDueWork('automations', () => automations(request)),
            runDueWork('order-confirmation-emails', () =>
                orderConfirmations(request),
            ),
            runDueWork('checkout-notifications', () =>
                checkoutNotifications(request),
            ),
            runDueWork(
                'delivery-lifecycle-emails',
                () => deliveryEmails(request),
                {
                    enabled: readDeliveryLifecycleEmailEnabled(),
                },
            ),
            runDueWork(
                'delivery-lifecycle-reconciliation',
                () => deliveryReconciliation(request),
                {
                    enabled: deliveryLifecycleReconciliationEnabled(),
                },
            ),
        ].map(async (result) => {
            try {
                const response = await result;
                const body: unknown = await response.json();
                return { status: response.status, result: body };
            } catch (error) {
                console.error('Due-work dispatcher worker failed', {
                    errorName: error instanceof Error ? error.name : 'Unknown',
                });
                return { status: 500, result: { success: false } };
            }
        }),
    );
    const success = results.every(
        ({ status, result }) =>
            status < 400 &&
            !(
                typeof result === 'object' &&
                result !== null &&
                'success' in result &&
                result.success === false
            ),
    );
    return Response.json(
        { success, jobs: results },
        {
            status: success ? 200 : 500,
            headers: { 'Cache-Control': 'private, no-store' },
        },
    );
}
