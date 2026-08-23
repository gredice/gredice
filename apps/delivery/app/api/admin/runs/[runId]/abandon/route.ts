import { withAuth } from '../../../../../../lib/auth/auth';
import { abandonAdminDeliveryRun } from '../../../../../../lib/deliveryDashboard';
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
        const reason =
            typeof body === 'object' &&
            body !== null &&
            'reason' in body &&
            typeof body.reason === 'string' &&
            body.reason.trim()
                ? body.reason.trim().slice(0, 1_000)
                : undefined;
        try {
            const result = await abandonAdminDeliveryRun({
                adminUserId: userId,
                runId,
                expectedRouteRevision: routeRevision,
                reason,
            });
            return Response.json(result, { headers: privateNoStore });
        } catch (error) {
            const executionError = deliveryRunExecutionErrorDetails(error);
            return Response.json(
                {
                    error:
                        executionError?.message ??
                        'Rutu trenutačno nije moguće napustiti.',
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
