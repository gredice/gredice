import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatDeliveryDestinationAddress,
    haversineDistanceMeters,
    nearestNeighborStopOrder,
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
