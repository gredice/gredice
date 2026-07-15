import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    DeliveryRouteStepSummary,
    DeliveryStopSummary,
    DriverDeliveryDashboard,
} from './deliveryDashboardTypes';
import {
    clearOtherOfflineRouteCacheScopes,
    createBrowserOfflineRouteCachePersistence,
    createIndexedDbOfflineRouteCachePersistence,
    createMemoryOfflineRouteCachePersistence,
    createOfflineRouteSnapshot,
    type OfflineRouteSnapshot,
    offlineRouteCacheTtlMs,
    offlineRouteCacheVersion,
    parseOfflineRouteSnapshot,
} from './offlineRouteCache';

const now = new Date('2026-07-15T12:00:00.000Z');

type DeliveryStep = Extract<DeliveryRouteStepSummary, { kind: 'delivery' }>;
type PickupStep = Extract<DeliveryRouteStepSummary, { kind: 'pickup' }>;

function harvest(marker: string) {
    return {
        plantName: `${marker} plant`,
        operationName: `${marker} OPERATION_NAME_PRIVATE`,
        raisedBedName: `${marker} raised bed`,
        fieldName: `${marker} field`,
        tracePath: `/trag/${marker.padEnd(16, 'x')}`,
    };
}

function deliveryStep({
    actionState,
    id,
    marker,
}: {
    actionState: DeliveryStep['actionState'];
    id: number;
    marker: string;
}): DeliveryStep {
    const stopState = actionState === 'completed' ? 'delivered' : 'pending';
    const stop: DeliveryStopSummary = {
        id,
        requestId: `${marker}-request`,
        sequence: id,
        stopState,
        requestState: stopState,
        statusLabel: actionState === 'completed' ? 'Dostavljeno' : 'U dostavi',
        isCurrent: actionState === 'current',
        contactName: `${marker} contact`,
        phone: `+38599${String(id).padStart(6, '0')}`,
        address: `${marker} door address`,
        addressLabel: `${marker} ADDRESS_LABEL_PRIVATE`,
        requestNotes: `${marker} essential door note`,
        deliveryNotes: `${marker} DELIVERY_NOTES_PRIVATE`,
        slotStartAt: '2026-07-15T12:30:00.000Z',
        slotEndAt: '2026-07-15T13:30:00.000Z',
        estimatedArrivalAt: '2026-07-15T12:45:00.000Z',
        estimatedTravelSeconds: 900,
        estimatedDistanceMeters: 4_200,
        reroutePending: false,
        arrivedAt: null,
        deliveredAt:
            actionState === 'completed' ? '2026-07-15T12:40:00.000Z' : null,
        harvest: harvest(marker),
        recovery: null,
        tracking: null,
        runId: 'run-one',
        deliveryCount: 1,
        deliveries: [
            {
                stopId: id,
                stopState,
                requestId: `${marker}-request`,
                requestState: stopState,
                contactName: `${marker} contact`,
                phone: `+38599${String(id).padStart(6, '0')}`,
                addressLabel: `${marker} ITEM_ADDRESS_LABEL_PRIVATE`,
                requestNotes: `${marker} essential door note`,
                deliveryNotes: `${marker} ITEM_DELIVERY_NOTES_PRIVATE`,
                harvest: harvest(marker),
                exception: {
                    outcome: 'deferred',
                    reason: 'customer-unavailable',
                    note: `${marker} EXCEPTION_NOTE_PRIVATE`,
                    occurredAt: '2026-07-15T12:35:00.000Z',
                },
            },
        ],
    };
    return {
        kind: 'delivery',
        itinerarySequence: id,
        retryLaneRank: null,
        retryAttempt: 0,
        actionState,
        lockedReason:
            actionState === 'locked' ? 'Čeka prethodnu stanicu' : null,
        stop,
    };
}

function pickupStep({
    actionState = 'locked',
    marker = 'NEXT_PICKUP',
}: {
    actionState?: PickupStep['actionState'];
    marker?: string;
} = {}): PickupStep {
    return {
        kind: 'pickup',
        itinerarySequence: 3,
        actionState,
        pickup: {
            id: `${marker}-node`,
            pickupLocationId: 17,
            sequence: 1,
            itinerarySequence: 3,
            name: `${marker} pickup name`,
            address: `${marker} pickup address`,
            estimatedArrivalAt: '2026-07-15T13:00:00.000Z',
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 3_100,
            serviceDurationSeconds: 300,
            state: 'pending',
            isCurrent: actionState === 'current',
            expectedCount: 1,
            scannedCount: 0,
            missingLabelCount: 0,
            notReadyCount: 0,
            remainingCount: 1,
            manifests: [
                {
                    id: `${marker}-manifest`,
                    timeSlotId: 12,
                    startAt: '2026-07-15T13:00:00.000Z',
                    endAt: '2026-07-15T14:00:00.000Z',
                    state: 'pending',
                    confirmedAt: null,
                    expectedCount: 1,
                    scannedCount: 0,
                    missingLabelCount: 0,
                    notReadyCount: 0,
                    remainingCount: 1,
                    items: [
                        {
                            id: `${marker}-item`,
                            stopId: 31,
                            requestId: `${marker}-request`,
                            stopKey: `${marker}-stop-key`,
                            state: 'ready',
                            resolvedAt: null,
                            tracePath: `/trag/${marker.padEnd(16, 'x')}`,
                            harvest: harvest(marker),
                        },
                    ],
                },
            ],
        },
    };
}

function dashboard({
    runId = 'run-one',
    userId = 'driver-one',
}: {
    runId?: string;
    userId?: string;
} = {}): DriverDeliveryDashboard {
    const completed = deliveryStep({
        actionState: 'completed',
        id: 10,
        marker: 'COMPLETED_PRIVATE',
    });
    const current = deliveryStep({
        actionState: 'current',
        id: 20,
        marker: 'CURRENT_ESSENTIAL',
    });
    const completedBetween = deliveryStep({
        actionState: 'completed',
        id: 25,
        marker: 'COMPLETED_BETWEEN_PRIVATE',
    });
    const next = pickupStep();
    const later = deliveryStep({
        actionState: 'locked',
        id: 40,
        marker: 'LATER_PRIVATE',
    });
    const userWithPrivateFields = {
        id: userId,
        displayName: 'Driver Visible',
        role: 'driver',
        email: 'EMAIL_PRIVATE@example.test',
        avatarUrl: 'AVATAR_URL_PRIVATE',
    };
    const runWithPrivateFields = {
        id: runId,
        state: 'active',
        startedAt: '2026-07-15T11:00:00.000Z',
        completedAt: null,
        totalDistanceMeters: 12_000,
        totalDurationSeconds: 3_600,
        routePlanVersion: 2,
        routeRevision: 7,
        reroutePending: false,
        estimateSource: 'google' as const,
        tracking: {
            status: 'live' as const,
            lastAcceptedAt: '2026-07-15T11:59:00.000Z',
            mapAvailable: true,
        },
        location: {
            latitude: 45.815_399,
            longitude: 15.966_568,
            accuracy: 4,
            heading: 180,
            speed: 8,
            capturedAt: '2026-07-15T11:59:00.000Z',
            acceptedAt: '2026-07-15T11:59:01.000Z',
            gpsCanary: 'GPS_PRIVATE',
        },
        estimatesUpdatedAt: '2026-07-15T11:58:00.000Z',
        mapUrl: 'https://maps.example/MAP_URL_PRIVATE',
        deliveryCount: 4,
        stops: [completed.stop, current.stop, later.stop],
        routeSteps: [completed, current, completedBetween, next, later],
    };
    return {
        kind: 'driver',
        user: userWithPrivateFields,
        activeRun: runWithPrivateFields,
        batches: [
            {
                slotId: 99,
                startAt: '2026-07-16T10:00:00.000Z',
                endAt: '2026-07-16T11:00:00.000Z',
                pickupLocationId: 1,
                pickupLocationName: 'BATCH_PRIVATE',
                pickupAddress: 'BATCH_ADDRESS_PRIVATE',
                deliveryCount: 1,
                stopCount: 1,
                orders: [
                    {
                        requestId: 'BATCH_REQUEST_PRIVATE',
                        stopKey: 'BATCH_STOP_PRIVATE',
                        readyForPickup: true,
                        pickupStatusLabel: 'Spremno',
                        contactName: 'BATCH_CONTACT_PRIVATE',
                        address: 'BATCH_DOOR_PRIVATE',
                        addressLabel: 'BATCH_LABEL_PRIVATE',
                        requestNotes: 'BATCH_NOTE_PRIVATE',
                        harvest: harvest('BATCH_PRIVATE'),
                    },
                ],
            },
        ],
        maximumRouteStops: 10,
        maximumRouteWindowHours: 12,
        refreshedAt: '2026-07-15T12:00:00.000Z',
    };
}

function snapshot(input = dashboard()) {
    const result = createOfflineRouteSnapshot({
        authenticatedUserId: input.user.id,
        dashboard: input,
        now,
    });
    assert.ok(result);
    return result;
}

function jsonRecord(value: unknown): Record<string, unknown> {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    assert.ok(isRecord(parsed));
    return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function record(value: unknown): Record<string, unknown> {
    assert.ok(isRecord(value));
    return value;
}

function firstStep(value: Record<string, unknown>) {
    assert.ok(Array.isArray(value.steps));
    return record(value.steps[0]);
}

test('projects only the current and immediate next non-completed route steps', () => {
    const result = snapshot();

    assert.deepEqual(
        result.steps.map((step) => [step.kind, step.actionState]),
        [
            ['delivery', 'current'],
            ['pickup', 'locked'],
        ],
    );
    assert.equal(result.scope.userId, 'driver-one');
    assert.equal(result.scope.runId, 'run-one');
    assert.equal(result.source.routeRevision, 7);
    assert.equal(
        Date.parse(result.expiresAt) - Date.parse(result.cachedAt),
        offlineRouteCacheTtlMs,
    );

    const current = result.steps[0];
    assert.equal(current?.kind, 'delivery');
    if (current?.kind === 'delivery') {
        assert.equal(current.address, 'CURRENT_ESSENTIAL door address');
        assert.equal(
            current.items[0]?.contactName,
            'CURRENT_ESSENTIAL contact',
        );
        assert.equal(
            current.items[0]?.requestNotes,
            'CURRENT_ESSENTIAL essential door note',
        );
    }
    const next = result.steps[1];
    assert.equal(next?.kind, 'pickup');
    if (next?.kind === 'pickup') {
        assert.equal(next.name, 'NEXT_PICKUP pickup name');
        assert.equal(next.address, 'NEXT_PICKUP pickup address');
        assert.equal(next.items[0]?.manifestId, 'NEXT_PICKUP-manifest');
    }
});

test('serialized projection is an allowlist and excludes privacy canaries', () => {
    const serialized = JSON.stringify(snapshot());
    const excludedValues = [
        'EMAIL_PRIVATE',
        'AVATAR_URL_PRIVATE',
        'GPS_PRIVATE',
        'MAP_URL_PRIVATE',
        'COMPLETED_PRIVATE',
        'COMPLETED_BETWEEN_PRIVATE',
        'LATER_PRIVATE',
        'DELIVERY_NOTES_PRIVATE',
        'EXCEPTION_NOTE_PRIVATE',
        'OPERATION_NAME_PRIVATE',
        'ADDRESS_LABEL_PRIVATE',
        'BATCH_PRIVATE',
    ];
    for (const canary of excludedValues) {
        assert.equal(serialized.includes(canary), false, canary);
    }
    for (const forbiddenKey of [
        'email',
        'avatarUrl',
        'location',
        'latitude',
        'longitude',
        'tracking',
        'mapUrl',
        'batches',
        'deliveryNotes',
        'operationName',
        'addressLabel',
    ]) {
        assert.equal(serialized.includes(`"${forbiddenKey}"`), false);
    }
    assert.match(serialized, /CURRENT_ESSENTIAL/);
    assert.match(serialized, /NEXT_PICKUP/);
});

test('parser validates every cached nullable time as a timestamp', () => {
    for (const key of [
        'estimatedArrivalAt',
        'slotStartAt',
        'slotEndAt',
        'arrivedAt',
        'deliveredAt',
    ]) {
        const raw = jsonRecord(snapshot());
        firstStep(raw)[key] = 'not-a-timestamp';
        assert.equal(
            parseOfflineRouteSnapshot(raw, {
                userId: 'driver-one',
                runId: 'run-one',
                now,
            }),
            null,
            key,
        );
    }

    const nullable = jsonRecord(snapshot());
    const step = firstStep(nullable);
    for (const key of [
        'estimatedArrivalAt',
        'slotStartAt',
        'slotEndAt',
        'arrivedAt',
        'deliveredAt',
    ]) {
        step[key] = null;
    }
    assert.ok(
        parseOfflineRouteSnapshot(nullable, {
            userId: 'driver-one',
            runId: 'run-one',
            now,
        }),
    );

    const invalidExceptionTime = jsonRecord(snapshot());
    const delivery = firstStep(invalidExceptionTime);
    assert.ok(Array.isArray(delivery.items));
    const item = record(delivery.items[0]);
    const exception = record(item.exception);
    exception.occurredAt = 'tomorrow-ish';
    assert.equal(
        parseOfflineRouteSnapshot(invalidExceptionTime, {
            userId: 'driver-one',
            runId: 'run-one',
            now,
        }),
        null,
    );
});

test('parser enforces positive bounded lifetime and expiry', () => {
    const result = snapshot();
    assert.ok(
        parseOfflineRouteSnapshot(result, {
            userId: 'driver-one',
            runId: 'run-one',
            now,
        }),
    );

    const nonPositive = jsonRecord(result);
    nonPositive.expiresAt = result.cachedAt;
    assert.equal(
        parseOfflineRouteSnapshot(nonPositive, {
            userId: 'driver-one',
            now,
        }),
        null,
    );

    const tooLong = jsonRecord(result);
    tooLong.expiresAt = new Date(
        Date.parse(result.cachedAt) + offlineRouteCacheTtlMs + 1,
    ).toISOString();
    assert.equal(
        parseOfflineRouteSnapshot(tooLong, {
            userId: 'driver-one',
            now,
        }),
        null,
    );

    assert.equal(
        parseOfflineRouteSnapshot(result, {
            userId: 'driver-one',
            now: new Date(result.expiresAt),
        }),
        null,
    );
});

test('memory persistence survives recreation with shared backing and clones values', async () => {
    const backing = new Map<string, unknown>();
    const first = createMemoryOfflineRouteCachePersistence(backing);
    const result = snapshot();
    await first.save(result);

    const loaded = await first.load({
        userId: 'driver-one',
        runId: 'run-one',
        now,
    });
    assert.ok(loaded);
    loaded.steps[0] = { ...loaded.steps[0], address: 'mutated in caller' };

    const recreated = createMemoryOfflineRouteCachePersistence(backing);
    const restored = await recreated.load({
        userId: 'driver-one',
        runId: 'run-one',
        now,
    });
    assert.equal(restored?.steps[0]?.address, 'CURRENT_ESSENTIAL door address');
});

test('load purges expired, versioned, malformed, and extra-field records', async () => {
    const backing = new Map<string, unknown>();
    const persistence = createMemoryOfflineRouteCachePersistence(backing);
    const result = snapshot();

    await persistence.save(result);
    assert.equal(
        await persistence.load({
            userId: 'driver-one',
            now: new Date(result.expiresAt),
        }),
        null,
    );
    assert.equal(backing.has('driver-one'), false);

    const wrongVersion = jsonRecord(result);
    wrongVersion.version = offlineRouteCacheVersion + 1;
    backing.set('driver-one', wrongVersion);
    assert.equal(await persistence.load({ userId: 'driver-one', now }), null);
    assert.equal(backing.has('driver-one'), false);

    const malformed = jsonRecord(result);
    malformed.cachedAt = 'invalid';
    backing.set('driver-one', malformed);
    assert.equal(await persistence.load({ userId: 'driver-one', now }), null);
    assert.equal(backing.has('driver-one'), false);

    const extraPrivateField = jsonRecord(result);
    extraPrivateField.email = 'must-not-survive@example.test';
    backing.set('driver-one', extraPrivateField);
    assert.equal(await persistence.load({ userId: 'driver-one', now }), null);
    assert.equal(backing.has('driver-one'), false);
});

test('user and run scopes cannot read or clear each other', async () => {
    const backing = new Map<string, unknown>();
    const persistence = createMemoryOfflineRouteCachePersistence(backing);
    const runOne = snapshot();
    await persistence.save(runOne);

    assert.equal(await persistence.load({ userId: 'driver-two', now }), null);
    assert.equal(backing.has('driver-one'), true);
    assert.equal(
        await persistence.load({
            userId: 'driver-one',
            runId: 'run-two',
            now,
        }),
        null,
    );
    assert.equal(backing.has('driver-one'), true);

    const runTwo = snapshot(dashboard({ runId: 'run-two' }));
    await persistence.save(runTwo);
    await persistence.clear({ userId: 'driver-one', runId: 'run-one' });
    assert.ok(
        await persistence.load({
            userId: 'driver-one',
            runId: 'run-two',
            now,
        }),
    );
    await persistence.clear({ userId: 'driver-one', runId: 'run-two' });
    assert.equal(backing.has('driver-one'), false);
});

test('old-run pruning clears a stale route before preserving the active run', async () => {
    const backing = new Map<string, unknown>();
    const persistence = createMemoryOfflineRouteCachePersistence(backing);
    await persistence.save(snapshot());

    await clearOtherOfflineRouteCacheScopes(persistence, {
        userId: 'driver-one',
        activeRunId: 'run-two',
    });
    assert.equal(await persistence.load({ userId: 'driver-one', now }), null);

    const active = snapshot(dashboard({ runId: 'run-two' }));
    await persistence.save(active);
    await clearOtherOfflineRouteCacheScopes(persistence, {
        userId: 'driver-one',
        activeRunId: 'run-two',
    });
    assert.deepEqual(
        await persistence.load({ userId: 'driver-one', now }),
        active,
    );
});

test('old-run pruning keeps action cleanup blocked after route storage degradation', async () => {
    const persistence = createIndexedDbOfflineRouteCachePersistence({
        open() {
            throw new Error('IndexedDB denied');
        },
    });
    const stale = snapshot();
    await persistence.save(stale);

    await assert.rejects(
        clearOtherOfflineRouteCacheScopes(persistence, {
            userId: 'driver-one',
            activeRunId: 'run-two',
        }),
        /Durable offline route cleanup could not be confirmed/,
    );
    assert.deepEqual(
        await persistence.load({ userId: 'driver-one', now }),
        stale,
    );
});

test('clear uses raw scope even when TTL or version data is corrupt', async () => {
    const backing = new Map<string, unknown>();
    const persistence = createMemoryOfflineRouteCachePersistence(backing);
    backing.set('driver-one', {
        version: 999,
        scope: { userId: 'driver-one', runId: 'run-one' },
        cachedAt: 'corrupt',
        expiresAt: 'corrupt',
    });

    await persistence.clear({ userId: 'driver-one', runId: 'run-two' });
    assert.equal(backing.has('driver-one'), true);
    await persistence.clear({ userId: 'driver-one', runId: 'run-one' });
    assert.equal(backing.has('driver-one'), false);

    backing.set('driver-one', { entirely: 'corrupt' });
    await persistence.clear({ userId: 'driver-one' });
    assert.equal(backing.has('driver-one'), false);

    backing.set('driver-one', { entirely: 'corrupt-again' });
    await persistence.clearUser('driver-one');
    assert.equal(backing.has('driver-one'), false);
});

test('invalid snapshots are rejected on save', async () => {
    const persistence = createMemoryOfflineRouteCachePersistence();
    const result = snapshot();
    const invalid: OfflineRouteSnapshot = {
        ...result,
        expiresAt: result.cachedAt,
    };
    await assert.rejects(
        persistence.save(invalid),
        /Offline route snapshot is invalid/,
    );
});

test('IndexedDB open failure falls back to the mirrored memory cache', async () => {
    const persistence = createIndexedDbOfflineRouteCachePersistence({
        open() {
            throw new Error('IndexedDB denied');
        },
    });
    const result = snapshot();

    assert.equal(persistence.durability, 'durable');
    await persistence.save(result);
    assert.equal(persistence.durability, 'memory');
    assert.deepEqual(
        await persistence.load({
            userId: 'driver-one',
            runId: 'run-one',
            now,
        }),
        result,
    );
    await assert.rejects(
        persistence.clear({ userId: 'driver-one', runId: 'run-one' }),
        /Durable offline route cleanup could not be confirmed/,
    );
    assert.deepEqual(
        await persistence.load({
            userId: 'driver-one',
            runId: 'run-one',
            now,
        }),
        result,
    );
});

test('browser factory is a memory cache when IndexedDB is unavailable', () => {
    const persistence = createBrowserOfflineRouteCachePersistence();
    assert.equal(persistence.durability, 'memory');
});

test('projection declines inactive shapes without a current step', () => {
    const withoutRun = dashboard();
    withoutRun.activeRun = null;
    assert.equal(
        createOfflineRouteSnapshot({
            authenticatedUserId: 'driver-one',
            dashboard: withoutRun,
            now,
        }),
        null,
    );

    const withoutCurrent = dashboard();
    assert.ok(withoutCurrent.activeRun);
    withoutCurrent.activeRun.routeSteps =
        withoutCurrent.activeRun.routeSteps.map((step) => ({
            ...step,
            actionState: 'completed',
        }));
    assert.equal(
        createOfflineRouteSnapshot({
            authenticatedUserId: 'driver-one',
            dashboard: withoutCurrent,
            now,
        }),
        null,
    );
    assert.equal(
        createOfflineRouteSnapshot({
            authenticatedUserId: 'driver-one',
            dashboard: dashboard(),
            now: new Date('invalid'),
        }),
        null,
    );
    assert.equal(
        createOfflineRouteSnapshot({
            authenticatedUserId: 'another-driver',
            dashboard: dashboard(),
            now,
        }),
        null,
    );
});
