import { withAuth } from '../../../../../../lib/auth/auth';
import { recordDriverLocation } from '../../../../../../lib/deliveryDashboard';

function optionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId } = await params;
        const body: unknown = await request.json().catch(() => null);
        if (typeof body !== 'object' || body === null) {
            return Response.json(
                { error: 'Neispravna lokacija.' },
                { status: 400 },
            );
        }
        const latitude =
            'latitude' in body ? optionalNumber(body.latitude) : undefined;
        const longitude =
            'longitude' in body ? optionalNumber(body.longitude) : undefined;
        if (latitude === undefined || longitude === undefined) {
            return Response.json(
                { error: 'Neispravna lokacija.' },
                { status: 400 },
            );
        }
        const recordedAtValue =
            'recordedAt' in body && typeof body.recordedAt === 'string'
                ? new Date(body.recordedAt)
                : new Date();
        const recordedAt = Number.isNaN(recordedAtValue.getTime())
            ? new Date()
            : recordedAtValue;
        if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) {
            return Response.json(
                { error: 'Neispravno vrijeme lokacije.' },
                { status: 400 },
            );
        }

        try {
            await recordDriverLocation({
                driverUserId: userId,
                runId,
                latitude,
                longitude,
                accuracy:
                    'accuracy' in body
                        ? optionalNumber(body.accuracy)
                        : undefined,
                heading:
                    'heading' in body
                        ? optionalNumber(body.heading)
                        : undefined,
                speed: 'speed' in body ? optionalNumber(body.speed) : undefined,
                recordedAt,
            });
            return new Response(null, { status: 204 });
        } catch (error) {
            console.error('Failed to record driver location', {
                error,
                runId,
                userId,
            });
            return Response.json(
                { error: 'Lokaciju nije moguće spremiti.' },
                { status: 409 },
            );
        }
    });
}
