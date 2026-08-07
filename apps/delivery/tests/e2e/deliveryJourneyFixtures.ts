import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryRequestSummary,
    DriverDeliveryDashboard,
} from '../../lib/deliveryDashboardTypes';

const transparentMap =
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function isoAt(timestamp: number) {
    return new Date(timestamp).toISOString();
}

const tomatoHarvest = {
    plantName: 'Rajčica Roma',
    operationName: 'Berba',
    raisedBedName: 'Gredica A',
    fieldName: 'Polje 1',
    tracePath: '/trag/tomato-quality-4146',
};

const basilHarvest = {
    ...tomatoHarvest,
    plantName: 'Bosiljak Genovese',
    raisedBedName: 'Gredica B',
    tracePath: '/trag/basil-quality-4146',
};

function driverUser(role: 'admin' | 'driver') {
    return {
        id: `${role}-quality-4146`,
        displayName: role === 'admin' ? 'Admin Dostavljač' : 'Vozač Dostavljač',
        role,
    };
}

export function driverPlanningDashboard(
    role: 'admin' | 'driver' = 'admin',
): DriverDeliveryDashboard {
    const now = Date.now();
    const stopKey = 'zagreb-ilica-42-slot-4146';
    return {
        kind: 'driver',
        user: driverUser(role),
        activeRun: null,
        batches: [
            {
                slotId: 4146,
                startAt: isoAt(now - 30 * 60_000),
                endAt: isoAt(now + 90 * 60_000),
                pickupLocationId: 1,
                pickupLocationName: 'Gredice HQ',
                pickupAddress: 'Ulica Julija Knifera 3, Zagreb',
                deliveryCount: 3,
                stopCount: 1,
                orders: [
                    {
                        requestId: 'request-tomato-quality-4146',
                        stopKey,
                        readyForPickup: true,
                        pickupStatusLabel: 'Spremno',
                        contactName: 'Ana Anić',
                        address: 'Ilica 42, Zagreb',
                        addressLabel: 'Dvorišni ulaz',
                        requestNotes: 'Pozvoni dva puta.',
                        harvest: tomatoHarvest,
                    },
                    {
                        requestId: 'request-basil-quality-4146',
                        stopKey,
                        readyForPickup: true,
                        pickupStatusLabel: 'Spremno',
                        contactName: 'Ana Anić',
                        address: 'Ilica 42, Zagreb',
                        addressLabel: 'Dvorišni ulaz',
                        requestNotes: null,
                        harvest: basilHarvest,
                    },
                    {
                        requestId: 'request-lettuce-quality-4146',
                        stopKey,
                        readyForPickup: false,
                        pickupStatusLabel: 'Još nije spremno',
                        contactName: 'Ana Anić',
                        address: 'Ilica 42, Zagreb',
                        addressLabel: 'Dvorišni ulaz',
                        requestNotes: null,
                        harvest: {
                            ...tomatoHarvest,
                            plantName: 'Salata puterica',
                            raisedBedName: 'Gredica C',
                            tracePath: '/trag/lettuce-quality-4146',
                        },
                    },
                ],
            },
        ],
        maximumRouteStops: 24,
        maximumRouteWindowHours: 12,
        refreshedAt: isoAt(now),
    };
}

export function driverActiveDashboard(
    role: 'admin' | 'driver' = 'admin',
): DriverDeliveryDashboard {
    const now = Date.now();
    const deliveries = [
        {
            stopId: 101,
            stopState: 'arrived',
            requestId: 'request-tomato-quality-4146',
            requestState: 'in_delivery',
            contactName: 'Ana Anić',
            phone: '+385 91 111 1111',
            addressLabel: 'Dvorišni ulaz',
            requestNotes: 'Pozvoni dva puta.',
            deliveryNotes: null,
            harvest: tomatoHarvest,
            exception: null,
        },
        {
            stopId: 102,
            stopState: 'arrived',
            requestId: 'request-basil-quality-4146',
            requestState: 'in_delivery',
            contactName: 'Ana Anić',
            phone: '+385 91 111 1111',
            addressLabel: 'Dvorišni ulaz',
            requestNotes: null,
            deliveryNotes: null,
            harvest: basilHarvest,
            exception: null,
        },
    ];
    const stop = {
        id: 101,
        requestId: deliveries[0].requestId,
        sequence: 1,
        stopState: 'arrived',
        requestState: 'in_delivery',
        statusLabel: 'Vozač je stigao',
        isCurrent: true,
        contactName: 'Ana Anić',
        phone: '+385 91 111 1111',
        address: 'Ilica 42, Zagreb',
        addressLabel: 'Dvorišni ulaz',
        requestNotes: 'Pozvoni dva puta.',
        deliveryNotes: null,
        slotStartAt: isoAt(now - 30 * 60_000),
        slotEndAt: isoAt(now + 90 * 60_000),
        estimatedArrivalAt: isoAt(now + 5 * 60_000),
        estimatedTravelSeconds: 600,
        estimatedDistanceMeters: 3_200,
        reroutePending: false,
        arrivedAt: isoAt(now - 60_000),
        deliveredAt: null,
        harvest: tomatoHarvest,
        recovery: null,
        tracking: null,
        runId: 'run-quality-4146',
        deliveryCount: deliveries.length,
        recipientCount: 1,
        deliveries,
        actionState: 'current' as const,
        lockedReason: null,
    };
    return {
        kind: 'driver',
        user: driverUser(role),
        activeRun: {
            id: 'run-quality-4146',
            state: 'active',
            startedAt: isoAt(now - 15 * 60_000),
            completedAt: null,
            totalDistanceMeters: 3_200,
            totalDurationSeconds: 600,
            routePlanVersion: 1,
            routeRevision: 1,
            reroutePending: false,
            estimateSource: 'google',
            tracking: {
                status: 'unavailable',
                lastAcceptedAt: null,
                mapAvailable: false,
            },
            location: null,
            estimatesUpdatedAt: isoAt(now),
            mapUrl: transparentMap,
            deliveryCount: deliveries.length,
            stops: [stop],
            routeSteps: [
                {
                    kind: 'delivery',
                    itinerarySequence: 1,
                    retryLaneRank: null,
                    retryAttempt: 0,
                    actionState: 'current',
                    lockedReason: null,
                    stop,
                },
            ],
        },
        batches: [],
        maximumRouteStops: 24,
        maximumRouteWindowHours: 12,
        refreshedAt: isoAt(now),
    };
}

function customerDelivery({
    deliveredAt = null,
    lifecycle,
    map = false,
    now,
    plantName,
    requestId,
}: {
    deliveredAt?: string | null;
    lifecycle: CustomerDeliveryRequestSummary['lifecycle'];
    map?: boolean;
    now: number;
    plantName: string;
    requestId: string;
}): CustomerDeliveryRequestSummary {
    const active = lifecycle === 'active';
    const harvest = {
        ...tomatoHarvest,
        plantName,
        tracePath: `/trag/${requestId}`,
    };
    const slotStartAt = active
        ? isoAt(now - 30 * 60_000)
        : isoAt(now - 24 * 60 * 60_000);
    const slotEndAt = active
        ? isoAt(now + 90 * 60_000)
        : isoAt(now - 23 * 60 * 60_000);
    return {
        mode: 'delivery',
        lifecycle,
        requestId,
        status: active ? 'in_delivery' : 'fulfilled',
        statusLabel: active ? 'Vozač je stigao' : 'Dostavljeno',
        requestNotes: active ? 'Pozvoni dva puta.' : null,
        slotStartAt,
        slotEndAt,
        eta: active
            ? {
                  source: 'traffic-route',
                  calculatedAt: isoAt(now),
                  freshness: 'fresh',
                  confidence: 'high',
                  rangeStartAt: isoAt(now),
                  rangeEndAt: isoAt(now + 10 * 60_000),
                  remainingMinSeconds: 0,
                  remainingMaxSeconds: 600,
              }
            : {
                  source: 'promised-window',
                  calculatedAt: null,
                  freshness: 'unavailable',
                  confidence: 'none',
                  rangeStartAt: null,
                  rangeEndAt: null,
                  remainingMinSeconds: null,
                  remainingMaxSeconds: null,
              },
        progress: {
            phase: active ? 'arrived' : 'unavailable',
            stopsAhead: active ? 0 : null,
            delayed: false,
        },
        deliveredAt,
        harvest,
        destination: {
            recipientName: 'Korisnik Korina',
            address: 'Ilica 42, Zagreb',
            addressLabel: 'Dom',
        },
        receipt: deliveredAt
            ? {
                  requestReference: requestId,
                  deliveredAt,
                  verification: 'verified',
                  harvest,
              }
            : null,
        recovery: null,
        tracking: map
            ? {
                  status: 'live',
                  lastAcceptedAt: isoAt(now),
                  mapAvailable: true,
                  exactLocationExpiresInMs: 110_000,
              }
            : null,
        mapPath: map ? '/api/map/run-customer-quality-4146' : null,
    };
}

export function customerJourneyDashboard(): CustomerDeliveryDashboard {
    const now = Date.now();
    const history = Array.from({ length: 7 }, (_, index) =>
        customerDelivery({
            deliveredAt: isoAt(now - (index + 1) * 24 * 60 * 60_000),
            lifecycle: 'history',
            now,
            plantName: `Dostavljeni urod ${index + 1}`,
            requestId: `history-quality-4146-${index + 1}`,
        }),
    );
    return {
        kind: 'customer',
        user: {
            id: 'user-quality-4146',
            displayName: 'Korisnik Korina',
            role: 'user',
        },
        deliveries: [
            customerDelivery({
                lifecycle: 'active',
                map: true,
                now,
                plantName: 'Aktivna rajčica',
                requestId: 'active-quality-4146',
            }),
            ...history,
        ],
        refreshedAt: isoAt(now),
    };
}
