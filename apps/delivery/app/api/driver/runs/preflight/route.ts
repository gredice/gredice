import { withAuth } from '../../../../../lib/auth/auth';
import {
    deliveryRunStartErrorLogContext,
    deliveryRunStartErrorMessage,
} from '../../../../../lib/deliveryDashboard';
import {
    DeliveryRunPreparationError,
    prepareDeliveryRun,
} from '../../../../../lib/deliveryRunPlanning';
import { parseDeliveryRunRequestBody } from '../../../../../lib/deliveryRunRequest';

export async function POST(request: Request) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const body: unknown = await request.json().catch(() => null);
        const deliveryRequestIds = parseDeliveryRunRequestBody(body);
        if (!deliveryRequestIds) {
            return Response.json(
                { error: 'Odaberi barem jednu valjanu dostavu.' },
                { status: 400 },
            );
        }

        try {
            const preparation = await prepareDeliveryRun({
                driverUserId: userId,
                deliveryRequestIds,
            });
            return Response.json({
                valid: true,
                summary: preparation.summary,
            });
        } catch (error) {
            const message = deliveryRunStartErrorMessage(error);
            const context = deliveryRunStartErrorLogContext(error);
            if (message) {
                console.warn('Delivery run preflight rejected', {
                    ...context,
                    requestCount: deliveryRequestIds.length,
                    userId,
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
                    { status: 409 },
                );
            }

            console.error('Delivery run preflight failed', {
                ...context,
                requestCount: deliveryRequestIds.length,
                userId,
            });
            return Response.json(
                {
                    error: 'Rutu trenutačno nije moguće provjeriti. Pokušaj ponovno.',
                },
                { status: 503 },
            );
        }
    });
}
