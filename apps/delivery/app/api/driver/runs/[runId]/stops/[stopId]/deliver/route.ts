import { DeliveryRunStopOperationKinds } from '@gredice/storage';
import { withAuth } from '../../../../../../../../lib/auth/auth';
import { deliverDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';
import {
    DeliveryMutationRequestError,
    parseDeliveryStopMutation,
} from '../../../../../../../../lib/deliveryMutationRequest';
import {
    deliveryOperationalOpaqueId,
    deliveryOperationFailureLogContext,
    deliveryOperationRejectionLogContext,
} from '../../../../../../../../lib/deliveryOperationalLogging';
import {
    deliveryRunExecutionErrorDetails,
    deliveryRunExecutionErrorStatus,
} from '../../../../../../../../lib/deliveryRunExecutionError';

const privateNoStore = { 'Cache-Control': 'private, no-store' };

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId, stopId: stopIdValue } = await params;
        const stopId = Number(stopIdValue);
        if (!Number.isInteger(stopId) || stopId <= 0) {
            return Response.json(
                { error: 'Neispravna stanica.' },
                { status: 400, headers: privateNoStore },
            );
        }
        const body: unknown = await request.json().catch(() => null);
        let mutation: ReturnType<typeof parseDeliveryStopMutation>;
        try {
            mutation = parseDeliveryStopMutation(
                body,
                DeliveryRunStopOperationKinds.DELIVER,
            );
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
            const result = await deliverDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
                notes: mutation.notes,
                completionOverride: mutation.completionOverride,
                expectedRouteRevision: mutation.expectedRouteRevision,
                clientOperationId: mutation.clientOperationId,
                occurredAt: mutation.occurredAt,
            });
            return Response.json(result, { headers: privateNoStore });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            const logContext = {
                runId: deliveryOperationalOpaqueId(runId),
                stopId,
            };
            if (executionError) {
                console.warn('Delivery stop completion rejected', {
                    ...logContext,
                    ...deliveryOperationRejectionLogContext({
                        errorCode: executionError.code,
                    }),
                });
            } else {
                console.error('Failed to deliver stop', {
                    ...logContext,
                    ...deliveryOperationFailureLogContext({ error }),
                });
            }
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Dostavu trenutačno nije moguće potvrditi.',
                    code: executionError?.code ?? 'delivery-mutation-failed',
                },
                {
                    status: deliveryRunExecutionErrorStatus(error),
                    headers: privateNoStore,
                },
            );
        }
    });
}
