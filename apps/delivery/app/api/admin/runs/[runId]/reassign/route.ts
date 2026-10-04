import { withAuth } from '../../../../../../lib/auth/auth';
import { reassignAdminDeliveryRun } from '../../../../../../lib/deliveryDashboard';
import {
    DeliveryMutationRequestError,
    expectedRouteRevision,
} from '../../../../../../lib/deliveryMutationRequest';
import { deliveryRunExecutionErrorDetails } from '../../../../../../lib/deliveryRunExecutionError';

const privateNoStore = { 'Cache-Control': 'private, no-store' };

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await withAuth(['admin'], async ({ userId }) => {
        const { runId } = await params;
        const body: unknown = await request.json().catch(() => null);
        let routeRevision: number;
        let newDriverUserId: string;
        try {
            routeRevision = expectedRouteRevision(body);
            if (
                typeof body !== 'object' ||
                body === null ||
                !('newDriverUserId' in body) ||
                typeof body.newDriverUserId !== 'string' ||
                !body.newDriverUserId.trim()
            ) {
                throw new DeliveryMutationRequestError(
                    'Novi dostavljač nije valjan.',
                );
            }
            newDriverUserId = body.newDriverUserId.trim();
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
            const result = await reassignAdminDeliveryRun({
                adminUserId: userId,
                runId,
                newDriverUserId,
                expectedRouteRevision: routeRevision,
            });
            return Response.json(result, { headers: privateNoStore });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Rutu trenutačno nije moguće preraspodijeliti.',
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
