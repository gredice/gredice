import {
    buildDeliveryMapData,
    customerCurrentDeliveryMapStops,
    type DeliveryMapCoordinate,
    type DeliveryMapData,
    deliveryMapAudience,
    deliveryMapStopGroupSelectionId,
} from './deliveryMapData';

const privateNoStoreHeaders = { 'Cache-Control': 'private, no-store' };
const authenticatedRoles = ['user', 'farmer', 'driver', 'admin'];

type DeliveryMapAuthContext = {
    accountId: string;
    userId: string;
    user: {
        role: string;
    };
};

type DeliveryMapRouteContext = {
    params: Promise<{ runId: string }>;
};

export type DeliveryMapRouteRun = {
    id: string;
    driverUserId: string | null;
    pickupNodes: ReadonlyArray<{
        id: string;
        latitude: number | null;
        longitude: number | null;
    }>;
    encodedPolyline: string | null;
};

export type DeliveryMapRouteGroup = {
    items: ReadonlyArray<{
        stop: {
            id: number;
            state: string;
            latitude: number;
            longitude: number;
        };
        request?: {
            accountId?: string | null;
        };
    }>;
};

type CustomerDeliveryMapTrackingContext<TGroup extends DeliveryMapRouteGroup> =
    {
        groups: ReadonlyArray<TGroup>;
        currentDeliveryStopIds: ReadonlySet<number>;
    };

type DeliveryMapRouteDependencies<
    TRun extends DeliveryMapRouteRun,
    TGroup extends DeliveryMapRouteGroup,
> = {
    withAuth: (
        roles: string[],
        handler: (context: DeliveryMapAuthContext) => Promise<Response>,
    ) => Promise<Response>;
    getRun: (runId: string) => Promise<TRun | null | undefined>;
    getCustomerTrackingContext: (input: {
        accountId: string;
        run: TRun;
    }) => Promise<CustomerDeliveryMapTrackingContext<TGroup> | null>;
    resolveGroups: (run: TRun) => Promise<ReadonlyArray<TGroup>>;
    getDriverLocation: (
        run: TRun,
        projectedAt: Date,
    ) => DeliveryMapCoordinate | null;
    isStopTerminal: (state: string) => boolean;
    buildStaticMapUrl: (
        input: DeliveryMapData & { customerView: boolean },
    ) => string | URL | null;
    unavailableMapSvg: () => string;
    fetchMap?: (
        input: string | URL,
        init: { cache: 'no-store' },
    ) => Promise<Response>;
    now?: () => Date;
    logger?: Pick<Console, 'error'>;
};

function addPrivateNoStoreHeader(response: Response) {
    response.headers.set(
        'Cache-Control',
        privateNoStoreHeaders['Cache-Control'],
    );
    return response;
}

function unavailableMapResponse(unavailableMapSvg: () => string) {
    return new Response(unavailableMapSvg(), {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            ...privateNoStoreHeaders,
        },
    });
}

export function createDeliveryMapRouteHandlers<
    TRun extends DeliveryMapRouteRun,
    TGroup extends DeliveryMapRouteGroup,
>({
    withAuth,
    getRun,
    getCustomerTrackingContext,
    resolveGroups,
    getDriverLocation,
    isStopTerminal,
    buildStaticMapUrl,
    unavailableMapSvg,
    fetchMap = fetch,
    now = () => new Date(),
    logger = console,
}: DeliveryMapRouteDependencies<TRun, TGroup>) {
    async function authorize(
        handler: (context: DeliveryMapAuthContext) => Promise<Response>,
    ) {
        return addPrivateNoStoreHeader(
            await withAuth(authenticatedRoles, handler),
        );
    }

    async function GET(request: Request, { params }: DeliveryMapRouteContext) {
        return await authorize(async ({ accountId, userId, user }) => {
            const { runId } = await params;
            const run = await getRun(runId);
            if (!run) {
                return new Response(null, {
                    status: 404,
                    headers: privateNoStoreHeaders,
                });
            }

            const driverView =
                deliveryMapAudience({
                    role: user.role,
                    userId,
                    driverUserId: run.driverUserId,
                }) === 'driver';
            const customerView = !driverView;
            const customerTracking = customerView
                ? await getCustomerTrackingContext({ accountId, run })
                : null;
            if (customerView && !customerTracking) {
                return new Response(null, {
                    status: 403,
                    headers: privateNoStoreHeaders,
                });
            }

            const projectedAt = now();
            const location = getDriverLocation(run, projectedAt);
            const groups =
                customerTracking?.groups ?? (await resolveGroups(run));
            const stops = driverView
                ? groups.flatMap((group, index) => {
                      const delivered = group.items.every(({ stop }) =>
                          isStopTerminal(stop.state),
                      );
                      const representative = group.items[0]?.stop;
                      if (!representative || delivered) return [];
                      return [
                          {
                              latitude: representative.latitude,
                              longitude: representative.longitude,
                              sequence: index + 1,
                              selectionId: deliveryMapStopGroupSelectionId(
                                  group.items.map(({ stop }) => stop.id),
                              ),
                          },
                      ];
                  })
                : customerCurrentDeliveryMapStops({
                      accountId,
                      groups,
                      currentDeliveryStopIds:
                          customerTracking?.currentDeliveryStopIds ?? new Set(),
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
                                        selectionId: pickupNode.id,
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
                    headers: privateNoStoreHeaders,
                });
            }

            const url = buildStaticMapUrl({
                ...mapData,
                customerView,
            });
            if (!url) return unavailableMapResponse(unavailableMapSvg);

            try {
                const response = await fetchMap(url, { cache: 'no-store' });
                if (!response.ok) {
                    return unavailableMapResponse(unavailableMapSvg);
                }
                return new Response(await response.arrayBuffer(), {
                    status: 200,
                    headers: {
                        'Content-Type':
                            response.headers.get('content-type') ?? 'image/png',
                        ...privateNoStoreHeaders,
                    },
                });
            } catch (error) {
                logger.error('Failed to load delivery map', {
                    runId,
                    errorName: error instanceof Error ? error.name : 'Unknown',
                });
                return unavailableMapResponse(unavailableMapSvg);
            }
        });
    }

    return { GET };
}
