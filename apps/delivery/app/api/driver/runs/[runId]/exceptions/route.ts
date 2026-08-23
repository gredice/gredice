import { withAuth } from '../../../../../../lib/auth/auth';
import { recordDriverDeliveryExceptions } from '../../../../../../lib/deliveryDashboard';
import {
    DeliveryMutationRequestError,
    parseDeliveryExceptionMutation,
} from '../../../../../../lib/deliveryMutationRequest';
import {
    deliveryOperationalOpaqueId,
    deliveryOperationFailureLogContext,
} from '../../../../../../lib/deliveryOperationalLogging';
import { deliveryRunExecutionErrorDetails } from '../../../../../../lib/deliveryRunExecutionError';

const privateNoStore = { 'Cache-Control': 'private, no-store' };

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId } = await params;
        const body: unknown = await request.json().catch(() => null);
        let mutation: ReturnType<typeof parseDeliveryExceptionMutation>;
        try {
            mutation = parseDeliveryExceptionMutation(body);
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
            const result = await recordDriverDeliveryExceptions({
                driverUserId: userId,
                runId,
                ...mutation,
            });
            return Response.json(result, { headers: privateNoStore });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            if (!executionError) {
                console.error('Failed to record delivery exceptions', {
                    ...deliveryOperationFailureLogContext({
                        error,
                        mutationCount: mutation.exceptions.length,
                    }),
                    runId: deliveryOperationalOpaqueId(runId),
                });
            }
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Ishod dostave trenutačno nije moguće spremiti.',
                    code: executionError?.code ?? 'delivery-mutation-failed',
                },
                {
                    status: executionError ? 409 : 500,
                    headers: privateNoStore,
                },
            );
        }
    });
}
