import { withAuth } from '../../../../lib/auth/auth';
import {
    deliveryRunStartErrorLogContext,
    deliveryRunStartErrorMessage,
    startDeliveryRun,
} from '../../../../lib/deliveryDashboard';
import { DeliveryRunPreparationError } from '../../../../lib/deliveryRunPlanning';
import { parseDeliveryRunStartRequestBody } from '../../../../lib/deliveryRunRequest';

const privateNoStoreHeaders = {
    'Cache-Control': 'private, no-store',
};

export async function POST(request: Request) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const body: unknown = await request.json().catch(() => null);
        const startRequest = parseDeliveryRunStartRequestBody(body);
        if (!startRequest) {
            return Response.json(
                {
                    error: 'Odaberi barem jednu valjanu dostavu.',
                },
                { status: 400, headers: privateNoStoreHeaders },
            );
        }
        const { deliveryRequestIds, preparationToken } = startRequest;

        try {
            const run = await startDeliveryRun({
                driverUserId: userId,
                deliveryRequestIds,
                preparationToken,
            });
            return Response.json(
                { id: run.id },
                { status: 201, headers: privateNoStoreHeaders },
            );
        } catch (error) {
            const startErrorMessage = deliveryRunStartErrorMessage(error);
            console.error('Failed to start delivery run', {
                ...deliveryRunStartErrorLogContext(error),
                requestCount: deliveryRequestIds.length,
            });
            return Response.json(
                {
                    error:
                        startErrorMessage ??
                        'Rutu nije moguće pokrenuti. Provjeri adrese i pokušaj ponovno.',
                    code:
                        error instanceof DeliveryRunPreparationError
                            ? error.code
                            : undefined,
                    conflict:
                        error instanceof DeliveryRunPreparationError
                            ? error.conflict
                            : undefined,
                },
                {
                    status: startErrorMessage ? 409 : 503,
                    headers: privateNoStoreHeaders,
                },
            );
        }
    });
}
