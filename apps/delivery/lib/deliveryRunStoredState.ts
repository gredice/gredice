import {
    createBrowserDeliveryActionQueuePersistence,
    type DeliveryActionQueuePersistence,
} from './deliveryActionQueue';
import {
    createWebStorageDeliveryHandoffManifestCachePersistence,
    type DeliveryHandoffManifestCachePersistence,
} from './deliveryHandoffManifestCache';
import {
    createBrowserOfflineRouteCachePersistence,
    type OfflineRouteCachePersistence,
} from './offlineRouteCache';
import {
    createWebStoragePickupManifestQueuePersistence,
    type PickupManifestQueuePersistence,
} from './pickupManifestQueue';

export type DeliveryRunSupportingStores = {
    pickupManifest: PickupManifestQueuePersistence;
    offlineRoute: OfflineRouteCachePersistence;
    handoffManifest: DeliveryHandoffManifestCachePersistence;
};

export type DeliveryUserStoredState = DeliveryRunSupportingStores & {
    deliveryActions: DeliveryActionQueuePersistence;
};

export function createBrowserDeliveryRunSupportingStores(): DeliveryRunSupportingStores {
    return {
        pickupManifest: createWebStoragePickupManifestQueuePersistence(
            window.localStorage,
        ),
        offlineRoute: createBrowserOfflineRouteCachePersistence(),
        handoffManifest:
            createWebStorageDeliveryHandoffManifestCachePersistence(
                window.localStorage,
            ),
    };
}

export function createBrowserDeliveryUserStoredState(): DeliveryUserStoredState {
    return {
        ...createBrowserDeliveryRunSupportingStores(),
        deliveryActions: createBrowserDeliveryActionQueuePersistence(),
    };
}

async function clearStoreDurably(
    persistence: {
        readonly durability: 'durable' | 'memory';
        readonly durableCleanupRequired?: boolean;
    },
    clear: () => Promise<void>,
) {
    const requiredDurability =
        persistence.durableCleanupRequired ??
        persistence.durability === 'durable';
    await clear();
    if (requiredDurability && persistence.durability !== 'durable') {
        throw new Error('Durable delivery cleanup could not be confirmed');
    }
}

export async function clearDeliveryRunSupportingStores(
    stores: DeliveryRunSupportingStores,
    scope: { userId: string; runId: string },
) {
    const results = await Promise.allSettled([
        clearStoreDurably(stores.pickupManifest, async () =>
            stores.pickupManifest.clear(scope),
        ),
        clearStoreDurably(stores.offlineRoute, async () =>
            stores.offlineRoute.clear(scope),
        ),
        clearStoreDurably(stores.handoffManifest, async () =>
            stores.handoffManifest.clear(scope),
        ),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
        throw new Error('Durable delivery cleanup could not be confirmed');
    }
}

export async function clearDeliveryUserStoredState(
    stores: DeliveryUserStoredState,
    scope: { userId: string; runId?: string },
) {
    const supportingResults = await Promise.allSettled([
        clearStoreDurably(stores.pickupManifest, async () =>
            stores.pickupManifest.clear(scope),
        ),
        clearStoreDurably(stores.offlineRoute, async () =>
            stores.offlineRoute.clear(scope),
        ),
        clearStoreDurably(stores.handoffManifest, async () =>
            stores.handoffManifest.clear(scope),
        ),
    ]);
    if (supportingResults.some((result) => result.status === 'rejected')) {
        throw new Error('Durable delivery cleanup could not be confirmed');
    }
    await clearStoreDurably(stores.deliveryActions, async () =>
        stores.deliveryActions.clear(scope),
    );
}

export async function finalizeDeliveryRunStoredState({
    clearSupportingStores,
    clearActionMarker,
    publishCompleted,
}: {
    clearSupportingStores: () => Promise<void>;
    clearActionMarker: () => Promise<void>;
    publishCompleted: () => void;
}) {
    await clearSupportingStores();
    await clearActionMarker();
    publishCompleted();
}
