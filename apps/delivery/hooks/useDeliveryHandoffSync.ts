'use client';

import type { DeliveryRunHandoffSkipReason } from '@gredice/storage';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import type { DeliveryActionQueueSnapshot } from '../lib/deliveryActionQueue';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import {
    type DeliveryHandoffManifestFetchResult,
    fetchDeliveryHandoffManifest,
} from '../lib/deliveryHandoffManifest';
import {
    createMemoryDeliveryHandoffManifestCachePersistence,
    createWebStorageDeliveryHandoffManifestCachePersistence,
} from '../lib/deliveryHandoffManifestCache';
import {
    type DeliveryHandoffActionSyncAdapter,
    type DeliveryHandoffFeedback,
    type DeliveryHandoffManifestView,
    DeliveryHandoffSyncController,
    type DeliveryHandoffSyncStatus,
    type DeliveryHandoffTarget,
    deliveryHandoffDeliveriesFingerprint,
    type HarvestTraceScanFailureResult,
} from '../lib/deliveryHandoffSyncController';
import type { DriverCommandResult } from '../lib/driverCommandResult';
import type { HarvestTraceVerificationResult } from '../lib/harvestTraceScan';

export type UseDeliveryHandoffSyncResult = {
    handoff: DeliveryHandoffManifestView | null;
    status: DeliveryHandoffSyncStatus;
    error: string | null;
    feedback: readonly DeliveryHandoffFeedback[];
    scan: (
        value: string,
    ) => Promise<
        HarvestTraceVerificationResult | HarvestTraceScanFailureResult
    >;
    markItem: (input: {
        itemStopId: number;
        outcome: 'no-label' | 'missing' | 'skipped';
        reason?: DeliveryRunHandoffSkipReason;
    }) => Promise<DriverCommandResult>;
    markRemainingReviewed: () => Promise<DriverCommandResult>;
    refresh: () => Promise<boolean>;
};

type DeliveryHandoffActionSync = DeliveryHandoffActionSyncAdapter & {
    snapshot: DeliveryActionQueueSnapshot;
};

function browserHandoffManifestCache() {
    if (typeof window === 'undefined') {
        return createMemoryDeliveryHandoffManifestCachePersistence();
    }
    try {
        return createWebStorageDeliveryHandoffManifestCachePersistence(
            window.localStorage,
        );
    } catch {
        return {
            ...createMemoryDeliveryHandoffManifestCachePersistence(),
            durableCleanupRequired: true,
        };
    }
}

function browserIsOnline() {
    return typeof navigator === 'undefined' || navigator.onLine;
}

export function useDeliveryHandoffSync({
    userId,
    runId,
    target,
    deliveries,
    actionSync,
}: {
    userId: string;
    runId: string;
    target: DeliveryHandoffTarget | null;
    deliveries: readonly DeliveryStopDeliverySummary[];
    actionSync: DeliveryHandoffActionSync;
}): UseDeliveryHandoffSyncResult {
    const actionSyncScopesRef = useRef(
        new Map<string, { current: DeliveryHandoffActionSync }>(),
    );
    const actionSyncScopeKey = JSON.stringify([userId, runId]);
    const existingActionSyncRef =
        actionSyncScopesRef.current.get(actionSyncScopeKey);
    const actionSyncRef = existingActionSyncRef ?? { current: actionSync };
    if (!existingActionSyncRef) {
        actionSyncScopesRef.current.set(actionSyncScopeKey, actionSyncRef);
    }
    actionSyncRef.current = actionSync;

    const actions = useMemo<DeliveryHandoffActionSyncAdapter>(
        () => ({
            getSnapshot: () => actionSyncRef.current.getSnapshot(),
            syncNow: async () => await actionSyncRef.current.syncNow(),
            enqueueVerificationScan: async (
                targetStopId,
                tracePath,
                expectedRetryAttempt,
            ) =>
                await actionSyncRef.current.enqueueVerificationScan(
                    targetStopId,
                    tracePath,
                    expectedRetryAttempt,
                ),
            enqueueVerificationMark: async (input) =>
                await actionSyncRef.current.enqueueVerificationMark(input),
            completeHandoffReconciliation: async (
                targetStopId,
                expectedRetryAttempt,
                operationIds,
            ) =>
                await actionSyncRef.current.completeHandoffReconciliation(
                    targetStopId,
                    expectedRetryAttempt,
                    operationIds,
                ),
        }),
        [actionSyncRef],
    );
    const cache = useMemo(browserHandoffManifestCache, []);
    const controller = useMemo(
        () =>
            new DeliveryHandoffSyncController({
                userId,
                runId,
                cache,
                actions,
                fetchManifest: async (
                    input,
                ): Promise<DeliveryHandoffManifestFetchResult> =>
                    await fetchDeliveryHandoffManifest(input),
                isOnline: browserIsOnline,
            }),
        [actions, cache, runId, userId],
    );
    const state = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getServerSnapshot,
    );
    const deliveriesFingerprint =
        deliveryHandoffDeliveriesFingerprint(deliveries);
    const deliveryContextRef = useRef({
        fingerprint: deliveriesFingerprint,
        deliveries,
    });
    deliveryContextRef.current = {
        fingerprint: deliveriesFingerprint,
        deliveries,
    };
    const targetStopId = target?.targetStopId ?? null;
    const retryAttempt = target?.retryAttempt ?? null;
    const requestedTargetIsActive = useCallback(
        () =>
            targetStopId !== null &&
            retryAttempt !== null &&
            controller.matchesTarget({ targetStopId, retryAttempt }),
        [controller, retryAttempt, targetStopId],
    );

    useEffect(() => {
        const deliveryContext = deliveryContextRef.current;
        if (deliveryContext.fingerprint !== deliveriesFingerprint) return;
        void controller.setContext({
            target:
                targetStopId === null || retryAttempt === null
                    ? null
                    : { targetStopId, retryAttempt },
            deliveries: deliveryContext.deliveries,
            queueSnapshot: actions.getSnapshot(),
        });
    }, [
        actions,
        controller,
        deliveriesFingerprint,
        retryAttempt,
        targetStopId,
    ]);

    useEffect(() => {
        controller.updateQueueSnapshot(actionSync.snapshot);
    }, [actionSync.snapshot, controller]);

    useEffect(() => {
        const handleConnectionChange = () => controller.connectionChanged();
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
        return () => {
            window.removeEventListener('online', handleConnectionChange);
            window.removeEventListener('offline', handleConnectionChange);
        };
    }, [controller]);

    useEffect(() => () => controller.dispose(), [controller]);

    const scan = useCallback<UseDeliveryHandoffSyncResult['scan']>(
        async (value: string) =>
            requestedTargetIsActive()
                ? await controller.scan(value)
                : {
                      status: 'scan-failed',
                      message:
                          'Trenutačna stanica predaje još nije spremna za provjeru.',
                  },
        [controller, requestedTargetIsActive],
    );
    const markItem = useCallback<UseDeliveryHandoffSyncResult['markItem']>(
        async (input: {
            itemStopId: number;
            outcome: 'no-label' | 'missing' | 'skipped';
            reason?: DeliveryRunHandoffSkipReason;
        }) =>
            requestedTargetIsActive()
                ? await controller.markItem(input)
                : {
                      status: 'failed',
                      message:
                          'Trenutačna stanica predaje još nije spremna za provjeru.',
                  },
        [controller, requestedTargetIsActive],
    );
    const markRemainingReviewed = useCallback<
        UseDeliveryHandoffSyncResult['markRemainingReviewed']
    >(
        async () =>
            requestedTargetIsActive()
                ? await controller.markRemainingReviewed()
                : {
                      status: 'failed',
                      message:
                          'Trenutačna stanica predaje još nije spremna za provjeru.',
                  },
        [controller, requestedTargetIsActive],
    );
    const refresh = useCallback(
        async () =>
            requestedTargetIsActive() ? await controller.refresh() : false,
        [controller, requestedTargetIsActive],
    );

    const stateMatchesRequestedTarget =
        targetStopId !== null &&
        retryAttempt !== null &&
        state.handoff?.runId === runId &&
        state.handoff.targetStopId === targetStopId &&
        state.handoff.retryAttempt === retryAttempt;
    const visibleStatus =
        targetStopId === null || retryAttempt === null
            ? 'idle'
            : stateMatchesRequestedTarget
              ? state.status
              : browserIsOnline()
                ? 'loading'
                : 'offline';

    return {
        handoff: stateMatchesRequestedTarget ? state.handoff : null,
        status: visibleStatus,
        error: stateMatchesRequestedTarget ? state.error : null,
        feedback: stateMatchesRequestedTarget ? state.feedback : [],
        scan,
        markItem,
        markRemainingReviewed,
        refresh,
    };
}
