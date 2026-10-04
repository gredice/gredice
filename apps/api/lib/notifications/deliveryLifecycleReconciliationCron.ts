import { processDeliveryLifecycleReconciliation } from './deliveryLifecycleReconciliationWorker';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

export async function handleDeliveryLifecycleReconciliationCron(
    request: Request,
    run = processDeliveryLifecycleReconciliation,
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }
    try {
        const result = await run();
        return Response.json(
            { success: result.failed === 0, ...result },
            { headers: noStoreHeaders },
        );
    } catch (error) {
        console.error('Delivery lifecycle reconciliation cron failed', {
            errorName:
                error instanceof Error ? error.name.slice(0, 64) : 'Unknown',
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
