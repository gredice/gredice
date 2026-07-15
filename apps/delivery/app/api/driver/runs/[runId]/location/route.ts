import {
    DeliveryRunExecutionError,
    DeliveryRunExecutionErrorCodes,
} from '@gredice/storage';
import { withAuth } from '../../../../../../lib/auth/auth';
import { recordDriverLocation } from '../../../../../../lib/deliveryDashboard';
import { deliveryLocationCaptureTimeIsAcceptable } from '../../../../../../lib/deliveryTracking';

function requiredNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

function nullableNumber(value: unknown) {
    if (value === null || value === undefined) return null;
    return requiredNumber(value);
}

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

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
                { status: 400, headers: noStoreHeaders },
            );
        }
        const latitude =
            'latitude' in body ? requiredNumber(body.latitude) : undefined;
        const longitude =
            'longitude' in body ? requiredNumber(body.longitude) : undefined;
        if (latitude === undefined || longitude === undefined) {
            return Response.json(
                { error: 'Neispravna lokacija.' },
                { status: 400, headers: noStoreHeaders },
            );
        }
        const recordedAt =
            'recordedAt' in body && typeof body.recordedAt === 'string'
                ? new Date(body.recordedAt)
                : new Date(Number.NaN);
        const receivedAt = new Date();
        if (!deliveryLocationCaptureTimeIsAcceptable(recordedAt, receivedAt)) {
            return Response.json(
                { error: 'Neispravno vrijeme lokacije.' },
                { status: 400, headers: noStoreHeaders },
            );
        }

        const accuracy =
            'accuracy' in body ? nullableNumber(body.accuracy) : null;
        const heading = 'heading' in body ? nullableNumber(body.heading) : null;
        const speed = 'speed' in body ? nullableNumber(body.speed) : null;
        if (
            accuracy === undefined ||
            (accuracy !== null && accuracy < 0) ||
            heading === undefined ||
            (heading !== null && (heading < 0 || heading > 360)) ||
            speed === undefined ||
            (speed !== null && speed < 0)
        ) {
            return Response.json(
                { error: 'Neispravni podaci lokacije.' },
                { status: 400, headers: noStoreHeaders },
            );
        }

        try {
            const result = await recordDriverLocation({
                driverUserId: userId,
                runId,
                latitude,
                longitude,
                accuracy,
                heading,
                speed,
                recordedAt,
            });
            return Response.json(
                {
                    status: result.status,
                    acceptedAt: result.acceptedAt.toISOString(),
                    replayed: result.replayed,
                },
                { headers: noStoreHeaders },
            );
        } catch (error) {
            console.error('Failed to record driver location', {
                runId,
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorCode:
                    error instanceof DeliveryRunExecutionError
                        ? error.code
                        : undefined,
            });
            return Response.json(
                {
                    error: 'Lokaciju nije moguće spremiti.',
                    ...(error instanceof DeliveryRunExecutionError
                        ? { code: error.code }
                        : {}),
                },
                {
                    status:
                        error instanceof DeliveryRunExecutionError &&
                        error.code ===
                            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND
                            ? 404
                            : 409,
                    headers: noStoreHeaders,
                },
            );
        }
    });
}
