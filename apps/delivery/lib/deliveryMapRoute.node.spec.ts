import assert from 'node:assert/strict';
import test from 'node:test';
import { persistLegacyGoogleRoutePolyline } from '@gredice/storage/deliveryTrackingPolicy';
import { createDeliveryMapRouteHandlers } from './deliveryMapRoute';

const runId = 'delivery-run-map-1';
const fixedNow = new Date('2026-07-16T10:00:00.000Z');
const authenticatedRoles = ['user', 'farmer', 'driver', 'admin'];
const terminalStates = new Set(['delivered', 'failed', 'cancelled']);

type TestDeliveryMapGroup = {
    label: string;
    items: Array<{
        stop: {
            id: number;
            state: string;
            latitude: number;
            longitude: number;
        };
        request: {
            accountId: string;
        };
    }>;
};

type TestDeliveryMapRun = {
    id: string;
    state: string;
    currentKind: 'delivery' | 'pickup';
    pickupConfirmed: boolean;
    currentDeliveryStopIds: Set<number>;
    driverUserId: string | null;
    driverLocation: {
        latitude: number;
        longitude: number;
    } | null;
    pickupNodes: Array<{
        id: string;
        latitude: number | null;
        longitude: number | null;
    }>;
    encodedPolyline: string | null;
    groups: TestDeliveryMapGroup[];
};

type TestRunOptions = {
    state?: string;
    currentKind?: 'delivery' | 'pickup';
    pickupConfirmed?: boolean;
    driverUserId?: string | null;
};

function deliveryGroups(): TestDeliveryMapGroup[] {
    return [
        {
            label: 'previous',
            items: [
                {
                    stop: {
                        id: 11,
                        state: 'pending',
                        latitude: 45.7,
                        longitude: 15.9,
                    },
                    request: { accountId: 'account-previous' },
                },
            ],
        },
        {
            label: 'current-bulk',
            items: [
                {
                    stop: {
                        id: 21,
                        state: 'pending',
                        latitude: 45.81,
                        longitude: 16.01,
                    },
                    request: { accountId: 'account-current' },
                },
                {
                    stop: {
                        id: 22,
                        state: 'pending',
                        latitude: 45.82,
                        longitude: 16.02,
                    },
                    request: { accountId: 'account-other-current' },
                },
            ],
        },
        {
            label: 'later-same-account',
            items: [
                {
                    stop: {
                        id: 31,
                        state: 'pending',
                        latitude: 45.99,
                        longitude: 16.29,
                    },
                    request: { accountId: 'account-later' },
                },
            ],
        },
        {
            label: 'terminal',
            items: [
                {
                    stop: {
                        id: 41,
                        state: 'delivered',
                        latitude: 46.1,
                        longitude: 16.4,
                    },
                    request: { accountId: 'account-delivered' },
                },
            ],
        },
    ];
}

function deliveryRun(options: TestRunOptions = {}): TestDeliveryMapRun {
    return {
        id: runId,
        state: options.state ?? 'active',
        currentKind: options.currentKind ?? 'delivery',
        pickupConfirmed: options.pickupConfirmed ?? true,
        currentDeliveryStopIds: new Set([21, 22]),
        driverUserId:
            options.driverUserId === undefined
                ? 'assigned-driver'
                : options.driverUserId,
        driverLocation: { latitude: 45.8, longitude: 15.98 },
        pickupNodes: [
            {
                id: 'pickup-hq',
                latitude: 45.79,
                longitude: 15.97,
            },
            {
                id: 'pickup-without-coordinates',
                latitude: null,
                longitude: null,
            },
        ],
        encodedPolyline: persistLegacyGoogleRoutePolyline(
            'private-complete-route',
        ),
        groups: deliveryGroups(),
    };
}

function customerTrackingContext({
    accountId,
    run,
}: {
    accountId: string;
    run: TestDeliveryMapRun;
}) {
    if (
        run.state !== 'active' ||
        run.currentKind !== 'delivery' ||
        !run.pickupConfirmed
    ) {
        return null;
    }
    const ownsCurrentActionableStop = run.groups.some((group) =>
        group.items.some(
            ({ stop, request }) =>
                run.currentDeliveryStopIds.has(stop.id) &&
                !terminalStates.has(stop.state) &&
                request.accountId === accountId,
        ),
    );
    return ownsCurrentActionableStop
        ? {
              groups: run.groups,
              currentDeliveryStopIds: run.currentDeliveryStopIds,
          }
        : null;
}

type HarnessInput = {
    role: string;
    userId: string;
    accountId: string;
    run?: TestDeliveryMapRun | null;
    authResponse?: Response;
};

function createHarness(input: HarnessInput) {
    const selectedRun = input.run === undefined ? deliveryRun() : input.run;
    const calls = {
        getRun: 0,
        getCustomerTrackingContext: 0,
        resolveGroups: 0,
        buildStaticMapUrl: 0,
        staticMapEncodedPolylines: [] as Array<string | null>,
    };
    const handlers = createDeliveryMapRouteHandlers<
        TestDeliveryMapRun,
        TestDeliveryMapGroup
    >({
        withAuth: async (roles, handler) => {
            assert.deepEqual(roles, authenticatedRoles);
            if (input.authResponse) return input.authResponse;
            return await handler({
                accountId: input.accountId,
                userId: input.userId,
                user: { role: input.role },
            });
        },
        getRun: async (requestedRunId) => {
            calls.getRun += 1;
            assert.equal(requestedRunId, runId);
            return selectedRun;
        },
        getCustomerTrackingContext: async (trackingInput) => {
            calls.getCustomerTrackingContext += 1;
            return customerTrackingContext(trackingInput);
        },
        resolveGroups: async (run) => {
            calls.resolveGroups += 1;
            return run.groups;
        },
        getDriverLocation: (run, projectedAt) => {
            assert.equal(projectedAt.toISOString(), fixedNow.toISOString());
            return run.driverLocation;
        },
        isStopTerminal: (state) => terminalStates.has(state),
        buildStaticMapUrl: (mapData) => {
            calls.buildStaticMapUrl += 1;
            calls.staticMapEncodedPolylines.push(mapData.encodedPolyline);
            return null;
        },
        unavailableMapSvg: () => '<svg>Map unavailable</svg>',
        fetchMap: async () => {
            throw new Error('JSON route must not fetch a static map');
        },
        now: () => fixedNow,
        logger: { error() {} },
    });
    return { handlers, calls };
}

function request(format = 'json') {
    return new Request(
        `https://dostava.gredice.com/api/map/${runId}?format=${format}`,
    );
}

function context() {
    return { params: Promise.resolve({ runId }) };
}

function assertPrivateNoStore(response: Response) {
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
}

const customerSafeMap = {
    driverLocation: { latitude: 45.8, longitude: 15.98 },
    pickupNodes: [],
    stops: [
        {
            latitude: 45.81,
            longitude: 16.01,
            sequence: 1,
            selectionId: null,
        },
    ],
    encodedPolyline: null,
};

test('exact-current owner user and farmer receive only the customer-safe map projection', async (t) => {
    for (const role of ['user', 'farmer']) {
        await t.test(role, async () => {
            const { handlers, calls } = createHarness({
                role,
                userId: `${role}-user`,
                accountId: 'account-current',
            });

            const response = await handlers.GET(request(), context());
            const body = await response.json();

            assert.equal(response.status, 200);
            assertPrivateNoStore(response);
            assert.deepEqual(body, customerSafeMap);
            assert.equal(calls.getCustomerTrackingContext, 1);
            assert.equal(calls.resolveGroups, 0);
            assert.equal(calls.buildStaticMapUrl, 0);
            const serialized = JSON.stringify(body);
            assert.equal(serialized.includes('private-complete-route'), false);
            assert.equal(serialized.includes('45.99'), false);
            assert.equal(serialized.includes('pickup-hq'), false);
        });
    }
});

test('cross-account, non-current, pickup-current, and inactive customer contexts are forbidden', async (t) => {
    const cases: Array<{
        name: string;
        accountId: string;
        run: TestDeliveryMapRun;
    }> = [
        {
            name: 'cross-account',
            accountId: 'account-cross',
            run: deliveryRun(),
        },
        {
            name: 'same account only at a non-current stop',
            accountId: 'account-later',
            run: deliveryRun(),
        },
        {
            name: 'pickup checkpoint is current',
            accountId: 'account-current',
            run: deliveryRun({ currentKind: 'pickup' }),
        },
        {
            name: 'run is inactive',
            accountId: 'account-current',
            run: deliveryRun({ state: 'completed' }),
        },
    ];

    for (const testCase of cases) {
        await t.test(testCase.name, async () => {
            const { handlers, calls } = createHarness({
                role: 'user',
                userId: 'customer-user',
                accountId: testCase.accountId,
                run: testCase.run,
            });

            const response = await handlers.GET(request(), context());

            assert.equal(response.status, 403);
            assertPrivateNoStore(response);
            assert.equal(calls.getCustomerTrackingContext, 1);
            assert.equal(calls.resolveGroups, 0);
            assert.equal(calls.buildStaticMapUrl, 0);
        });
    }
});

test('assigned drivers and admins receive the complete driver map projection', async (t) => {
    for (const role of ['driver', 'admin']) {
        await t.test(role, async () => {
            const { handlers, calls } = createHarness({
                role,
                userId: 'assigned-driver',
                accountId: 'operator-account',
            });

            const response = await handlers.GET(request(), context());

            assert.equal(response.status, 200);
            assertPrivateNoStore(response);
            assert.deepEqual(await response.json(), {
                driverLocation: { latitude: 45.8, longitude: 15.98 },
                pickupNodes: [
                    {
                        latitude: 45.79,
                        longitude: 15.97,
                        selectionId: 'pickup-hq',
                    },
                ],
                stops: [
                    {
                        latitude: 45.7,
                        longitude: 15.9,
                        sequence: 1,
                        selectionId: '11',
                    },
                    {
                        latitude: 45.81,
                        longitude: 16.01,
                        sequence: 2,
                        selectionId: '21',
                    },
                    {
                        latitude: 45.99,
                        longitude: 16.29,
                        sequence: 3,
                        selectionId: '31',
                    },
                ],
                encodedPolyline: 'private-complete-route',
            });
            assert.equal(calls.getCustomerTrackingContext, 0);
            assert.equal(calls.resolveGroups, 1);
        });
    }
});

test('assigned driver maps preserve unmarked legacy route geometry', async () => {
    const run = deliveryRun();
    run.encodedPolyline = 'old-unmarked-route';
    const { handlers } = createHarness({
        role: 'driver',
        userId: 'assigned-driver',
        accountId: 'operator-account',
        run,
    });

    const response = await handlers.GET(request(), context());

    assert.equal(response.status, 200);
    assert.equal((await response.json()).encodedPolyline, 'old-unmarked-route');
});

test('assigned driver static maps receive raw route geometry', async () => {
    const { handlers, calls } = createHarness({
        role: 'driver',
        userId: 'assigned-driver',
        accountId: 'operator-account',
    });

    const response = await handlers.GET(request('image'), context());

    assert.equal(response.status, 200);
    assert.equal(calls.buildStaticMapUrl, 1);
    assert.deepEqual(calls.staticMapEncodedPolylines, [
        'private-complete-route',
    ]);
});

test('unassigned drivers and admins remain constrained to the customer-safe projection', async (t) => {
    for (const role of ['driver', 'admin']) {
        await t.test(role, async () => {
            const { handlers, calls } = createHarness({
                role,
                userId: 'unassigned-operator',
                accountId: 'account-current',
            });

            const response = await handlers.GET(request(), context());

            assert.equal(response.status, 200);
            assertPrivateNoStore(response);
            assert.deepEqual(await response.json(), customerSafeMap);
            assert.equal(calls.getCustomerTrackingContext, 1);
            assert.equal(calls.resolveGroups, 0);
        });
    }
});

test('missing runs return a private 404 before resolving tracking or map data', async () => {
    const { handlers, calls } = createHarness({
        role: 'user',
        userId: 'customer-user',
        accountId: 'account-current',
        run: null,
    });

    const response = await handlers.GET(request(), context());

    assert.equal(response.status, 404);
    assertPrivateNoStore(response);
    assert.equal(calls.getRun, 1);
    assert.equal(calls.getCustomerTrackingContext, 0);
    assert.equal(calls.resolveGroups, 0);
    assert.equal(calls.buildStaticMapUrl, 0);
});

test('authentication failures still request every supported role and remain private no-store', async () => {
    const { handlers, calls } = createHarness({
        role: 'user',
        userId: 'customer-user',
        accountId: 'account-current',
        authResponse: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await handlers.GET(request(), context());

    assert.equal(response.status, 401);
    assertPrivateNoStore(response);
    assert.equal(calls.getRun, 0);
    assert.equal(calls.getCustomerTrackingContext, 0);
    assert.equal(calls.resolveGroups, 0);
});
