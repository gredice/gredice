import { withAuth } from '../../../../../../../../lib/auth/auth';
import { arriveAtDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';
import { deliveryRunExecutionErrorDetails } from '../../../../../../../../lib/deliveryRunExecutionError';

export async function POST(
    _request: Request,
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
        try {
            await arriveAtDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
            });
            return Response.json({ success: true });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            const logContext = { runId, stopId, userId };
            if (executionError) {
                console.warn('Delivery stop arrival rejected', {
                    ...logContext,
                    code: executionError.code,
                });
            } else {
                console.error('Failed to mark delivery stop arrived', {
                    ...logContext,
                    error,
                });
            }
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Dolazak trenutačno nije moguće potvrditi.',
                    code: executionError?.code,
                },
                { status: 409 },
            );
        }
    });
}
