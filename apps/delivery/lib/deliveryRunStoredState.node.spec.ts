import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryDeliveryActionQueuePersistence } from './deliveryActionQueue';
import type { DeliveryHandoffManifest } from './deliveryHandoffManifest';
import {
    createDeliveryHandoffManifestCacheRecord,
    createMemoryDeliveryHandoffManifestCachePersistence,
} from './deliveryHandoffManifestCache';
import {
    clearDeliveryRunSupportingStores,
    clearDeliveryUserStoredState,
    type DeliveryRunSupportingStores,
    finalizeDeliveryRunStoredState,
} from './deliveryRunStoredState';
import {
    createMemoryOfflineRouteCachePersistence,
    type OfflineRouteSnapshot,
} from './offlineRouteCache';
import { createMemoryPickupManifestQueuePersistence } from './pickupManifestQueue';

const now = '2026-07-15T12:00:00.000Z';
const scope = { userId: 'driver-cleanup', runId: 'run-completed' };

function offlineSnapshot(): OfflineRouteSnapshot {
    return {
        version: 1,
        scope,
        source: {
            routeRevision: 4,
            refreshedAt: now,
            reroutePending: false,
        },
        cachedAt: now,
        expiresAt: '2026-07-16T12:00:00.000Z',
        steps: [
            {
                kind: 'delivery',
                id: 101,
                itinerarySequence: 1,
                actionState: 'current',
                address: 'Ilica 101, Zagreb',
                estimatedArrivalAt: null,
                estimatedTravelSeconds: null,
                estimatedDistanceMeters: null,
                stopState: 'arrived',
                statusLabel: 'Vozač je stigao',
                slotStartAt: null,
                slotEndAt: null,
                arrivedAt: now,
                deliveredAt: null,
                retryLaneRank: null,
                retryAttempt: 0,
                lockedReason: null,
                items: [
                    {
                        stopId: 101,
                        requestId: 'request-cleanup',
                        stopState: 'arrived',
                        requestState: 'in_delivery',
                        contactName: 'Kontakt za brisanje',
                        phone: '+385990000000',
                        requestNotes: 'Obriši nakon završetka',
                        harvest: {
                            plantName: 'Rajčica',
                            raisedBedName: 'Gredica A',
                            fieldName: null,
                            tracePath: '/trag/cleanup-trace-0001',
                        },
                        exception: null,
                    },
                ],
            },
        ],
    };
}

function handoffManifest(runId = scope.runId): DeliveryHandoffManifest {
    return {
        runId,
        targetStopId: 101,
        version: 1,
        retryAttempt: 0,
        items: [
            {
                stopId: 101,
                deliveryRequestId: 'request-cleanup',
                retryAttempt: 0,
                traceLinkId: 501,
                qrAvailable: true,
                state: 'unverified',
                reason: null,
                verifiedAt: null,
            },
        ],
        expectedCount: 1,
        scannedCount: 0,
        unverifiedCount: 1,
        noLabelCount: 0,
        missingCount: 0,
        skippedCount: 0,
    };
}

test('completion cleanup removes exact pickup and route stores but preserves another run', async () => {
    const pickupManifest = createMemoryPickupManifestQueuePersistence();
    const offlineRoute = createMemoryOfflineRouteCachePersistence();
    const handoffManifestCache =
        createMemoryDeliveryHandoffManifestCachePersistence();
    const otherScope = { userId: scope.userId, runId: 'run-other' };
    await pickupManifest.save(scope, []);
    await pickupManifest.save(otherScope, []);
    await offlineRoute.save(offlineSnapshot());
    const currentHandoff = createDeliveryHandoffManifestCacheRecord({
        userId: scope.userId,
        manifest: handoffManifest(),
        now: new Date(now),
    });
    const otherHandoff = createDeliveryHandoffManifestCacheRecord({
        userId: scope.userId,
        manifest: handoffManifest(otherScope.runId),
        now: new Date(now),
    });
    await handoffManifestCache.save(currentHandoff);
    await handoffManifestCache.save(otherHandoff);

    await clearDeliveryRunSupportingStores(
        {
            pickupManifest,
            offlineRoute,
            handoffManifest: handoffManifestCache,
        },
        scope,
    );

    assert.equal(await pickupManifest.load(scope), undefined);
    assert.notEqual(await pickupManifest.load(otherScope), undefined);
    assert.equal(await offlineRoute.load(scope), null);
    assert.equal(
        await handoffManifestCache.load(currentHandoff.scope, new Date(now)),
        null,
    );
    assert.ok(
        await handoffManifestCache.load(otherHandoff.scope, new Date(now)),
    );
});

test('user cleanup removes pickup, route, and action data together', async () => {
    const pickupManifest = createMemoryPickupManifestQueuePersistence();
    const offlineRoute = createMemoryOfflineRouteCachePersistence();
    const handoffManifestCache =
        createMemoryDeliveryHandoffManifestCachePersistence();
    const deliveryActions = createMemoryDeliveryActionQueuePersistence();
    await pickupManifest.save(scope, []);
    await offlineRoute.save(offlineSnapshot());
    await deliveryActions.save(scope, []);
    const handoff = createDeliveryHandoffManifestCacheRecord({
        userId: scope.userId,
        manifest: handoffManifest(),
        now: new Date(now),
    });
    await handoffManifestCache.save(handoff);

    await clearDeliveryUserStoredState(
        {
            pickupManifest,
            offlineRoute,
            handoffManifest: handoffManifestCache,
            deliveryActions,
        },
        { userId: scope.userId },
    );

    assert.equal(await pickupManifest.load(scope), undefined);
    assert.equal(await offlineRoute.load(scope), null);
    assert.equal(
        await handoffManifestCache.load(handoff.scope, new Date(now)),
        null,
    );
    assert.equal(await deliveryActions.load(scope), undefined);
});

test('user cleanup retains the action marker until every supporting store is cleared', async () => {
    let actionClearCalled = false;
    const stores = {
        pickupManifest: createMemoryPickupManifestQueuePersistence(),
        offlineRoute: {
            ...createMemoryOfflineRouteCachePersistence(),
            async clear() {
                throw new Error('route cleanup failed');
            },
        },
        handoffManifest: createMemoryDeliveryHandoffManifestCachePersistence(),
        deliveryActions: {
            ...createMemoryDeliveryActionQueuePersistence(),
            async clear() {
                actionClearCalled = true;
            },
        },
    };

    await assert.rejects(
        clearDeliveryUserStoredState(stores, { userId: scope.userId }),
        /Durable delivery cleanup could not be confirmed/,
    );
    assert.equal(actionClearCalled, false);
});

test('completion marker must remain when a formerly durable store cannot confirm deletion', async () => {
    let pickupDurability: 'durable' | 'memory' = 'durable';
    const stores: DeliveryRunSupportingStores = {
        pickupManifest: {
            get durability() {
                return pickupDurability;
            },
            async load() {
                return undefined;
            },
            async save() {},
            async clear() {
                pickupDurability = 'memory';
            },
        },
        offlineRoute: createMemoryOfflineRouteCachePersistence(),
        handoffManifest: createMemoryDeliveryHandoffManifestCachePersistence(),
    };

    await assert.rejects(
        clearDeliveryRunSupportingStores(stores, scope),
        /Durable delivery cleanup could not be confirmed/,
    );
});

test('completion marker must remain when a degraded store may still have an older durable copy', async () => {
    const stores: DeliveryRunSupportingStores = {
        pickupManifest: {
            durability: 'memory',
            durableCleanupRequired: true,
            async load() {
                return undefined;
            },
            async save() {},
            async clear() {},
        },
        offlineRoute: createMemoryOfflineRouteCachePersistence(),
        handoffManifest: createMemoryDeliveryHandoffManifestCachePersistence(),
    };

    await assert.rejects(
        clearDeliveryRunSupportingStores(stores, scope),
        /Durable delivery cleanup could not be confirmed/,
    );
});

test('completion is published only after supporting data and the durable marker are cleared', async () => {
    const events: string[] = [];
    await finalizeDeliveryRunStoredState({
        clearSupportingStores: async () => {
            events.push('supporting-cleared');
        },
        clearActionMarker: async () => {
            events.push('marker-cleared');
        },
        publishCompleted: () => events.push('published'),
    });
    assert.deepEqual(events, [
        'supporting-cleared',
        'marker-cleared',
        'published',
    ]);

    await assert.rejects(
        finalizeDeliveryRunStoredState({
            clearSupportingStores: async () => {
                throw new Error('cleanup failed');
            },
            clearActionMarker: async () => {
                events.push('unexpected-marker-clear');
            },
            publishCompleted: () => events.push('unexpected-publish'),
        }),
        /cleanup failed/,
    );
    assert.equal(events.includes('unexpected-marker-clear'), false);
    assert.equal(events.includes('unexpected-publish'), false);
});
