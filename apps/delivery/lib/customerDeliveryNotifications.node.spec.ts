import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDeliveryLifecycleEvent,
    customerDeliveryNotificationWebPushTtlSeconds,
} from '@gredice/notifications';
import { deliveryLifecycleNotificationMaximumAgeSeconds } from '@gredice/storage';
import {
    type CustomerDeliveryMilestoneInput,
    customerDeliveryLifecycleNotification,
    customerDeliveryNotificationsEnabled,
    customerDeliveryPickedUpStopIds,
    customerDeliveryProgressMilestones,
    customerDeliveryProgressStopIsEligible,
    publishCustomerDeliveryMilestoneSafely,
    publishCustomerDeliveryMilestonesSafely,
    shouldEvaluateCustomerDeliveryProgress,
} from './customerDeliveryNotifications';

function customerDeliveryMilestoneInput(
    requestId: string,
    stopId: number,
): CustomerDeliveryMilestoneInput {
    return {
        milestone: 'arrived',
        occurredAt: new Date('2026-07-16T12:00:00.000Z'),
        requestId,
        retryAttempt: 0,
        runId: 'run-1',
        source: {
            id: `arrival:${requestId}`,
            kind: 'stop-operation',
            version: 1,
        },
        stopId,
    };
}

async function withDeliveryNotificationsEnabled<T>(run: () => Promise<T>) {
    const previousValue = process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED;
    process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED = 'true';
    try {
        return await run();
    } finally {
        if (previousValue === undefined) {
            delete process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED;
        } else {
            process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED = previousValue;
        }
    }
}

test('delivery lifecycle outbound TTL matches the bounded health lookback', () => {
    assert.equal(
        customerDeliveryNotificationWebPushTtlSeconds,
        deliveryLifecycleNotificationMaximumAgeSeconds,
    );
});

test('delivery notification producer remains disabled unless explicitly enabled', () => {
    assert.equal(customerDeliveryNotificationsEnabled(undefined), false);
    assert.equal(customerDeliveryNotificationsEnabled('false'), false);
    assert.equal(customerDeliveryNotificationsEnabled('1'), false);
    assert.equal(customerDeliveryNotificationsEnabled(' TRUE '), true);
});

test('route-started targets only requests in the durably confirmed pickup manifest', () => {
    const stops = [
        {
            id: 1,
            state: 'pending',
            runSlot: { manifestId: 'hq-manifest' },
        },
        {
            id: 2,
            state: 'pending',
            runSlot: { manifestId: 'farm-manifest' },
        },
        {
            id: 3,
            state: 'delivered',
            runSlot: { manifestId: 'hq-manifest' },
        },
        {
            id: 4,
            releasedAt: new Date('2026-07-16T12:00:00.000Z'),
            state: 'pending',
            runSlot: { manifestId: 'hq-manifest' },
        },
    ];
    assert.deepEqual(
        customerDeliveryPickedUpStopIds(stops, 'hq-manifest'),
        [1],
    );
    assert.deepEqual(
        customerDeliveryPickedUpStopIds(stops, 'farm-manifest'),
        [2],
    );
});

test('evaluates route progress only after the stop pickup manifest is confirmed', () => {
    assert.equal(
        customerDeliveryProgressStopIsEligible({
            manifestState: 'confirmed',
            stopState: 'pending',
        }),
        true,
    );
    for (const input of [
        { manifestState: 'pending', stopState: 'pending' },
        { manifestState: null, stopState: 'pending' },
        { manifestState: 'confirmed', stopState: 'arrived' },
        { manifestState: 'confirmed', stopState: 'delivered' },
    ]) {
        assert.equal(customerDeliveryProgressStopIsEligible(input), false);
    }
});

test('delivery lifecycle notification contains only bounded lifecycle metadata', () => {
    const event = createDeliveryLifecycleEvent({
        context: {
            accountId: 'account-1',
            requestId: 'request-1',
            runId: 'run-1',
            stopId: '42',
        },
        occurredAt: '2026-07-16T12:00:00.000Z',
        retryAttempt: 2,
        source: {
            id: 'private-operation-id',
            kind: 'route-progress',
            version: 7,
        },
        milestone: 'near-arrival',
    });

    const notification = customerDeliveryLifecycleNotification(event, 'user-1');
    assert.equal(notification.accountId, 'account-1');
    assert.equal(notification.userId, 'user-1');
    assert.equal(notification.category, 'delivery_updates');
    assert.equal(notification.type, 'delivery_lifecycle');
    assert.equal(notification.ttlSeconds, 24 * 60 * 60);
    assert.equal(
        notification.actionUrl,
        'https://dostava.gredice.com/?delivery=request-1',
    );
    assert.deepEqual(notification.metadata, {
        eventVersion: 1,
        milestone: 'near-arrival',
        requestId: 'request-1',
        retryAttempt: 2,
        runId: 'run-1',
        source: {
            id: 'private-operation-id',
            kind: 'route-progress',
            version: 7,
        },
        stopId: '42',
    });
    const serialized = JSON.stringify(notification);
    for (const privateValue of [
        'latitude',
        'longitude',
        'address',
        'phone',
        'email',
        'notes',
    ]) {
        assert.equal(serialized.includes(privateValue), false);
    }
});

test('route progress emits only milestones whose ETA thresholds are active', () => {
    const now = new Date('2026-07-16T12:00:00.000Z');
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T12:20:00.000Z'),
            estimatedTravelSeconds: 20 * 60,
            estimateIsFresh: true,
            now,
            stopsAhead: 0,
            windowEndAt: new Date('2026-07-16T12:00:00.000Z'),
        }),
        ['near-arrival', 'next-stop', 'delayed'],
    );
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T13:00:00.000Z'),
            estimatedTravelSeconds: 35 * 60,
            estimateIsFresh: true,
            now,
            stopsAhead: 2,
            windowEndAt: new Date('2026-07-16T13:00:00.000Z'),
        }),
        [],
    );
});

test('route progress rejects past or stale near-arrival estimates and uses elapsed delay', () => {
    const now = new Date('2026-07-16T13:20:00.000Z');
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T12:30:00.000Z'),
            estimatedTravelSeconds: 45 * 60,
            estimateIsFresh: false,
            now,
            stopsAhead: 2,
            windowEndAt: new Date('2026-07-16T13:00:00.000Z'),
        }),
        ['delayed'],
    );
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T13:25:00.000Z'),
            estimatedTravelSeconds: 20 * 60,
            estimateIsFresh: false,
            now,
            stopsAhead: 0,
            windowEndAt: new Date('2026-07-16T14:00:00.000Z'),
        }),
        ['next-stop'],
    );
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T13:30:00.000Z'),
            estimatedTravelSeconds: 90 * 60,
            estimateIsFresh: false,
            now: new Date('2026-07-16T12:00:00.000Z'),
            stopsAhead: 2,
            windowEndAt: new Date('2026-07-16T13:00:00.000Z'),
        }),
        [],
    );
    assert.deepEqual(
        customerDeliveryProgressMilestones({
            estimatedArrivalAt: new Date('2026-07-16T14:00:00.000Z'),
            estimatedTravelSeconds: 90 * 60,
            estimateIsFresh: false,
            now: new Date('2026-07-16T13:20:00.000Z'),
            stopsAhead: 2,
            windowEndAt: new Date('2026-07-16T13:00:00.000Z'),
        }),
        ['delayed'],
    );
});

test('progress evaluation runs once per server-time interval and skips replays', () => {
    assert.equal(
        shouldEvaluateCustomerDeliveryProgress({
            acceptedAt: new Date('2026-07-16T12:00:00.000Z'),
            previousAcceptedAt: null,
        }),
        true,
    );
    assert.equal(
        shouldEvaluateCustomerDeliveryProgress({
            acceptedAt: new Date('2026-07-16T12:01:50.000Z'),
            previousAcceptedAt: new Date('2026-07-16T12:00:10.000Z'),
        }),
        false,
    );
    assert.equal(
        shouldEvaluateCustomerDeliveryProgress({
            acceptedAt: new Date('2026-07-16T12:02:00.000Z'),
            previousAcceptedAt: new Date('2026-07-16T12:01:50.000Z'),
        }),
        true,
    );
    assert.equal(
        shouldEvaluateCustomerDeliveryProgress({
            acceptedAt: new Date('2026-07-16T12:02:00.000Z'),
            previousAcceptedAt: new Date('2026-07-16T12:02:00.000Z'),
        }),
        false,
    );
});

test('exception notification uses bounded customer copy without operational notes', () => {
    const event = createDeliveryLifecycleEvent({
        context: {
            accountId: 'account-1',
            requestId: 'request-1',
            runId: 'run-1',
            stopId: '42',
        },
        exception: {
            outcome: 'deferred',
            reason: 'customer-unavailable',
        },
        occurredAt: '2026-07-16T12:00:00.000Z',
        retryAttempt: 0,
        source: {
            id: 'exception-operation',
            kind: 'exception-operation',
            version: 1,
        },
        milestone: 'exception',
    });

    const notification = customerDeliveryLifecycleNotification(event, 'user-1');
    assert.equal(notification.header, 'Dostava je odgođena');
    assert.match(notification.content, /nije uspio kontaktirati/u);
    assert.deepEqual(notification.metadata, {
        eventVersion: 1,
        exception: {
            outcome: 'deferred',
            reason: 'customer-unavailable',
        },
        milestone: 'exception',
        requestId: 'request-1',
        retryAttempt: 0,
        runId: 'run-1',
        source: {
            id: 'exception-operation',
            kind: 'exception-operation',
            version: 1,
        },
        stopId: '42',
    });
    assert.doesNotMatch(
        JSON.stringify(notification),
        /latitude|longitude|address|phone|email|notes/u,
    );
});

test('safe milestone publishing contains notification storage failures', async () => {
    const result = await withDeliveryNotificationsEnabled(async () =>
        publishCustomerDeliveryMilestoneSafely(
            {
                ...customerDeliveryMilestoneInput('request-1', 1),
                accountId: 'account-1',
            },
            {
                createNotificationWithOutcome: async () => {
                    throw new Error('storage unavailable');
                },
                getDeliveryAccountContacts: async () => [
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'Customer',
                        id: 'user-1',
                        role: 'user',
                        userName: 'customer@example.test',
                    },
                ],
            },
        ),
    );

    assert.deepEqual(result, { outcome: 'failed' });
});

test('milestone publishing fans out one recipient-scoped row per customer-capable account user', async () => {
    const created: Array<{ idempotencyKey: string; userId: string | null }> =
        [];
    const result = await withDeliveryNotificationsEnabled(async () =>
        publishCustomerDeliveryMilestoneSafely(
            {
                ...customerDeliveryMilestoneInput('request-1', 1),
                accountId: 'account-1',
            },
            {
                getDeliveryAccountContacts: async () => [
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'First',
                        id: 'user-1',
                        role: 'user',
                        userName: 'first@example.test',
                    },
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'Second',
                        id: 'user-2',
                        role: 'farmer',
                        userName: 'second@example.test',
                    },
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'Driver',
                        id: 'driver-1',
                        role: 'driver',
                        userName: 'driver@example.test',
                    },
                ],
                createNotificationWithOutcome: async (
                    notification,
                    options,
                ) => {
                    const idempotencyKey = options?.idempotencyKey;
                    assert.ok(idempotencyKey);
                    created.push({
                        idempotencyKey,
                        userId: notification.userId ?? null,
                    });
                    return {
                        notificationId: `notification:${notification.userId}`,
                        outcome: 'created',
                    };
                },
            },
        ),
    );

    assert.deepEqual(result, {
        notificationId: 'notification:user-1',
        notificationIds: ['notification:user-1', 'notification:user-2'],
        outcome: 'published',
    });
    assert.deepEqual(
        created.map(({ userId }) => userId),
        ['user-1', 'user-2'],
    );
    assert.equal(
        new Set(created.map(({ idempotencyKey }) => idempotencyKey)).size,
        2,
    );
});

test('milestone publishing records one privacy-safe suppression decision when every recipient row is reused', async () => {
    const recordedDecisions: unknown[] = [];
    const result = await withDeliveryNotificationsEnabled(async () =>
        publishCustomerDeliveryMilestoneSafely(
            {
                ...customerDeliveryMilestoneInput('request-1', 1),
                accountId: 'account-1',
            },
            {
                getDeliveryAccountContacts: async () => [
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'First',
                        id: 'user-1',
                        role: 'user',
                        userName: 'first@example.test',
                    },
                    {
                        accountId: 'account-1',
                        avatarUrl: null,
                        displayName: 'Second',
                        id: 'user-2',
                        role: 'farmer',
                        userName: 'second@example.test',
                    },
                ],
                createNotificationWithOutcome: async (notification) => ({
                    notificationId: `notification:${notification.userId}`,
                    outcome: 'reused',
                }),
                recordLifecycleNotificationDecision: async (event) => {
                    recordedDecisions.push(event);
                },
            },
        ),
    );

    assert.deepEqual(result, {
        notificationId: 'notification:user-1',
        notificationIds: ['notification:user-1', 'notification:user-2'],
        outcome: 'published',
    });
    assert.deepEqual(recordedDecisions, [
        {
            aggregateId: 'request-1',
            data: {
                decision: 'suppressed',
                milestone: 'arrived',
                reason: 'idempotency_reused',
                retryAttempt: 0,
                runId: 'run-1',
                sourceId: 'arrival:request-1',
                stopId: '1',
            },
            type: 'delivery.request.lifecycle_notification.decision',
            version: 1,
        },
    ]);
    assert.doesNotMatch(
        JSON.stringify(recordedDecisions),
        /account-1|user-1|user-2|latitude|longitude|address|email|content|header/u,
    );
});

test('reused notification publication stays successful when suppression telemetry fails', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
        const result = await withDeliveryNotificationsEnabled(async () =>
            publishCustomerDeliveryMilestoneSafely(
                {
                    ...customerDeliveryMilestoneInput('request-private', 9),
                    accountId: 'account-private',
                },
                {
                    getDeliveryAccountContacts: async () => [
                        {
                            accountId: 'account-private',
                            avatarUrl: null,
                            displayName: 'Customer',
                            id: 'user-private',
                            role: 'user',
                            userName: 'private@example.test',
                        },
                    ],
                    createNotificationWithOutcome: async () => ({
                        notificationId: 'notification:reused',
                        outcome: 'reused',
                    }),
                    recordLifecycleNotificationDecision: async () => {
                        throw new Error('telemetry unavailable');
                    },
                },
            ),
        );

        assert.deepEqual(result, {
            notificationId: 'notification:reused',
            notificationIds: ['notification:reused'],
            outcome: 'published',
        });
        assert.deepEqual(warnings, [
            [
                'Customer delivery suppression telemetry write failed',
                { errorName: 'Error', milestone: 'arrived' },
            ],
        ]);
        assert.doesNotMatch(
            JSON.stringify(warnings),
            /request-private|account-private|user-private|run-1|stop/u,
        );
    } finally {
        console.warn = originalWarn;
    }
});

test('route-progress suppression is recorded only after publication is reused', async () => {
    const recordedDecisions: unknown[] = [];
    let publicationAttempt = 0;
    const input = {
        accountId: 'account-1',
        milestone: 'near-arrival' as const,
        occurredAt: new Date('2026-07-16T12:00:00.000Z'),
        requestId: 'request-1',
        retryAttempt: 0,
        runId: 'run-1',
        source: {
            id: 'route-progress:2026-07-16T12:00:00.000Z',
            kind: 'route-progress' as const,
            version: 1,
        },
        stopId: 1,
    };
    const dependencies = {
        getDeliveryAccountContacts: async () => [
            {
                accountId: 'account-1',
                avatarUrl: null,
                displayName: 'Customer',
                id: 'user-1',
                role: 'user',
                userName: 'customer@example.test',
            },
        ],
        createNotificationWithOutcome: async () => {
            publicationAttempt += 1;
            if (publicationAttempt === 1) {
                throw new Error('temporary publication failure');
            }
            return {
                notificationId: 'notification:route-progress',
                outcome: publicationAttempt === 2 ? 'created' : 'reused',
            } as const;
        },
        recordLifecycleNotificationDecision: async (event: unknown) => {
            recordedDecisions.push(event);
        },
    };

    const [failed, recovered, reused] = await withDeliveryNotificationsEnabled(
        async () => [
            await publishCustomerDeliveryMilestoneSafely(input, dependencies),
            await publishCustomerDeliveryMilestoneSafely(input, dependencies),
            await publishCustomerDeliveryMilestoneSafely(input, dependencies),
        ],
    );

    assert.deepEqual(failed, { outcome: 'failed' });
    assert.equal(recovered.outcome, 'published');
    assert.equal(reused.outcome, 'published');
    assert.deepEqual(recordedDecisions, [
        {
            aggregateId: 'request-1',
            data: {
                decision: 'suppressed',
                milestone: 'near-arrival',
                reason: 'eta_threshold_already_emitted',
                retryAttempt: 0,
                runId: 'run-1',
                sourceId: 'route-progress:2026-07-16T12:00:00.000Z',
                stopId: '1',
            },
            type: 'delivery.request.lifecycle_notification.decision',
            version: 1,
        },
    ]);
});

test('batch milestone publishing isolates one notification storage failure', async () => {
    const publishedAccountIds: string[] = [];
    const result = await withDeliveryNotificationsEnabled(async () =>
        publishCustomerDeliveryMilestonesSafely(
            [
                customerDeliveryMilestoneInput('request-1', 1),
                customerDeliveryMilestoneInput('request-2', 2),
                customerDeliveryMilestoneInput('request-3', 3),
            ],
            {
                getDeliveryRequestOwners: async (requestIds) =>
                    requestIds.map((requestId) => ({
                        accountId: requestId.replace('request', 'account'),
                        requestId,
                    })),
                getDeliveryAccountContacts: async (accountIds) =>
                    accountIds.map((accountId) => ({
                        accountId,
                        avatarUrl: null,
                        displayName: 'Customer',
                        id: `user:${accountId}`,
                        role: 'user',
                        userName: `${accountId}@example.test`,
                    })),
                createNotificationWithOutcome: async (notification) => {
                    if (notification.accountId === 'account-2') {
                        throw new Error('one write failed');
                    }
                    publishedAccountIds.push(notification.accountId);
                    return {
                        notificationId: `notification:${notification.accountId}`,
                        outcome: 'created',
                    };
                },
            },
        ),
    );

    assert.deepEqual(result, [
        {
            notificationId: 'notification:account-1',
            notificationIds: ['notification:account-1'],
            outcome: 'published',
        },
        { outcome: 'failed' },
        {
            notificationId: 'notification:account-3',
            notificationIds: ['notification:account-3'],
            outcome: 'published',
        },
    ]);
    assert.deepEqual(publishedAccountIds.sort(), ['account-1', 'account-3']);
});
