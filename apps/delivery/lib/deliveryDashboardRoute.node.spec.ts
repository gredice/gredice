import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryDashboardResponse } from '../app/api/dashboard/route';

const authContext = {
    accountId: 'account-a',
    userId: 'user-multi-account',
    user: {
        accountIds: ['account-a', 'account-b'],
        role: 'user',
    },
};

function customerDashboard(accountId: string) {
    return {
        kind: 'customer' as const,
        user: {
            id: authContext.userId,
            displayName: `Customer ${accountId}`,
            role: 'user',
        },
        deliveries: [],
        refreshedAt: '2026-07-16T10:00:00.000Z',
    };
}

test('an owned deep link switches the dashboard and shared account cookie', async () => {
    const requestedAccountIds: string[] = [];
    const response = await deliveryDashboardResponse(
        new Request(
            'https://dostava.gredice.test/api/dashboard?delivery=request-b',
        ),
        authContext,
        {
            authCookieSettings: async () => ({
                domain: '.gredice.test',
                secure: true,
            }),
            getDeliveryDashboard: async ({ accountId }) => {
                requestedAccountIds.push(accountId);
                return customerDashboard(accountId);
            },
            getDeliveryRequestOwners: async (requestIds) =>
                requestIds.map((requestId) => ({
                    accountId: 'account-b',
                    requestId,
                })),
        },
    );

    assert.deepEqual(requestedAccountIds, ['account-b']);
    assert.equal(
        (await response.json()).user.displayName,
        'Customer account-b',
    );
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const cookie = response.headers.get('set-cookie') ?? '';
    assert.match(cookie, /gredice_account=account-b/i);
    assert.match(cookie, /domain=\.gredice\.test/i);
    assert.match(cookie, /path=\//i);
    assert.match(cookie, /max-age=31536000/i);
    assert.match(cookie, /httponly/i);
    assert.match(cookie, /secure/i);
    assert.match(cookie, /samesite=lax/i);
});

test('unowned and malformed targets stay on the selected account without a cookie', async () => {
    const cases = [
        {
            ownerAccountId: 'account-c',
            url: 'https://dostava.gredice.test/api/dashboard?delivery=request-c',
        },
        {
            ownerAccountId: null,
            url: 'https://dostava.gredice.test/api/dashboard?delivery=missing',
        },
        {
            ownerAccountId: 'account-b',
            url: 'https://dostava.gredice.test/api/dashboard?delivery=request-b&delivery=request-c',
        },
        {
            ownerAccountId: 'account-b',
            url: 'https://dostava.gredice.test/api/dashboard?delivery=request%2Finvalid',
        },
    ];

    for (const testCase of cases) {
        let ownerLookupCount = 0;
        const requestedAccountIds: string[] = [];
        const response = await deliveryDashboardResponse(
            new Request(testCase.url),
            authContext,
            {
                authCookieSettings: async () => ({
                    domain: undefined,
                    secure: true,
                }),
                getDeliveryDashboard: async ({ accountId }) => {
                    requestedAccountIds.push(accountId);
                    return customerDashboard(accountId);
                },
                getDeliveryRequestOwners: async (requestIds) => {
                    ownerLookupCount += 1;
                    return testCase.ownerAccountId
                        ? requestIds.map((requestId) => ({
                              accountId: testCase.ownerAccountId ?? '',
                              requestId,
                          }))
                        : [];
                },
            },
        );

        assert.deepEqual(requestedAccountIds, ['account-a']);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(
            ownerLookupCount,
            testCase.url.includes('&delivery=') ||
                testCase.url.includes('%2Finvalid')
                ? 0
                : 1,
        );
    }
});

test('driver deep links do not change the operational account context', async () => {
    let ownerLookupCount = 0;
    const requestedAccountIds: string[] = [];
    const response = await deliveryDashboardResponse(
        new Request(
            'https://dostava.gredice.test/api/dashboard?delivery=request-b',
        ),
        {
            ...authContext,
            user: { ...authContext.user, role: 'driver' },
        },
        {
            authCookieSettings: async () => ({
                domain: undefined,
                secure: true,
            }),
            getDeliveryDashboard: async ({ accountId, role, userId }) => {
                requestedAccountIds.push(accountId);
                return {
                    activeRun: null,
                    batches: [],
                    kind: 'driver',
                    maximumRouteStops: 25,
                    maximumRouteWindowHours: 12,
                    refreshedAt: '2026-07-16T10:00:00.000Z',
                    user: {
                        displayName: 'Driver',
                        id: userId,
                        role,
                    },
                };
            },
            getDeliveryRequestOwners: async () => {
                ownerLookupCount += 1;
                return [];
            },
        },
    );

    assert.deepEqual(requestedAccountIds, ['account-a']);
    assert.equal(ownerLookupCount, 0);
    assert.equal(response.headers.get('set-cookie'), null);
});
