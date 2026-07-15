import { withAuth } from '../../../../../../../../lib/auth/auth';
import { recoverAdminDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';
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
    return await withAuth(['admin'], async ({ userId }) => {
        const { runId, stopId: stopIdValue } = await params;
        const stopId = Number(stopIdValue);
        const body: unknown = await request.json().catch(() => null);
        let routeRevision: number;
        try {
            if (!Number.isInteger(stopId) || stopId <= 0) {
                throw new DeliveryMutationRequestError(
                    'Stanica dostave nije valjana.',
                );
            }
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
            const result = await recoverAdminDeliveryStop({
                adminUserId: userId,
                runId,
                stopId,
                expectedRouteRevision: routeRevision,
            });
            return Response.json(result, { headers: privateNoStore });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Dostavu trenutačno nije moguće oporaviti.',
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
