import { getDeliveryRun, isDeliveryRunStopTerminal } from '@gredice/storage';
import { withAuth } from '../../../../lib/auth/auth';
import {
    accountCanTrackDeliveryRun,
    resolveDeliveryRunStopGroups,
} from '../../../../lib/deliveryDashboard';
import { buildDeliveryMapData } from '../../../../lib/deliveryMapData';
import { driverDeliveryTrackingLocation } from '../../../../lib/deliveryTracking';
import {
    buildGoogleStaticMapUrl,
    unavailableMapSvg,
} from '../../../../lib/googleStaticMap';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

function unavailableMapResponse() {
    return new Response(unavailableMapSvg(), {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            ...noStoreHeaders,
        },
    });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await withAuth(
        ['user', 'farmer', 'driver', 'admin'],
        async ({ accountId, userId, user }) => {
            const { runId } = await params;
            const run = await getDeliveryRun(runId);
            if (!run) {
                return new Response(null, {
                    status: 404,
                    headers: noStoreHeaders,
                });
            }

            const driverView =
                (user.role === 'driver' || user.role === 'admin') &&
                run.driverUserId === userId;
            const customerView = !driverView;
            if (
                customerView &&
                !(await accountCanTrackDeliveryRun({ accountId, runId }))
            ) {
                return new Response(null, {
                    status: 403,
                    headers: noStoreHeaders,
                });
            }

            const projectedAt = new Date();
            const location = driverDeliveryTrackingLocation(run, projectedAt);
            const groups = await resolveDeliveryRunStopGroups(run);
            const stops = groups.flatMap((group, index) => {
                const customerOwnsStop = group.items.some(
                    ({ request }) => request?.accountId === accountId,
                );
                const delivered = group.items.every(({ stop }) =>
                    isDeliveryRunStopTerminal(stop.state),
                );
                const representative = group.items[0]?.stop;
                if (
                    !representative ||
                    (!driverView && !customerOwnsStop) ||
                    (driverView && delivered)
                ) {
                    return [];
                }
                return [
                    {
                        latitude: representative.latitude,
                        longitude: representative.longitude,
                        sequence: index + 1,
                    },
                ];
            });
            const mapData = buildDeliveryMapData({
                driverLocation: location
                    ? {
                          latitude: location.latitude,
                          longitude: location.longitude,
                      }
                    : null,
                pickupNodes: driverView
                    ? run.pickupNodes.flatMap((pickupNode) =>
                          pickupNode.latitude !== null &&
                          pickupNode.longitude !== null
                              ? [
                                    {
                                        latitude: pickupNode.latitude,
                                        longitude: pickupNode.longitude,
                                    },
                                ]
                              : [],
                      )
                    : [],
                stops,
                encodedPolyline: run.encodedPolyline,
                customerView,
            });
            if (new URL(request.url).searchParams.get('format') === 'json') {
                return Response.json(mapData, {
                    status: 200,
                    headers: noStoreHeaders,
                });
            }

            const url = buildGoogleStaticMapUrl({
                ...mapData,
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
                        ...noStoreHeaders,
                    },
                });
            } catch (error) {
                console.error('Failed to load delivery map', {
                    runId,
                    errorName: error instanceof Error ? error.name : 'Unknown',
                });
                return unavailableMapResponse();
            }
        },
    );
}
