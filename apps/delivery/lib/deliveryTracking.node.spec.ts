import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DeliveryRunExecutionError,
    DeliveryRunExecutionErrorCodes,
    deliveryRunExactLocationTtlMs,
    deliveryRunTrackingLiveThresholdMs,
} from '@gredice/storage';
import {
    customerDeliveryTrackingSummary,
    type DeliveryTrackingSnapshot,
    deliveryLocationCaptureTimeIsAcceptable,
    deliveryLocationErrorStatus,
    deliveryTrackingRecoveryTransition,
    deliveryTrackingStatus,
    driverDeliveryTrackingLocation,
} from './deliveryTracking';
import { deliveryTrackingMapVersion } from './deliveryTrackingPresentation';

const acceptedAt = new Date('2026-07-15T10:00:00.000Z');

test('location endpoint retries unknown failures but preserves known domain statuses', () => {
    assert.equal(deliveryLocationErrorStatus(new Error('storage down')), 500);
    assert.equal(
        deliveryLocationErrorStatus(
            new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'missing run',
            ),
        ),
        404,
    );
    for (const code of [
        DeliveryRunExecutionErrorCodes.LOCATION_STALE,
        DeliveryRunExecutionErrorCodes.LOCATION_CONFLICT,
    ]) {
        assert.equal(
            deliveryLocationErrorStatus(
                new DeliveryRunExecutionError(code, 'location conflict'),
            ),
            409,
        );
    }
    assert.equal(
        deliveryLocationErrorStatus(
            new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
                'unexpected domain failure',
            ),
        ),
        500,
    );
});

function snapshot(
    overrides: Partial<DeliveryTrackingSnapshot> = {},
): DeliveryTrackingSnapshot {
    return {
        state: 'active',
        currentLatitude: 45.812_345,
        currentLongitude: 15.912_345,
        currentLocationAccuracy: 7,
        currentLocationHeading: 135,
        currentLocationSpeed: 8.5,
        currentLocationRecordedAt: new Date(acceptedAt.getTime() - 1_000),
        currentLocationReceivedAt: acceptedAt,
        ...overrides,
    };
}

test('tracking freshness uses server receipt time at exact boundaries', () => {
    assert.equal(
        deliveryTrackingStatus(
            snapshot(),
            new Date(acceptedAt.getTime() + deliveryRunTrackingLiveThresholdMs),
        ),
        'live',
    );
    assert.equal(
        deliveryTrackingStatus(
            snapshot(),
            new Date(
                acceptedAt.getTime() + deliveryRunTrackingLiveThresholdMs + 1,
            ),
        ),
        'delayed',
    );
    assert.equal(
        deliveryTrackingStatus(
            snapshot(),
            new Date(acceptedAt.getTime() + deliveryRunExactLocationTtlMs),
        ),
        'delayed',
    );
    assert.equal(
        deliveryTrackingStatus(
            snapshot(),
            new Date(acceptedAt.getTime() + deliveryRunExactLocationTtlMs + 1),
        ),
        'offline',
    );
});

test('tracking is unavailable without a server receipt or after a terminal state', () => {
    assert.equal(
        deliveryTrackingStatus(
            snapshot({ currentLocationReceivedAt: null }),
            acceptedAt,
        ),
        'unavailable',
    );
    assert.equal(
        deliveryTrackingStatus(snapshot({ state: 'completed' }), acceptedAt),
        'unavailable',
    );
    assert.equal(
        driverDeliveryTrackingLocation(
            snapshot({ state: 'cancelled' }),
            acceptedAt,
        ),
        null,
    );
});

test('only offline or unavailable tracking recovery is a logged transition', () => {
    assert.equal(deliveryTrackingRecoveryTransition('offline', 'live'), true);
    assert.equal(
        deliveryTrackingRecoveryTransition('unavailable', 'delayed'),
        true,
    );
    assert.equal(deliveryTrackingRecoveryTransition('delayed', 'live'), false);
    assert.equal(deliveryTrackingRecoveryTransition('live', 'live'), false);
    assert.equal(
        deliveryTrackingRecoveryTransition('offline', 'offline'),
        false,
    );
});

test('exact driver telemetry disappears after TTL while customer freshness stays data-minimized', () => {
    const afterTtl = new Date(
        acceptedAt.getTime() + deliveryRunExactLocationTtlMs + 1,
    );
    assert.equal(driverDeliveryTrackingLocation(snapshot(), afterTtl), null);

    const customer = customerDeliveryTrackingSummary(snapshot(), afterTtl);
    assert.deepEqual(customer, {
        status: 'offline',
        lastAcceptedAt: acceptedAt.toISOString(),
        mapAvailable: false,
    });
    assert.deepEqual(Object.keys(customer).sort(), [
        'lastAcceptedAt',
        'mapAvailable',
        'status',
    ]);
    const serialized = JSON.stringify(customer);
    for (const privateValue of ['45.812345', '15.912345', '135', '8.5']) {
        assert.equal(serialized.includes(privateValue), false);
    }
});

test('customer map remains available only while exact telemetry is within TTL', () => {
    assert.equal(
        customerDeliveryTrackingSummary(snapshot(), acceptedAt).mapAvailable,
        true,
    );
    assert.equal(
        customerDeliveryTrackingSummary(
            snapshot({ currentLatitude: null }),
            acceptedAt,
        ).mapAvailable,
        false,
    );
});

test('map version changes when freshness crosses a status boundary', () => {
    const tracking = customerDeliveryTrackingSummary(snapshot(), acceptedAt);
    const liveVersion = deliveryTrackingMapVersion(tracking);
    const delayedVersion = deliveryTrackingMapVersion({
        ...tracking,
        status: 'delayed',
    });
    const offlineVersion = deliveryTrackingMapVersion({
        ...tracking,
        status: 'offline',
        mapAvailable: false,
    });

    assert.notEqual(delayedVersion, liveVersion);
    assert.notEqual(offlineVersion, delayedVersion);
    assert.match(offlineVersion, /^offline:/);
});

test('capture time validation rejects already-expired and excessive future samples', () => {
    assert.equal(
        deliveryLocationCaptureTimeIsAcceptable(
            new Date(acceptedAt.getTime() - deliveryRunExactLocationTtlMs),
            acceptedAt,
        ),
        true,
    );
    assert.equal(
        deliveryLocationCaptureTimeIsAcceptable(
            new Date(acceptedAt.getTime() - deliveryRunExactLocationTtlMs - 1),
            acceptedAt,
        ),
        false,
    );
    assert.equal(
        deliveryLocationCaptureTimeIsAcceptable(
            new Date(acceptedAt.getTime() + 5 * 60 * 1000),
            acceptedAt,
        ),
        true,
    );
    assert.equal(
        deliveryLocationCaptureTimeIsAcceptable(
            new Date(acceptedAt.getTime() + 5 * 60 * 1000 + 1),
            acceptedAt,
        ),
        false,
    );
    assert.equal(
        deliveryLocationCaptureTimeIsAcceptable(new Date(Number.NaN)),
        false,
    );
});
