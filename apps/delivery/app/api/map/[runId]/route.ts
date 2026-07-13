import {
    accountCanTrackDeliveryRun,
    DeliveryRunStopStates,
    getDeliveryRequest,
    getDeliveryRun,
} from '@gredice/storage';
import { withAuth } from '../../../../lib/auth/auth';
import {
    buildGoogleStaticMapUrl,
    unavailableMapSvg,
} from '../../../../lib/googleStaticMap';

function unavailableMapResponse() {
    return new Response(unavailableMapSvg(), {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await withAuth(
        ['user', 'farmer', 'driver', 'admin'],
        async ({ accountId, userId, user }) => {
            const { runId } = await params;
            const run = await getDeliveryRun(runId);
            if (!run) return new Response(null, { status: 404 });

            const driverView =
                (user.role === 'driver' || user.role === 'admin') &&
                run.driverUserId === userId;
            const customerView = !driverView;
            if (
                customerView &&
                !(await accountCanTrackDeliveryRun({ accountId, runId }))
            ) {
                return new Response(null, { status: 403 });
            }

            const stops = driverView
                ? run.stops
                : (
                      await Promise.all(
                          run.stops.map(async (stop) => ({
                              request: await getDeliveryRequest(
                                  stop.deliveryRequestId,
                              ),
                              stop,
                          })),
                      )
                  )
                      .filter(({ request }) => request?.accountId === accountId)
                      .map(({ stop }) => stop);
            const url = buildGoogleStaticMapUrl({
                driverLocation:
                    run.currentLatitude !== null &&
                    run.currentLongitude !== null
                        ? {
                              latitude: run.currentLatitude,
                              longitude: run.currentLongitude,
                          }
                        : null,
                stops: stops
                    .filter(
                        (stop) =>
                            stop.state !== DeliveryRunStopStates.DELIVERED ||
                            customerView,
                    )
                    .map((stop) => ({
                        latitude: stop.latitude,
                        longitude: stop.longitude,
                        sequence: stop.sequence,
                    })),
                encodedPolyline: run.encodedPolyline,
                customerView,
            });
            if (!url) return unavailableMapResponse();

            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) return unavailableMapResponse();
                return new Response(await response.arrayBuffer(), {
                    status: 200,
                    headers: {
                        'Content-Type':
                            response.headers.get('content-type') ?? 'image/png',
                        'Cache-Control': 'no-store',
                    },
                });
            } catch (error) {
                console.error('Failed to load delivery map', { error, runId });
                return unavailableMapResponse();
            }
        },
    );
}
