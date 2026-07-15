import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDeliveryMapData,
    decodeDeliveryMapPolyline,
    parseDeliveryMapData,
} from './deliveryMapData';

const driverLocation = { latitude: 45.801, longitude: 15.981 };
const pickupNodes = [{ latitude: 45.79, longitude: 15.97 }];
const stops = [{ latitude: 45.81, longitude: 16.01, sequence: 2 }];

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
            stops,
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
            stops: [{ latitude: 45.81, longitude: 16.01, sequence: 0 }],
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
