import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDeliveryMapData,
    decodeDeliveryMapPolyline,
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
