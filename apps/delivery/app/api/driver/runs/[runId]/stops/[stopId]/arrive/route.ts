import { withAuth } from '../../../../../../../../lib/auth/auth';
import { arriveAtDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';
import {
    DeliveryMutationRequestError,
    expectedRouteRevision,
} from '../../../../../../../../lib/deliveryMutationRequest';
import { deliveryRunExecutionErrorDetails } from '../../../../../../../../lib/deliveryRunExecutionError';

const privateNoStore = { 'Cache-Control': 'private, no-store' };

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
                { status: 400, headers: privateNoStore },
            );
        }
        const body: unknown = await request.json().catch(() => null);
        let routeRevision: number;
        try {
            routeRevision = expectedRouteRevision(body);
        } catch (error) {
            return Response.json(
                {
                    error:
                        error instanceof DeliveryMutationRequestError
                            ? error.message
                            : 'Neispravna promjena dostave.',
                    code: 'invalid-delivery-mutation',
                },
                { status: 400, headers: privateNoStore },
            );
        }
        try {
            const result = await arriveAtDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
                expectedRouteRevision: routeRevision,
            });
            return Response.json(
                { success: true, ...result },
                { headers: privateNoStore },
            );
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
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                });
            }
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Dolazak trenutačno nije moguće potvrditi.',
                    code: executionError?.code,
                },
                { status: 409, headers: privateNoStore },
            );
        }
    });
}
