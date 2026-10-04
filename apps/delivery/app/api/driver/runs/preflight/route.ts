import { withAuth } from '../../../../../lib/auth/auth';
import {
    deliveryRunStartErrorLogContext,
    deliveryRunStartErrorMessage,
} from '../../../../../lib/deliveryDashboard';
import {
    DeliveryRunPreparationError,
    prepareDeliveryRun,
    savePreparedDeliveryRun,
} from '../../../../../lib/deliveryRunPlanning';
import { parseDeliveryRunPreflightRequestBody } from '../../../../../lib/deliveryRunRequest';

const privateNoStoreHeaders = {
    'Cache-Control': 'private, no-store',
};

export async function POST(request: Request) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const body: unknown = await request.json().catch(() => null);
        const deliveryRequestIds = parseDeliveryRunPreflightRequestBody(body);
        if (!deliveryRequestIds) {
            return Response.json(
                { error: 'Odaberi barem jednu valjanu dostavu.' },
                { status: 400, headers: privateNoStoreHeaders },
            );
        }

        try {
            const preparation = await prepareDeliveryRun({
                driverUserId: userId,
                deliveryRequestIds,
            });
            const savedPreparation = await savePreparedDeliveryRun(preparation);
            return Response.json(
                {
                    valid: true,
                    preparationToken: savedPreparation.preparationToken,
                    expiresAt: savedPreparation.expiresAt.toISOString(),
                    summary: preparation.summary,
                },
                { headers: privateNoStoreHeaders },
            );
        } catch (error) {
            const message = deliveryRunStartErrorMessage(error);
            const context = deliveryRunStartErrorLogContext(error);
            if (message) {
                console.warn('Delivery run preflight rejected', {
                    ...context,
                    requestCount: deliveryRequestIds.length,
                });
                return Response.json(
                    {
                        valid: false,
                        error: message,
                        code:
                            error instanceof DeliveryRunPreparationError
                                ? error.code
                                : undefined,
                        conflict:
                            error instanceof DeliveryRunPreparationError
                                ? error.conflict
                                : undefined,
                    },
                    { status: 409, headers: privateNoStoreHeaders },
                );
            }

            console.error('Delivery run preflight failed', {
                ...context,
                requestCount: deliveryRequestIds.length,
            });
            return Response.json(
                {
                    error: 'Rutu trenutačno nije moguće provjeriti. Pokušaj ponovno.',
                },
                { status: 503, headers: privateNoStoreHeaders },
            );
        }
    });
}
