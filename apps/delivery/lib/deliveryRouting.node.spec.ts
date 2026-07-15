import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildGoogleGeocodingUrl,
    DeliveryRoutePlanningError,
    estimateDeliveryRoute,
    formatDeliveryDestinationAddress,
    formatDeliveryGeocodingAddress,
    haversineDistanceMeters,
    nearestNeighborStopOrder,
    orderDeliveryStopsByTimeWindow,
    planDeliveryRoute,
} from './deliveryRouting';

test('formats a Croatian delivery address without empty lines', () => {
    assert.equal(
        formatDeliveryDestinationAddress({
            street1: 'Ilica 1',
            street2: null,
            postalCode: '10000',
            city: 'Zagreb',
            countryCode: 'HR',
        }),
        'Ilica 1, 10000 Zagreb, HR',
    );
});

test('keeps address details for display but omits them from geocoding', () => {
    const address = {
        street1: 'Ilica 1',
        street2: '2. kat',
        postalCode: '10000',
        city: 'Zagreb',
        countryCode: 'HR',
    };

    assert.equal(
        formatDeliveryDestinationAddress(address),
        'Ilica 1, 2. kat, 10000 Zagreb, HR',
    );
    assert.equal(
        formatDeliveryGeocodingAddress(address),
        'Ilica 1, 10000 Zagreb, HR',
    );
});

test('geocoding uses a Croatian region bias without a duplicate country filter', () => {
    const url = buildGoogleGeocodingUrl(
        'Ilica 1, 10000 Zagreb, HR',
        'test-key',
    );

    assert.equal(url.searchParams.get('address'), 'Ilica 1, 10000 Zagreb, HR');
    assert.equal(url.searchParams.get('language'), 'hr');
    assert.equal(url.searchParams.get('region'), 'hr');
    assert.equal(url.searchParams.get('components'), null);
});

test('route planning retries the display address when the simplified address is not found', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    const originalHqAddress = process.env.GREDICE_DELIVERY_HQ_ADDRESS;
    const geocodingQueries: string[] = [];
    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    process.env.GREDICE_DELIVERY_HQ_ADDRESS =
        'Ulica Julija Knifera 3, 10000 Zagreb, HR';
    globalThis.fetch = async (input) => {
        const url = new URL(
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url,
        );
        if (url.hostname === 'maps.googleapis.com') {
            const address = url.searchParams.get('address') ?? '';
            geocodingQueries.push(address);
            if (address === 'Ilica 1, 10000 Zagreb, HR') {
                return Response.json({ status: 'ZERO_RESULTS', results: [] });
            }
            const location = address.startsWith('Ilica')
                ? { lat: 45.813, lng: 15.977 }
                : { lat: 45.776, lng: 15.963 };
            return Response.json({
                status: 'OK',
                results: [{ geometry: { location } }],
            });
        }
        if (url.hostname === 'routes.googleapis.com') {
            return Response.json({
                routes: [
                    {
                        distanceMeters: 1_000,
                        duration: '600s',
                        legs: [{ distanceMeters: 1_000, duration: '600s' }],
                        polyline: { encodedPolyline: 'encoded' },
                    },
                ],
            });
        }
        return new Response(null, { status: 404 });
    };

    try {
        const plan = await planDeliveryRoute({
            candidates: [
                {
                    deliveryRequestId: 'delivery-1',
                    formattedAddress: 'Ilica 1, 2. kat, 10000 Zagreb, HR',
                    geocodingAddress: 'Ilica 1, 10000 Zagreb, HR',
                    windowStartAt: new Date('2026-07-14T08:00:00.000Z'),
                    windowEndAt: new Date('2026-07-14T10:00:00.000Z'),
                },
            ],
            departureTime: new Date('2026-07-14T07:30:00.000Z'),
        });

        assert.equal(
            plan.stops[0]?.formattedAddress,
            'Ilica 1, 2. kat, 10000 Zagreb, HR',
        );
        assert.deepEqual(
            new Set(geocodingQueries),
            new Set([
                'Ulica Julija Knifera 3, 10000 Zagreb, HR',
                'Ilica 1, 10000 Zagreb, HR',
                'Ilica 1, 2. kat, 10000 Zagreb, HR',
            ]),
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
        }
        if (originalHqAddress === undefined) {
            delete process.env.GREDICE_DELIVERY_HQ_ADDRESS;
        } else {
            process.env.GREDICE_DELIVERY_HQ_ADDRESS = originalHqAddress;
        }
    }
});

test('falls back to a local route estimate when Google Routes is unavailable', async () => {
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    const originalHqAddress = process.env.GREDICE_DELIVERY_HQ_ADDRESS;
    let routesRequestCount = 0;
    let fallbackWarningCount = 0;
    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    process.env.GREDICE_DELIVERY_HQ_ADDRESS =
        'Ulica Julija Knifera 3, 10000 Zagreb, HR';
    globalThis.fetch = async (input) => {
        const url = new URL(
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url,
        );
        if (url.hostname === 'maps.googleapis.com') {
            const address = url.searchParams.get('address') ?? '';
            const location = address.startsWith('Ilica')
                ? { lat: 45.813, lng: 15.977 }
                : { lat: 45.776, lng: 15.963 };
            return Response.json({
                status: 'OK',
                results: [{ geometry: { location } }],
            });
        }
        if (url.hostname === 'routes.googleapis.com') {
            routesRequestCount += 1;
            return Response.json(
                { error: { status: 'UNAVAILABLE' } },
                { status: 503 },
            );
        }
        return new Response(null, { status: 404 });
    };
    console.warn = (message) => {
        if (
            message === 'Google route optimization failed; using local fallback'
        ) {
            fallbackWarningCount += 1;
        }
    };

    try {
        const plan = await planDeliveryRoute({
            candidates: [
                {
                    deliveryRequestId: 'delivery-1',
                    formattedAddress: 'Ilica 1, 10000 Zagreb, HR',
                    windowStartAt: new Date('2026-07-14T08:00:00.000Z'),
                    windowEndAt: new Date('2026-07-14T10:00:00.000Z'),
                },
            ],
            departureTime: new Date('2026-07-14T07:30:00.000Z'),
        });

        assert.equal(routesRequestCount, 1);
        assert.equal(fallbackWarningCount, 1);
        assert.equal(plan.encodedPolyline, undefined);
        assert.ok(plan.totalDistanceMeters > 0);
        assert.equal(plan.stops[0]?.deliveryRequestId, 'delivery-1');
        assert.equal(
            plan.stops[0]?.estimatedArrivalAt.toISOString(),
            '2026-07-14T08:00:00.000Z',
        );
    } finally {
        globalThis.fetch = originalFetch;
        console.warn = originalWarn;
        if (originalApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
        }
        if (originalHqAddress === undefined) {
            delete process.env.GREDICE_DELIVERY_HQ_ADDRESS;
        } else {
            process.env.GREDICE_DELIVERY_HQ_ADDRESS = originalHqAddress;
        }
    }
});

test('reports a server key restriction without exposing Google error details', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    const originalHqAddress = process.env.GREDICE_DELIVERY_HQ_ADDRESS;
    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'restricted-key';
    process.env.GREDICE_DELIVERY_HQ_ADDRESS =
        'Ulica Julija Knifera 3, 10000 Zagreb, HR';
    globalThis.fetch = async () =>
        Response.json({
            status: 'REQUEST_DENIED',
            error_message: 'API key restriction details',
            results: [],
        });

    try {
        await assert.rejects(
            planDeliveryRoute({
                candidates: [
                    {
                        deliveryRequestId: 'delivery-1',
                        formattedAddress: 'Ilica 1, 10000 Zagreb, HR',
                        windowStartAt: new Date('2026-07-14T08:00:00.000Z'),
                        windowEndAt: new Date('2026-07-14T10:00:00.000Z'),
                    },
                ],
                departureTime: new Date('2026-07-14T07:30:00.000Z'),
            }),
            (error: unknown) => {
                assert.ok(error instanceof DeliveryRoutePlanningError);
                assert.equal(error.code, 'google-geocoding-request-denied');
                assert.equal(
                    error.message,
                    'Google Maps trenutačno nije mogao provjeriti adrese dostave. Obrati se administratoru.',
                );
                assert.doesNotMatch(error.message, /restriction details/);
                return true;
            },
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
        }
        if (originalHqAddress === undefined) {
            delete process.env.GREDICE_DELIVERY_HQ_ADDRESS;
        } else {
            process.env.GREDICE_DELIVERY_HQ_ADDRESS = originalHqAddress;
        }
    }
});

test('orders the closest remaining delivery stop first', () => {
    const origin = { latitude: 45.78, longitude: 15.98 };
    const stops = [
        {
            deliveryRequestId: 'far',
            formattedAddress: 'Far',
            latitude: 45.9,
            longitude: 16.1,
        },
        {
            deliveryRequestId: 'near',
            formattedAddress: 'Near',
            latitude: 45.781,
            longitude: 15.981,
        },
    ];

    assert.deepEqual(
        nearestNeighborStopOrder(origin, stops).map(
            (stop) => stop.deliveryRequestId,
        ),
        ['near', 'far'],
    );
});

test('haversine distance returns a stable non-zero city distance', () => {
    const distance = haversineDistanceMeters(
        { latitude: 45.78, longitude: 15.98 },
        { latitude: 45.8, longitude: 16.0 },
    );

    assert.ok(distance > 2_000);
    assert.ok(distance < 4_000);
});

test('orders earlier delivery windows first and optimizes within a window', () => {
    const origin = { latitude: 45.78, longitude: 15.98 };
    const earlyWindow = {
        windowStartAt: new Date('2026-07-13T08:00:00.000Z'),
        windowEndAt: new Date('2026-07-13T09:00:00.000Z'),
    };
    const laterWindow = {
        windowStartAt: new Date('2026-07-13T10:00:00.000Z'),
        windowEndAt: new Date('2026-07-13T11:00:00.000Z'),
    };

    const ordered = orderDeliveryStopsByTimeWindow(
        origin,
        [
            {
                deliveryRequestId: 'later',
                formattedAddress: 'Later',
                latitude: 45.7805,
                longitude: 15.9805,
                ...laterWindow,
            },
            {
                deliveryRequestId: 'early-far',
                formattedAddress: 'Early far',
                latitude: 45.82,
                longitude: 16.02,
                ...earlyWindow,
            },
            {
                deliveryRequestId: 'early-near',
                formattedAddress: 'Early near',
                latitude: 45.781,
                longitude: 15.981,
                ...earlyWindow,
            },
        ],
        new Date('2026-07-13T07:55:00.000Z'),
    );

    assert.deepEqual(
        ordered.map((stop) => stop.deliveryRequestId),
        ['early-near', 'early-far', 'later'],
    );
});

test('serves an available stop before waiting for an overlapping window', () => {
    const origin = { latitude: 45.78, longitude: 15.98 };
    const departureTime = new Date('2026-07-13T08:00:00.000Z');
    const futureNarrowStop = {
        deliveryRequestId: 'future-narrow',
        formattedAddress: 'Future narrow',
        latitude: 45.781,
        longitude: 15.981,
        windowStartAt: new Date('2026-07-13T09:00:00.000Z'),
        windowEndAt: new Date('2026-07-13T09:04:00.000Z'),
    };
    const availableStop = {
        deliveryRequestId: 'available-now',
        formattedAddress: 'Available now',
        latitude: 45.7805,
        longitude: 15.9805,
        windowStartAt: new Date('2026-07-13T08:00:00.000Z'),
        windowEndAt: new Date('2026-07-13T09:05:00.000Z'),
    };
    const ordered = orderDeliveryStopsByTimeWindow(
        origin,
        [futureNarrowStop, availableStop],
        departureTime,
    );

    assert.deepEqual(
        ordered.map((stop) => stop.deliveryRequestId),
        ['available-now', 'future-narrow'],
    );
    assert.throws(
        () =>
            estimateDeliveryRoute({
                origin,
                stops: [futureNarrowStop, availableStop],
                departureTime,
                optimize: false,
            }),
        DeliveryRoutePlanningError,
    );
    assert.doesNotThrow(() =>
        estimateDeliveryRoute({
            origin,
            stops: ordered,
            departureTime,
            optimize: false,
        }),
    );
});

test('waits for a future delivery window and rejects an expired one', () => {
    const origin = { latitude: 45.78, longitude: 15.98 };
    const stop = {
        deliveryRequestId: 'scheduled',
        formattedAddress: 'Scheduled',
        latitude: 45.781,
        longitude: 15.981,
        windowStartAt: new Date('2026-07-13T09:00:00.000Z'),
        windowEndAt: new Date('2026-07-13T10:00:00.000Z'),
    };
    const plan = estimateDeliveryRoute({
        origin,
        stops: [stop],
        departureTime: new Date('2026-07-13T08:00:00.000Z'),
        optimize: false,
    });

    assert.equal(
        plan.stops[0]?.estimatedArrivalAt.toISOString(),
        '2026-07-13T09:00:00.000Z',
    );
    assert.throws(
        () =>
            estimateDeliveryRoute({
                origin,
                stops: [stop],
                departureTime: new Date('2026-07-13T10:01:00.000Z'),
                optimize: false,
            }),
        DeliveryRoutePlanningError,
    );
});

test('rejects selected time windows that span more than one route day', async () => {
    await assert.rejects(
        planDeliveryRoute({
            candidates: [
                {
                    deliveryRequestId: 'first',
                    formattedAddress: 'First',
                    windowStartAt: new Date('2026-07-13T08:00:00.000Z'),
                    windowEndAt: new Date('2026-07-13T10:00:00.000Z'),
                },
                {
                    deliveryRequestId: 'second',
                    formattedAddress: 'Second',
                    windowStartAt: new Date('2026-07-14T10:00:01.000Z'),
                    windowEndAt: new Date('2026-07-14T12:00:01.000Z'),
                },
            ],
        }),
        DeliveryRoutePlanningError,
    );
});
