import { withAuth } from '../../../../../../../../lib/auth/auth';
import { deliverDeliveryStop } from '../../../../../../../../lib/deliveryDashboard';

export async function POST(
    request: Request,
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
        const body: unknown = await request.json().catch(() => null);
        const notes =
            typeof body === 'object' &&
            body !== null &&
            'notes' in body &&
            typeof body.notes === 'string' &&
            body.notes.trim()
                ? body.notes.trim().slice(0, 1_000)
                : undefined;
        try {
            await deliverDeliveryStop({
                driverUserId: userId,
                runId,
                stopId,
                notes,
            });
            return Response.json({ success: true });
        } catch (error) {
            console.error('Failed to deliver stop', {
                error,
                runId,
                stopId,
                userId,
            });
            return Response.json(
                { error: 'Dostavu nije moguće potvrditi.' },
                { status: 409 },
            );
        }
    });
}
