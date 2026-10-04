import assert from 'node:assert/strict';
import test from 'node:test';
import {
    customerDashboardFreshnessFailureForRender,
    initialCustomerDashboardFreshnessState,
    nextCustomerDashboardFreshnessState,
    shouldShowDeliveryDashboardLoading,
} from './customerDashboardFreshness';

const freshInput = {
    scopeKey: 'customer-a',
    hasCustomerDashboard: true,
    networkOnline: true,
    isRefetchError: false,
    isSuccess: true,
    successVersion: 100,
};

test('keeps an offline dashboard stale until a newer request succeeds', () => {
    const offline = nextCustomerDashboardFreshnessState(
        initialCustomerDashboardFreshnessState,
        { ...freshInput, networkOnline: false },
    );
    assert.deepEqual(offline, {
        scopeKey: 'customer-a',
        failure: 'offline',
        staleSuccessVersion: 100,
    });

    const reconnecting = nextCustomerDashboardFreshnessState(offline, {
        ...freshInput,
        networkOnline: true,
    });
    assert.equal(reconnecting, offline);

    const failed = nextCustomerDashboardFreshnessState(reconnecting, {
        ...freshInput,
        isRefetchError: true,
    });
    assert.deepEqual(failed, {
        scopeKey: 'customer-a',
        failure: 'refresh',
        staleSuccessVersion: 100,
    });

    const recovered = nextCustomerDashboardFreshnessState(failed, {
        ...freshInput,
        successVersion: 101,
    });
    assert.deepEqual(recovered, {
        scopeKey: 'customer-a',
        failure: null,
        staleSuccessVersion: null,
    });
});

test('does not turn a paused or cached retry into a false recovery', () => {
    const stale = {
        scopeKey: 'customer-a',
        failure: 'offline' as const,
        staleSuccessVersion: 100,
    };
    assert.equal(nextCustomerDashboardFreshnessState(stale, freshInput), stale);
    assert.equal(
        nextCustomerDashboardFreshnessState(stale, {
            ...freshInput,
            isSuccess: false,
            successVersion: 101,
        }),
        stale,
    );
});

test('resets the stale latch when the authenticated account changes', () => {
    const staleAccountA = nextCustomerDashboardFreshnessState(
        initialCustomerDashboardFreshnessState,
        { ...freshInput, networkOnline: false },
    );
    const cachedAccountB = nextCustomerDashboardFreshnessState(staleAccountA, {
        ...freshInput,
        scopeKey: 'customer-b',
        successVersion: 50,
    });
    assert.deepEqual(cachedAccountB, {
        scopeKey: 'customer-b',
        failure: null,
        staleSuccessVersion: null,
    });
    assert.deepEqual(
        nextCustomerDashboardFreshnessState(cachedAccountB, {
            ...freshInput,
            scopeKey: 'customer-b',
            networkOnline: false,
            successVersion: 50,
        }),
        {
            scopeKey: 'customer-b',
            failure: 'offline',
            staleSuccessVersion: 50,
        },
    );
});

test('renders current failures immediately while retaining a reconnect latch', () => {
    const stale = {
        scopeKey: 'customer-a',
        failure: 'offline' as const,
        staleSuccessVersion: 100,
    };
    assert.equal(
        customerDashboardFreshnessFailureForRender(
            initialCustomerDashboardFreshnessState,
            {
                scopeKey: 'customer-a',
                networkOnline: false,
                isRefetchError: false,
            },
        ),
        'offline',
    );
    assert.equal(
        customerDashboardFreshnessFailureForRender(stale, {
            scopeKey: 'customer-a',
            networkOnline: true,
            isRefetchError: true,
        }),
        'refresh',
    );
    assert.equal(
        customerDashboardFreshnessFailureForRender(stale, {
            scopeKey: 'customer-a',
            networkOnline: true,
            isRefetchError: false,
        }),
        'offline',
    );
    assert.equal(
        customerDashboardFreshnessFailureForRender(stale, {
            scopeKey: 'customer-b',
            networkOnline: true,
            isRefetchError: false,
        }),
        null,
    );
});

test('routes an initial offline query to failure instead of an endless loader', () => {
    assert.equal(
        shouldShowDeliveryDashboardLoading({
            isPending: true,
            networkOnline: false,
            waitForOfflineRoute: false,
            hasOfflineRoute: false,
            offlineFallbackReady: false,
        }),
        false,
    );
    assert.equal(
        shouldShowDeliveryDashboardLoading({
            isPending: true,
            networkOnline: true,
            waitForOfflineRoute: false,
            hasOfflineRoute: false,
            offlineFallbackReady: false,
        }),
        true,
    );
    assert.equal(
        shouldShowDeliveryDashboardLoading({
            isPending: true,
            networkOnline: true,
            waitForOfflineRoute: true,
            hasOfflineRoute: true,
            offlineFallbackReady: true,
        }),
        false,
    );
});

test('gives a cold offline driver cache a bounded loading grace', () => {
    const coldDriver = {
        isPending: true,
        networkOnline: false,
        waitForOfflineRoute: true,
        hasOfflineRoute: false,
        offlineFallbackReady: false,
    };
    assert.equal(shouldShowDeliveryDashboardLoading(coldDriver), true);
    assert.equal(
        shouldShowDeliveryDashboardLoading({
            ...coldDriver,
            hasOfflineRoute: true,
        }),
        false,
    );
    assert.equal(
        shouldShowDeliveryDashboardLoading({
            ...coldDriver,
            offlineFallbackReady: true,
        }),
        false,
    );
});
