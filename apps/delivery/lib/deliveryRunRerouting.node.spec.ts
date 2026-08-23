import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryRunExactLocationTtlMs,
    deliveryRunRerouteLeaseMs,
} from '@gredice/storage';
import {
    deliveryRerouteLocationIsFresh,
    deliveryRerouteRetryIntervalMs,
    deliveryRerouteRetryIsDue,
    deliveryRunHasActiveArrivedStop,
} from './deliveryRunRerouting';

test('reroute freshness uses the server-received GPS timestamp', () => {
    const rerouteRequiredAt = new Date('2026-07-15T10:00:00.000Z');
    const now = new Date(rerouteRequiredAt);
    const location = {
        currentLatitude: 45.81,
        currentLongitude: 15.97,
        rerouteRequiredAt,
    };

    assert.equal(
        deliveryRerouteLocationIsFresh(
            {
                ...location,
                currentLocationReceivedAt: new Date(
                    rerouteRequiredAt.getTime() - 1,
                ),
            },
            now,
        ),
        false,
    );
    assert.equal(
        deliveryRerouteLocationIsFresh(
            {
                ...location,
                currentLocationReceivedAt: new Date(rerouteRequiredAt),
            },
            now,
        ),
        true,
    );
    assert.equal(
        deliveryRerouteLocationIsFresh(
            {
                ...location,
                currentLatitude: null,
                currentLocationReceivedAt: new Date(rerouteRequiredAt),
            },
            now,
        ),
        false,
    );
});

test('reroute origin expires at the absolute exact-location TTL', () => {
    const receivedAt = new Date('2026-07-15T10:00:00.000Z');
    const location = {
        currentLatitude: 45.81,
        currentLongitude: 15.97,
        currentLocationReceivedAt: receivedAt,
        rerouteRequiredAt: new Date(receivedAt.getTime() - 1_000),
    };

    assert.equal(
        deliveryRerouteLocationIsFresh(
            location,
            new Date(receivedAt.getTime() + deliveryRunExactLocationTtlMs),
        ),
        true,
    );
    assert.equal(
        deliveryRerouteLocationIsFresh(
            location,
            new Date(receivedAt.getTime() + deliveryRunExactLocationTtlMs + 1),
        ),
        false,
    );
});

test('reroute retry becomes due only after the shared lease interval', () => {
    const requiredAt = new Date('2026-07-15T10:00:00.000Z');
    const attemptedAt = new Date('2026-07-15T10:01:00.000Z');

    assert.equal(deliveryRerouteRetryIntervalMs, deliveryRunRerouteLeaseMs);
    assert.equal(
        deliveryRerouteRetryIsDue(
            requiredAt,
            attemptedAt,
            new Date(attemptedAt.getTime() + deliveryRunRerouteLeaseMs - 1),
        ),
        false,
    );
    assert.equal(
        deliveryRerouteRetryIsDue(
            requiredAt,
            attemptedAt,
            new Date(attemptedAt.getTime() + deliveryRunRerouteLeaseMs),
        ),
        true,
    );
    assert.equal(deliveryRerouteRetryIsDue(requiredAt, null, requiredAt), true);
    assert.equal(deliveryRerouteRetryIsDue(null, null, requiredAt), false);
});

test('an active arrived checkpoint defers rerouting but a released one does not', () => {
    assert.equal(
        deliveryRunHasActiveArrivedStop([
            { state: 'arrived', releasedAt: null },
        ]),
        true,
    );
    assert.equal(
        deliveryRunHasActiveArrivedStop([
            { state: 'arrived', releasedAt: new Date() },
            { state: 'pending', releasedAt: null },
        ]),
        false,
    );
});
