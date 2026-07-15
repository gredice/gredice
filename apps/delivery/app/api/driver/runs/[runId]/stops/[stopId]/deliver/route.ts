import { withAuth } from '../../../../../../../../lib/auth/auth';
import { deliverDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';
import { deliveryRunExecutionErrorDetails } from '../../../../../../../../lib/deliveryRunExecutionError';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId, stopId: stopIdValue } = await params;
        const stopId = Number(stopIdValue);
        if (!Number.isInteger(stopId)) {
            return Response.json(
                { error: 'Neispravna stanica.' },
                { status: 400 },
            );
        }
        const body: unknown = await request.json().catch(() => null);
        const notes =
            typeof body === 'object' &&
            body !== null &&
            'notes' in body &&
            typeof body.notes === 'string' &&
            body.notes.trim()
                ? body.notes.trim().slice(0, 1_000)
                : undefined;
        try {
            await deliverDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
                notes,
            });
            return Response.json({ success: true });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            const logContext = { runId, stopId, userId };
            if (executionError) {
                console.warn('Delivery stop completion rejected', {
                    ...logContext,
                    code: executionError.code,
                });
            } else {
                console.error('Failed to deliver stop', {
                    ...logContext,
                    error,
                });
            }
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Dostavu trenutačno nije moguće potvrditi.',
                    code: executionError?.code,
                },
                { status: 409 },
            );
        }
    });
}
