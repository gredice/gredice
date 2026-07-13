import { withAuth } from '../../../../lib/auth/auth';
import {
    deliveryRunStartErrorMessage,
    startDeliveryRun,
} from '../../../../lib/deliveryDashboard';
import { parseDeliveryRunRequestBody } from '../../../../lib/deliveryRunRequest';

export async function POST(request: Request) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const body: unknown = await request.json().catch(() => null);
        const deliveryRequestIds = parseDeliveryRunRequestBody(body);
        if (!deliveryRequestIds) {
            return Response.json(
                {
                    error: 'Odaberi barem jednu valjanu dostavu.',
                },
                { status: 400 },
            );
        }

        try {
            const run = await startDeliveryRun({
                driverUserId: userId,
                deliveryRequestIds,
            });
            return Response.json({ id: run.id }, { status: 201 });
        } catch (error) {
            console.error('Failed to start delivery run', {
                error,
                requestCount: deliveryRequestIds.length,
                userId,
            });
            return Response.json(
                {
                    error:
                        deliveryRunStartErrorMessage(error) ??
                        'Rutu nije moguće pokrenuti. Provjeri adrese i pokušaj ponovno.',
                },
                { status: 409 },
            );
        }
    });
}
