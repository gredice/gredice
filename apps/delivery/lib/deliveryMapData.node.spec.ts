import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDeliveryMapData,
    customerCurrentDeliveryMapStops,
    decodeDeliveryMapPolyline,
    deliveryMapAudience,
    deliveryMapSelectionKey,
    deliveryMapStopGroupSelectionId,
    parseDeliveryMapData,
} from './deliveryMapData';

const driverLocation = { latitude: 45.801, longitude: 15.981 };
const pickupNodes = [
    { latitude: 45.79, longitude: 15.97, selectionId: 'pickup-node-1' },
];
const stops = [
    {
        latitude: 45.81,
        longitude: 16.01,
        sequence: 2,
        selectionId: '20',
    },
];

test('keeps the complete route data in the driver map projection', () => {
    assert.deepEqual(
        buildDeliveryMapData({
            driverLocation,
            pickupNodes,
            stops,
            encodedPolyline: 'private-route',
            customerView: false,
        }),
        {
            driverLocation,
            pickupNodes,
            stops,
            encodedPolyline: 'private-route',
        },
    );
});

test('removes pickup checkpoints and the complete route from customer map data', () => {
    assert.deepEqual(
        buildDeliveryMapData({
            driverLocation,
            pickupNodes,
            stops,
            encodedPolyline: 'private-route',
            customerView: true,
        }),
        {
            driverLocation,
            pickupNodes: [],
            stops: stops.map((stop) => ({ ...stop, selectionId: null })),
            encodedPolyline: null,
        },
    );
});

test('validates map data received by the interactive client', () => {
    assert.deepEqual(
        parseDeliveryMapData({
            driverLocation,
            pickupNodes,
            stops,
            encodedPolyline: null,
        }),
        { driverLocation, pickupNodes, stops, encodedPolyline: null },
    );
    assert.equal(
        parseDeliveryMapData({
            driverLocation: { latitude: 120, longitude: 15.981 },
            pickupNodes,
            stops,
            encodedPolyline: null,
        }),
        null,
    );
    assert.equal(
        parseDeliveryMapData({
            driverLocation,
            pickupNodes,
            stops: [
                {
                    latitude: 45.81,
                    longitude: 16.01,
                    sequence: 0,
                    selectionId: 'invalid-stop',
                },
            ],
            encodedPolyline: null,
        }),
        null,
    );
});

test('decodes Google encoded route polylines and rejects truncated input', () => {
    assert.deepEqual(decodeDeliveryMapPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
    ]);
    assert.deepEqual(decodeDeliveryMapPolyline('_p~i'), []);
});

test('uses stable pickup and delivery keys for map timeline selection', () => {
    assert.equal(deliveryMapSelectionKey(null), null);
    assert.equal(
        deliveryMapSelectionKey({ kind: 'pickup', id: 'pickup-node-1' }),
        'pickup:pickup-node-1',
    );
    assert.equal(
        deliveryMapSelectionKey({ kind: 'delivery', id: '40' }),
        'delivery:40',
    );
    assert.equal(deliveryMapStopGroupSelectionId([41, 40, 41]), '40');
    assert.equal(
        deliveryMapStopGroupSelectionId(
            Array.from({ length: 10_000 }, (_, index) => index + 1),
        ),
        '1',
    );
    assert.equal(deliveryMapStopGroupSelectionId([]), null);
});

test('customer map includes only the server-confirmed current physical stop', () => {
    const currentCoordinates = { latitude: 45.81, longitude: 16.01 };
    const groups = [
        {
            items: [
                {
                    stop: {
                        id: 11,
                        latitude: 45.7,
                        longitude: 15.9,
                    },
                    request: { accountId: 'account-a' },
                },
            ],
        },
        {
            items: [
                {
                    stop: { id: 21, ...currentCoordinates },
                    request: { accountId: 'account-a' },
                },
                {
                    stop: { id: 22, ...currentCoordinates },
                    request: { accountId: 'account-b' },
                },
            ],
        },
        {
            items: [
                {
                    stop: {
                        id: 31,
                        latitude: 45.9,
                        longitude: 16.2,
                    },
                    request: { accountId: 'account-a' },
                },
            ],
        },
    ];
    const input = {
        groups,
        currentDeliveryStopIds: new Set([21, 22]),
    };

    const accountAStops = customerCurrentDeliveryMapStops({
        accountId: 'account-a',
        ...input,
    });
    assert.deepEqual(accountAStops, [
        { ...currentCoordinates, sequence: 1, selectionId: null },
    ]);
    assert.deepEqual(
        customerCurrentDeliveryMapStops({
            accountId: 'account-b',
            ...input,
        }),
        accountAStops,
    );
    assert.deepEqual(
        customerCurrentDeliveryMapStops({
            accountId: 'account-c',
            ...input,
        }),
        [],
    );
    assert.equal(JSON.stringify(accountAStops).includes('45.9'), false);
});

test('map roles expose driver data only to the assigned driver or admin', () => {
    for (const role of ['user', 'farmer']) {
        assert.equal(
            deliveryMapAudience({
                role,
                userId: 'customer',
                driverUserId: 'assigned-driver',
            }),
            'customer',
        );
    }
    for (const role of ['driver', 'admin']) {
        assert.equal(
            deliveryMapAudience({
                role,
                userId: 'assigned-driver',
                driverUserId: 'assigned-driver',
            }),
            'driver',
        );
        assert.equal(
            deliveryMapAudience({
                role,
                userId: 'other-operator',
                driverUserId: 'assigned-driver',
            }),
            'customer',
        );
    }
});
