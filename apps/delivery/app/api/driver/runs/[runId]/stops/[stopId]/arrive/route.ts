import { withAuth } from '../../../../../../../../lib/auth/auth';
import { arriveAtDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId, stopId: stopIdValue } = await params;
        const stopId = Number(stopIdValue);
        if (!Number.isInteger(stopId)) {
            return Response.json(
                { error: 'Neispravna stanica.' },
                { status: 400 },
            );
        }
        try {
            await arriveAtDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
            });
            return Response.json({ success: true });
        } catch (error) {
            console.error('Failed to mark delivery stop arrived', {
                error,
                runId,
                stopId,
                userId,
            });
            return Response.json(
                { error: 'Dolazak nije moguće potvrditi.' },
                { status: 409 },
            );
        }
    });
}
