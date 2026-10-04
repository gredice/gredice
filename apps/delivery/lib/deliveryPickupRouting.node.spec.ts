import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
    deliveryRerouteOriginNodeKey,
    planPickupAwareDeliveryRoute,
    type RemainingDeliveryRouteNode,
    recalculatePickupAwareDeliveryRoute,
    refreshFixedPickupAwareDeliveryRoute,
} from './deliveryPickupRouting';
import { DeliveryRoutePlanningError } from './deliveryRouting';

type Coordinates = {
    latitude: number;
    longitude: number;
};

type GoogleMockOptions = {
    zeroResultAddresses?: ReadonlySet<string>;
    failMatrix?: boolean;
    failFinalRoute?: boolean;
    matrixElementFailure?: 'internal' | 'malformed';
    finalRouteDurationSeconds?: number;
};

const departureTime = new Date('2026-07-15T06:00:00.000Z');
const broadWindow = {
    windowStartAt: new Date('2026-07-15T06:00:00.000Z'),
    windowEndAt: new Date('2026-07-15T20:00:00.000Z'),
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function arrayField(value: unknown, field: string) {
    if (!isRecord(value)) return [];
    const fieldValue = value[field];
    return Array.isArray(fieldValue) ? fieldValue : [];
}

async function requestJson(
    input: string | URL | Request,
    init?: RequestInit,
): Promise<unknown> {
    const body = init?.body;
    if (typeof body === 'string') {
        const parsed: unknown = JSON.parse(body);
        return parsed;
    }
    if (input instanceof Request) {
        const text = await input.clone().text();
        if (text) {
            const parsed: unknown = JSON.parse(text);
            return parsed;
        }
    }
    return null;
}

function requestUrl(input: string | URL | Request) {
    return new URL(
        typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url,
    );
}

function waypointCoordinates(value: unknown): Coordinates | null {
    if (!isRecord(value)) return null;
    const location = value.location;
    if (!isRecord(location)) return null;
    const latLng = location.latLng;
    if (!isRecord(latLng)) return null;
    const { latitude, longitude } = latLng;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return null;
    }
    return { latitude, longitude };
}

function installGoogleMock(
    context: TestContext,
    options: GoogleMockOptions = {},
) {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    const locationsByAddress = new Map<string, Coordinates>();
    const matrixBodies: unknown[] = [];
    const routeBodies: unknown[] = [];
    let fetchCount = 0;

    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'pickup-routing-test-key';
    globalThis.fetch = async (input, init) => {
        fetchCount += 1;
        const url = requestUrl(input);

        if (url.hostname === 'maps.googleapis.com') {
            const address = url.searchParams.get('address') ?? '';
            if (options.zeroResultAddresses?.has(address)) {
                return Response.json({ status: 'ZERO_RESULTS', results: [] });
            }
            let coordinates = locationsByAddress.get(address);
            if (!coordinates) {
                const offset = locationsByAddress.size + 1;
                coordinates = {
                    latitude: 45.75 + offset / 1_000,
                    longitude: 15.9 + offset / 1_000,
                };
                locationsByAddress.set(address, coordinates);
            }
            return Response.json({
                status: 'OK',
                results: [
                    {
                        geometry: {
                            location: {
                                lat: coordinates.latitude,
                                lng: coordinates.longitude,
                            },
                        },
                    },
                ],
            });
        }

        if (url.pathname.endsWith(':computeRouteMatrix')) {
            const body = await requestJson(input, init);
            matrixBodies.push(body);
            if (options.failMatrix) {
                return Response.json(
                    { error: { status: 'UNAVAILABLE' } },
                    { status: 503 },
                );
            }
            const origins = arrayField(body, 'origins');
            const destinations = arrayField(body, 'destinations');
            if (options.matrixElementFailure === 'internal') {
                return Response.json(
                    origins.flatMap((_origin, originIndex) =>
                        destinations.map((_destination, destinationIndex) => ({
                            originIndex,
                            destinationIndex,
                            condition: 'ROUTE_EXISTS',
                            status: { code: 13, message: 'INTERNAL' },
                        })),
                    ),
                );
            }
            if (options.matrixElementFailure === 'malformed') {
                return Response.json(
                    origins.flatMap((_origin, originIndex) =>
                        destinations.map((_destination, destinationIndex) => ({
                            originIndex,
                            destinationIndex,
                            condition: 'ROUTE_EXISTS',
                            status: {},
                        })),
                    ),
                );
            }
            return Response.json(
                origins.flatMap((_origin, originIndex) =>
                    destinations.map((_destination, destinationIndex) => ({
                        originIndex,
                        destinationIndex,
                        condition: 'ROUTE_EXISTS',
                        status: {},
                        distanceMeters:
                            originIndex === destinationIndex ? 0 : 1_000,
                        duration:
                            originIndex === destinationIndex ? '0s' : '60s',
                    })),
                ),
            );
        }

        if (url.pathname.endsWith(':computeRoutes')) {
            const body = await requestJson(input, init);
            routeBodies.push(body);
            if (options.failFinalRoute) {
                return Response.json(
                    { error: { status: 'UNAVAILABLE' } },
                    { status: 503 },
                );
            }
            const intermediateCount = arrayField(body, 'intermediates').length;
            const legCount = intermediateCount + 1;
            return Response.json({
                routes: [
                    {
                        distanceMeters: legCount * 1_000,
                        duration: `${legCount * 60}s`,
                        legs: Array.from({ length: legCount }, () => ({
                            distanceMeters: 1_000,
                            duration: `${options.finalRouteDurationSeconds ?? 60}s`,
                        })),
                        polyline: { encodedPolyline: 'pickup-aware-route' },
                    },
                ],
            });
        }

        return new Response(null, { status: 404 });
    };

    context.after(() => {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
        }
    });

    return {
        locationsByAddress,
        matrixBodies,
        routeBodies,
        fetchCount: () => fetchCount,
    };
}

function pickup(
    nodeKey: string,
    pickupLocationId = 1,
    formattedAddress = `${nodeKey} pickup address`,
) {
    return {
        nodeKey,
        pickupLocationId,
        formattedAddress,
    };
}

function customer(
    nodeKey: string,
    requiredPickupKey: string,
    deliveryRequestId = nodeKey,
    formattedAddress = `${nodeKey} customer address`,
) {
    return {
        nodeKey,
        requiredPickupKey,
        deliveryRequestId,
        formattedAddress,
        ...broadWindow,
    };
}

function itineraryKeys(plan: {
    itinerary: ReadonlyArray<{ nodeKey: string }>;
}) {
    return plan.itinerary.map((node) => node.nodeKey);
}

test('visits a required pickup before its dependent customer', async (t) => {
    installGoogleMock(t);
    const plan = await planPickupAwareDeliveryRoute({
        pickupCandidates: [pickup('pickup-origin'), pickup('pickup-second')],
        candidates: [
            customer('customer-second', 'pickup-second'),
            customer('customer-origin', 'pickup-origin'),
        ],
        departureTime,
        originPickupNodeKey: 'pickup-origin',
    });
    const keys = itineraryKeys(plan);

    assert.equal(plan.routePlanVersion, 2);
    assert.equal(plan.estimateSource, 'google');
    assert.ok(keys.indexOf('pickup-second') < keys.indexOf('customer-second'));
    assert.ok(keys.indexOf('pickup-origin') < keys.indexOf('customer-origin'));
    assert.equal(plan.pickupNodes.length, 2);
    assert.equal(plan.stops.length, 2);
});

test('plans two pickup locations and their delivery slots in one physical itinerary', async (t) => {
    installGoogleMock(t);
    const plan = await planPickupAwareDeliveryRoute({
        pickupCandidates: [
            pickup('location-a:slot-morning', 101),
            pickup('location-b:slot-afternoon', 102),
        ],
        candidates: [
            customer('customer-afternoon', 'location-b:slot-afternoon'),
            customer('customer-morning', 'location-a:slot-morning'),
        ],
        departureTime,
        originPickupNodeKey: 'location-a:slot-morning',
    });
    const keys = itineraryKeys(plan);

    assert.deepEqual(
        new Set(keys),
        new Set([
            'location-a:slot-morning',
            'location-b:slot-afternoon',
            'customer-morning',
            'customer-afternoon',
        ]),
    );
    assert.ok(
        keys.indexOf('location-b:slot-afternoon') <
            keys.indexOf('customer-afternoon'),
    );
    assert.ok(
        keys.indexOf('location-a:slot-morning') <
            keys.indexOf('customer-morning'),
    );
    assert.deepEqual(
        plan.itinerary.map((node) => node.itinerarySequence),
        [1, 2, 3, 4],
    );
    assert.ok(
        plan.totalDurationSeconds >=
            plan.itinerary.reduce(
                (total, node) =>
                    total +
                    node.estimatedTravelSeconds +
                    node.serviceDurationSeconds,
                0,
            ),
    );
});

test('chunks a 27-node matrix below 625 elements and fixes the final Google order', async (t) => {
    const google = installGoogleMock(t);
    const pickupCandidate = pickup('pickup-1');
    const candidates = Array.from({ length: 26 }, (_value, index) =>
        customer(`customer-${String(index + 1).padStart(2, '0')}`, 'pickup-1'),
    );
    const plan = await planPickupAwareDeliveryRoute({
        pickupCandidates: [pickupCandidate],
        candidates,
        departureTime,
        originPickupNodeKey: pickupCandidate.nodeKey,
    });

    assert.equal(plan.itinerary.length, 27);
    assert.equal(google.matrixBodies.length, 2);
    assert.deepEqual(
        google.matrixBodies.map((body) => arrayField(body, 'origins').length),
        [23, 4],
    );
    assert.deepEqual(
        google.matrixBodies.map(
            (body) => arrayField(body, 'destinations').length,
        ),
        [27, 27],
    );
    for (const body of google.matrixBodies) {
        assert.ok(
            arrayField(body, 'origins').length *
                arrayField(body, 'destinations').length <=
                625,
        );
    }

    assert.equal(google.routeBodies.length, 1);
    const finalRequest = google.routeBodies[0];
    assert.ok(isRecord(finalRequest));
    assert.equal(finalRequest.optimizeWaypointOrder, false);
    const requestedWaypoints = [
        finalRequest.origin,
        ...arrayField(finalRequest, 'intermediates'),
        finalRequest.destination,
    ].map(waypointCoordinates);
    const coordinatesByNodeKey = new Map<string, Coordinates>([
        [
            pickupCandidate.nodeKey,
            google.locationsByAddress.get(pickupCandidate.formattedAddress) ?? {
                latitude: 0,
                longitude: 0,
            },
        ],
        ...candidates.map((candidate): [string, Coordinates] => [
            candidate.nodeKey,
            google.locationsByAddress.get(candidate.formattedAddress) ?? {
                latitude: 0,
                longitude: 0,
            },
        ]),
    ]);
    assert.deepEqual(
        requestedWaypoints,
        itineraryKeys(plan).map(
            (nodeKey) => coordinatesByNodeKey.get(nodeKey) ?? null,
        ),
    );
});

test('reruns the whole route locally when the final Google route fails', async (t) => {
    const originalWarn = console.warn;
    console.warn = () => undefined;
    t.after(() => {
        console.warn = originalWarn;
    });
    installGoogleMock(t, { failFinalRoute: true });
    const plan = await planPickupAwareDeliveryRoute({
        pickupCandidates: [pickup('pickup-origin'), pickup('pickup-required')],
        candidates: [customer('customer-required', 'pickup-required')],
        departureTime,
        originPickupNodeKey: 'pickup-origin',
    });
    const keys = itineraryKeys(plan);

    assert.equal(plan.estimateSource, 'local');
    assert.equal(plan.encodedPolyline, undefined);
    assert.ok(
        keys.indexOf('pickup-required') < keys.indexOf('customer-required'),
    );
    assert.ok(plan.totalDistanceMeters > 0);
    assert.ok(plan.totalDurationSeconds > 0);
});

test('uses local fallback for HTTP-200 matrix element failures', async (t) => {
    for (const matrixElementFailure of ['internal', 'malformed'] as const) {
        await t.test(matrixElementFailure, async (t) => {
            const originalWarn = console.warn;
            console.warn = () => undefined;
            t.after(() => {
                console.warn = originalWarn;
            });
            const google = installGoogleMock(t, { matrixElementFailure });

            const plan = await planPickupAwareDeliveryRoute({
                pickupCandidates: [pickup(`pickup-${matrixElementFailure}`)],
                candidates: [
                    customer(
                        `customer-${matrixElementFailure}`,
                        `pickup-${matrixElementFailure}`,
                    ),
                ],
                departureTime,
            });

            assert.equal(plan.estimateSource, 'local');
            assert.equal(plan.encodedPolyline, undefined);
            assert.equal(google.matrixBodies.length, 1);
            assert.equal(google.routeBodies.length, 0);
        });
    }
});

test('accepts 27 physical nodes but rejects the 28th before making requests', async (t) => {
    const google = installGoogleMock(t);
    const accepted = await planPickupAwareDeliveryRoute({
        pickupCandidates: [pickup('pickup-accepted')],
        candidates: Array.from({ length: 26 }, (_value, index) =>
            customer(`accepted-${index}`, 'pickup-accepted'),
        ),
        departureTime,
    });
    assert.equal(accepted.itinerary.length, 27);

    const callsBeforeRejectedPlan = google.fetchCount();
    await assert.rejects(
        planPickupAwareDeliveryRoute({
            pickupCandidates: [pickup('pickup-rejected')],
            candidates: Array.from({ length: 27 }, (_value, index) =>
                customer(`rejected-${index}`, 'pickup-rejected'),
            ),
            departureTime,
        }),
        (error: unknown) => {
            assert.ok(error instanceof DeliveryRoutePlanningError);
            assert.equal(error.code, 'route-stop-limit-exceeded');
            return true;
        },
    );
    assert.equal(google.fetchCount(), callsBeforeRejectedPlan);
});

test('distinguishes pickup and delivery addresses that cannot be geocoded', async (t) => {
    installGoogleMock(t, {
        zeroResultAddresses: new Set(['missing pickup', 'missing customer']),
    });

    await assert.rejects(
        planPickupAwareDeliveryRoute({
            pickupCandidates: [pickup('missing-pickup', 999, 'missing pickup')],
            candidates: [customer('customer-ok', 'missing-pickup')],
            departureTime,
        }),
        (error: unknown) => {
            assert.ok(error instanceof DeliveryRoutePlanningError);
            assert.equal(error.code, 'pickup-address-not-found');
            assert.equal(error.nodeKey, 'missing-pickup');
            return true;
        },
    );

    await assert.rejects(
        planPickupAwareDeliveryRoute({
            pickupCandidates: [pickup('pickup-ok')],
            candidates: [
                customer(
                    'missing-customer',
                    'pickup-ok',
                    'delivery-missing',
                    'missing customer',
                ),
            ],
            departureTime,
        }),
        (error: unknown) => {
            assert.ok(error instanceof DeliveryRoutePlanningError);
            assert.equal(error.code, 'delivery-address-not-found');
            assert.equal(error.deliveryRequestId, 'delivery-missing');
            assert.equal(error.nodeKey, 'missing-customer');
            return true;
        },
    );
});

test('reports a deterministic split candidate for an infeasible window', async (t) => {
    installGoogleMock(t);
    const impossible = {
        ...customer('customer-impossible', 'pickup-origin', 'delivery-split'),
        windowStartAt: new Date('2026-07-15T05:00:00.000Z'),
        windowEndAt: new Date('2026-07-15T06:00:30.000Z'),
    };
    const possible = customer(
        'customer-possible',
        'pickup-origin',
        'delivery-keep',
    );

    for (const candidates of [
        [possible, impossible],
        [impossible, possible],
    ]) {
        await assert.rejects(
            planPickupAwareDeliveryRoute({
                pickupCandidates: [pickup('pickup-origin')],
                candidates,
                departureTime,
            }),
            (error: unknown) => {
                assert.ok(error instanceof DeliveryRoutePlanningError);
                assert.equal(error.code, 'route-time-window-infeasible');
                assert.equal(error.deliveryRequestId, 'delivery-split');
                assert.equal(error.nodeKey, 'customer-impossible');
                return true;
            },
        );
    }
});

test('keeps one upstream bulk group as one customer node', async (t) => {
    installGoogleMock(t);
    const plan = await planPickupAwareDeliveryRoute({
        pickupCandidates: [pickup('pickup-bulk')],
        candidates: [
            customer('bulk-address-and-slot', 'pickup-bulk', 'bulk-request'),
        ],
        departureTime,
    });

    assert.equal(plan.pickupNodes.length, 1);
    assert.equal(plan.stops.length, 1);
    assert.deepEqual(itineraryKeys(plan), [
        'pickup-bulk',
        'bulk-address-and-slot',
    ]);
    assert.equal(plan.pickupNodes[0]?.serviceDurationSeconds, 10 * 60);
    assert.equal(plan.stops[0]?.serviceDurationSeconds, 5 * 60);
    assert.ok(plan.totalDurationSeconds >= 10 * 60 + 60 + 5 * 60);
});

function remainingCustomer(
    index: number,
    overrides: Partial<
        Extract<RemainingDeliveryRouteNode, { kind: 'customer' }>
    > = {},
): Extract<RemainingDeliveryRouteNode, { kind: 'customer' }> {
    const nodeKey = `remaining-${String(index).padStart(2, '0')}`;
    return {
        kind: 'customer',
        nodeKey,
        formattedAddress: `${nodeKey} address`,
        deliveryRequestId: `request-${index}`,
        requiredPickupKey: deliveryRerouteOriginNodeKey,
        latitude: 45.75 + index / 10_000,
        longitude: 15.9 + index / 10_000,
        serviceDurationSeconds: 0,
        ...overrides,
    };
}

test('refreshes live ETAs without reordering the accepted pickup-aware itinerary', async (t) => {
    const google = installGoogleMock(t);
    const nodes: RemainingDeliveryRouteNode[] = [
        {
            kind: 'pickup',
            nodeKey: 'persisted-pickup',
            formattedAddress: 'Persisted pickup',
            latitude: 45.9,
            longitude: 16.1,
            serviceDurationSeconds: 120,
        },
        {
            ...remainingCustomer(1),
            nodeKey: 'persisted-delivery',
            requiredPickupKey: 'persisted-pickup',
            latitude: 45.91,
            longitude: 16.11,
            windowEndAt: new Date(departureTime.getTime() - 60_000),
        },
        {
            ...remainingCustomer(2),
            nodeKey: 'nearby-but-later',
            latitude: 45.7501,
            longitude: 15.9001,
        },
    ];

    const plan = await refreshFixedPickupAwareDeliveryRoute({
        origin: { latitude: 45.75, longitude: 15.9 },
        nodes,
        departureTime,
    });

    assert.equal(plan.estimateSource, 'google');
    assert.deepEqual(
        plan.visits.map((visit) => visit.nodeKey),
        nodes.map((node) => node.nodeKey),
    );
    assert.equal(google.matrixBodies.length, 0);
    assert.equal(google.routeBodies.length, 1);
    const [routeBody] = google.routeBodies;
    assert.ok(isRecord(routeBody));
    assert.equal(routeBody.optimizeWaypointOrder, false);
});

test('reuses one Google matrix while selectively relaxing many overdue reroute windows', async (t) => {
    const google = installGoogleMock(t);
    const nodes = Array.from({ length: 25 }, (_value, index) =>
        remainingCustomer(index, {
            windowEndAt: new Date(departureTime.getTime() - 60_000),
        }),
    );

    const plan = await recalculatePickupAwareDeliveryRoute({
        origin: { latitude: 45.75, longitude: 15.9 },
        nodes,
        departureTime,
    });

    assert.equal(plan.estimateSource, 'google');
    assert.equal(plan.visits.length, nodes.length);
    assert.equal(google.matrixBodies.length, 2);
    assert.equal(google.routeBodies.length, 1);
    assert.equal(google.fetchCount(), 3);
});

test('keeps feasible reroute deadlines while relaxing only an overdue stop', async (t) => {
    installGoogleMock(t);
    const plan = await recalculatePickupAwareDeliveryRoute({
        origin: { latitude: 45.75, longitude: 15.9 },
        nodes: [
            remainingCustomer(1, {
                nodeKey: 'customer-a-overdue',
                windowEndAt: new Date(departureTime.getTime() - 60_000),
            }),
            remainingCustomer(2, {
                nodeKey: 'customer-z-deadline',
                windowEndAt: new Date(departureTime.getTime() + 90_000),
            }),
        ],
        departureTime,
    });

    assert.deepEqual(
        plan.visits.map((visit) => visit.nodeKey),
        ['customer-z-deadline', 'customer-a-overdue'],
    );
});

test('uses linear Google connectors and preserves a large fixed retry route', async (t) => {
    const google = installGoogleMock(t);
    const nodes = Array.from({ length: 55 }, (_value, index) =>
        remainingCustomer(index, { retryLaneRank: index + 1 }),
    );

    const plan = await recalculatePickupAwareDeliveryRoute({
        origin: { latitude: 45.75, longitude: 15.9 },
        nodes,
        departureTime,
    });

    assert.equal(plan.estimateSource, 'google');
    assert.equal(plan.encodedPolyline, undefined);
    assert.deepEqual(
        plan.visits.map((visit) => visit.nodeKey),
        nodes.map((node) => node.nodeKey),
    );
    assert.equal(google.matrixBodies.length, 0);
    assert.equal(google.routeBodies.length, 3);
    assert.equal(google.fetchCount(), 3);
    assert.equal(
        google.routeBodies.reduce<number>(
            (total, body) =>
                total + arrayField(body, 'intermediates').length + 1,
            0,
        ),
        54,
    );
    assert.equal(plan.visits[0]?.incomingTravelSeconds, 0);
    for (const body of google.routeBodies) {
        assert.ok(arrayField(body, 'intermediates').length <= 25);
    }
    const segmentDepartures = google.routeBodies.map((body) => {
        assert.ok(isRecord(body));
        assert.equal(typeof body.departureTime, 'string');
        return Date.parse(String(body.departureTime));
    });
    assert.ok(
        segmentDepartures.every(
            (value, index) =>
                index === 0 || value > (segmentDepartures[index - 1] ?? value),
        ),
    );
});

test('softens every deadline missed by final Google legs without request fan-out', async (t) => {
    const google = installGoogleMock(t, {
        finalRouteDurationSeconds: 300,
    });
    const deadline = new Date(departureTime.getTime() + 4 * 60_000);
    const plan = await recalculatePickupAwareDeliveryRoute({
        origin: { latitude: 45.75, longitude: 15.9 },
        nodes: Array.from({ length: 3 }, (_value, index) =>
            remainingCustomer(index + 1, { windowEndAt: deadline }),
        ),
        departureTime,
    });

    assert.equal(plan.estimateSource, 'google');
    assert.equal(plan.visits.length, 3);
    assert.ok(
        plan.visits.every(
            (visit) => visit.estimatedArrivalAt.getTime() > deadline.getTime(),
        ),
    );
    assert.equal(google.matrixBodies.length, 1);
    assert.equal(google.routeBodies.length, 1);
    assert.equal(google.fetchCount(), 2);
});

test('keeps final Google deadlines strict when planning a new route', async (t) => {
    const google = installGoogleMock(t, {
        finalRouteDurationSeconds: 300,
    });
    await assert.rejects(
        planPickupAwareDeliveryRoute({
            pickupCandidates: [pickup('strict-window-pickup')],
            candidates: [
                {
                    ...customer(
                        'strict-window-customer',
                        'strict-window-pickup',
                    ),
                    windowEndAt: new Date(
                        departureTime.getTime() + 12 * 60_000,
                    ),
                },
            ],
            departureTime,
        }),
        (error: unknown) => {
            assert.ok(error instanceof DeliveryRoutePlanningError);
            assert.equal(error.code, 'route-time-window-infeasible');
            assert.equal(error.nodeKey, 'strict-window-customer');
            return true;
        },
    );
    assert.equal(google.matrixBodies.length, 1);
    assert.equal(google.routeBodies.length, 1);
});
