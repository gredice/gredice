import { withAuth } from '../../../../lib/auth/auth';
import { startDeliveryRun } from '../../../../lib/deliveryDashboard';

export async function POST(request: Request) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const body: unknown = await request.json().catch(() => null);
        const slotId =
            typeof body === 'object' &&
            body !== null &&
            'slotId' in body &&
            typeof body.slotId === 'number' &&
            Number.isInteger(body.slotId)
                ? body.slotId
                : null;
        if (!slotId) {
            return Response.json(
                { error: 'Odaberi valjani termin dostave.' },
                { status: 400 },
            );
        }

        try {
            const run = await startDeliveryRun({
                driverUserId: userId,
                slotId,
            });
            return Response.json({ id: run.id }, { status: 201 });
        } catch (error) {
            console.error('Failed to start delivery run', {
                error,
                slotId,
                userId,
            });
            return Response.json(
                {
                    error: 'Rutu nije moguće pokrenuti. Provjeri adrese i pokušaj ponovno.',
                },
                { status: 409 },
            );
        }
    });
}
