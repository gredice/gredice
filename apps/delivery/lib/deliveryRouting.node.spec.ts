import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DeliveryRoutePlanningError,
    estimateDeliveryRoute,
    formatDeliveryDestinationAddress,
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
