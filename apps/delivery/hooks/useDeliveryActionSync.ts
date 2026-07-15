'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import {
    type DeliveryRunCompletion,
    deliveryActionChangedMessage,
    deliveryRunCompletedMessage,
    deliveryRunCompletionFromSnapshot,
    parseDeliveryActionChannelMessage,
} from '../lib/deliveryActionCompletion';
import {
    createBrowserDeliveryActionQueuePersistence,
    createDeliveryArriveCommand,
    createDeliveryCompleteCommand,
    createDeliveryExceptionCommand,
    createDeliveryVerificationScanCommand,
    DeliveryActionBarrierError,
    type DeliveryActionCommand,
    DeliveryActionQueue,
    type DeliveryActionQueueCoordinator,
    type DeliveryActionQueueSnapshot,
    type DeliveryServerActionCommand,
    deliveryActionQueueCanReplay,
} from '../lib/deliveryActionQueue';
import { sendDeliveryAction } from '../lib/deliveryActionTransport';
import type { DeliveryExceptionMutation } from '../lib/deliveryExceptionPresentation';
import { deliveryRunCompletedEvent } from '../lib/deliveryOfflineEvents';
import {
    clearDeliveryRunSupportingStores,
    createBrowserDeliveryRunSupportingStores,
    finalizeDeliveryRunStoredState,
} from '../lib/deliveryRunStoredState';

export type DeliveryServerStateExpectation = {
    runId: string;
    minimumRouteRevision?: number;
    runCompleted?: boolean;
};

function operationId(prefix: string) {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
}

function deliveryActionLockCoordinator(
    lockManager: LockManager,
    purpose: 'state' | 'replay',
): DeliveryActionQueueCoordinator {
    return {
        runExclusive: async (scope, task) =>
            await lockManager.request(
                `gredice:delivery:actions:${purpose}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.runId)}`,
                { mode: 'exclusive' },
                async () => await task(),
            ),
    };
}

function deliveryActionQueueResources() {
    const persistence = createBrowserDeliveryActionQueuePersistence();
    if (typeof navigator === 'undefined' || !navigator.locks) {
        return { persistence };
    }
    return {
        persistence,
        coordinator: deliveryActionLockCoordinator(navigator.locks, 'state'),
        replayCoordinator: deliveryActionLockCoordinator(
            navigator.locks,
            'replay',
        ),
    };
}

export function useDeliveryActionSync({
    userId,
    runId,
    refreshServerState,
}: {
    userId: string;
    runId: string;
    refreshServerState: (
        expectation?: DeliveryServerStateExpectation,
    ) => Promise<boolean>;
}) {
    const refreshServerStateRef = useRef(refreshServerState);
    useEffect(() => {
        refreshServerStateRef.current = refreshServerState;
    }, [refreshServerState]);

    const channel = useMemo(() => {
        if (
            typeof window === 'undefined' ||
            typeof BroadcastChannel === 'undefined'
        ) {
            return null;
        }
        try {
            return new BroadcastChannel(
                `gredice:delivery:actions:${encodeURIComponent(userId)}:${encodeURIComponent(runId)}`,
            );
        } catch {
            return null;
        }
    }, [runId, userId]);
    const resources = useMemo(deliveryActionQueueResources, []);
    const queue = useMemo(
        () =>
            new DeliveryActionQueue({
                scope: { userId, runId },
                persistence: resources.persistence,
                transport: sendDeliveryAction,
                coordinator: resources.coordinator,
                replayCoordinator: resources.replayCoordinator,
                crossTabNotifications: channel !== null,
            }),
        [channel, resources, runId, userId],
    );
    const announceChange = useCallback(() => {
        try {
            channel?.postMessage(deliveryActionChangedMessage());
        } catch {
            // The local queue remains usable when cross-tab signaling closes.
        }
    }, [channel]);
    const snapshot = useSyncExternalStore(
        queue.subscribe,
        queue.getSnapshot,
        queue.getServerSnapshot,
    );

    const finishCompletedRun = useCallback(
        async (completion: DeliveryRunCompletion, broadcast: boolean) => {
            if (completion.userId !== userId || completion.runId !== runId) {
                return false;
            }
            try {
                await finalizeDeliveryRunStoredState({
                    clearSupportingStores: async () =>
                        await clearDeliveryRunSupportingStores(
                            createBrowserDeliveryRunSupportingStores(),
                            { userId, runId },
                        ),
                    clearActionMarker: async () => await queue.clear(),
                    publishCompleted: () => {
                        if (broadcast) {
                            try {
                                channel?.postMessage(
                                    deliveryRunCompletedMessage(completion),
                                );
                            } catch {
                                // The local completion event remains authoritative.
                            }
                        }
                        window.dispatchEvent(
                            new CustomEvent(deliveryRunCompletedEvent, {
                                detail: { userId, runId },
                            }),
                        );
                    },
                });
            } catch {
                throw new Error(
                    'Završenu rutu nije moguće sigurno ukloniti s uređaja. Provjeri prostor i pokušaj ponovno.',
                );
            }
            return true;
        },
        [channel, queue, runId, userId],
    );

    const replay =
        useCallback(async (): Promise<DeliveryActionQueueSnapshot> => {
            const before = queue.getSnapshot();
            const next = await queue.replay();
            announceChange();
            const changedServerEntries = next.entries.filter((entry) => {
                if (entry.command.kind === 'verification-scan') return false;
                const previous = before.entries.find(
                    (candidate) =>
                        candidate.command.operationId ===
                        entry.command.operationId,
                );
                return (
                    previous?.state !== entry.state &&
                    (entry.state === 'synced' ||
                        entry.state === 'reconciling' ||
                        entry.state === 'conflicted')
                );
            });
            const completion = deliveryRunCompletionFromSnapshot(next);
            const completed = completion
                ? next.entries.find(
                      (entry) =>
                          entry.command.operationId === completion.operationId,
                  )
                : undefined;
            if (completion && completed) {
                await finishCompletedRun(completion, true);
                await refreshServerStateRef.current({
                    runId,
                    minimumRouteRevision:
                        completed.acknowledgement?.routeRevision,
                    runCompleted: true,
                });
                return queue.getSnapshot();
            }
            if (changedServerEntries.length === 0) return next;
            const acknowledgedEntries = next.entries.filter(
                (entry) =>
                    entry.command.kind !== 'verification-scan' &&
                    entry.acknowledgement?.kind === 'server',
            );
            const highestRevision = Math.max(
                -1,
                ...acknowledgedEntries.flatMap((entry) =>
                    entry.acknowledgement?.routeRevision === undefined
                        ? []
                        : [entry.acknowledgement.routeRevision],
                ),
            );
            const refreshed = await refreshServerStateRef.current({
                runId,
                ...(highestRevision >= 0
                    ? { minimumRouteRevision: highestRevision }
                    : {}),
            });
            if (refreshed) {
                for (const entry of acknowledgedEntries) {
                    await queue.completeServerReconciliation(
                        entry.command.operationId,
                    );
                }
                announceChange();
            }
            const reconciled = queue.getSnapshot();
            if (
                refreshed &&
                navigator.onLine &&
                deliveryActionQueueCanReplay(reconciled)
            ) {
                return await replay();
            }
            return reconciled;
        }, [announceChange, finishCompletedRun, queue, runId]);

    const reconcilePendingServerState = useCallback(async () => {
        const completion = deliveryRunCompletionFromSnapshot(
            queue.getSnapshot(),
        );
        if (completion) {
            await finishCompletedRun(completion, true);
            await refreshServerStateRef.current({
                runId,
                runCompleted: true,
            });
            return true;
        }
        const entries = queue
            .getSnapshot()
            .entries.filter(
                (entry) =>
                    entry.command.kind !== 'verification-scan' &&
                    entry.acknowledgement?.kind === 'server' &&
                    !entry.acknowledgement.runCompleted,
            );
        if (entries.length === 0) return true;
        const highestRevision = Math.max(
            ...entries.flatMap((entry) =>
                entry.acknowledgement?.routeRevision === undefined
                    ? []
                    : [entry.acknowledgement.routeRevision],
            ),
        );
        const refreshed = await refreshServerStateRef.current({
            runId,
            ...(Number.isFinite(highestRevision)
                ? { minimumRouteRevision: highestRevision }
                : {}),
        });
        if (!refreshed) return false;
        for (const entry of entries) {
            await queue.completeServerReconciliation(entry.command.operationId);
        }
        announceChange();
        if (
            navigator.onLine &&
            deliveryActionQueueCanReplay(queue.getSnapshot())
        ) {
            await replay();
        }
        return true;
    }, [announceChange, finishCompletedRun, queue, replay, runId]);

    const processRestoredSnapshot = useCallback(
        async (restored: DeliveryActionQueueSnapshot) => {
            const completion = deliveryRunCompletionFromSnapshot(restored);
            if (completion) {
                await finishCompletedRun(completion, true);
                await refreshServerStateRef.current({
                    runId,
                    runCompleted: true,
                });
                return;
            }
            const hasServerAcknowledgement = restored.entries.some(
                (entry) =>
                    entry.command.kind !== 'verification-scan' &&
                    entry.acknowledgement?.kind === 'server',
            );
            if (hasServerAcknowledgement) {
                const reconciled = await reconcilePendingServerState();
                if (!reconciled) return;
            }
            if (
                navigator.onLine &&
                deliveryActionQueueCanReplay(queue.getSnapshot())
            ) {
                await replay();
            }
        },
        [finishCompletedRun, queue, reconcilePendingServerState, replay, runId],
    );

    useEffect(() => {
        let active = true;
        void queue
            .restore()
            .then((restored) =>
                active ? processRestoredSnapshot(restored) : undefined,
            )
            .catch(() => undefined);
        const handleOnline = () => {
            void queue
                .restore()
                .then(processRestoredSnapshot)
                .catch(() => undefined);
        };
        window.addEventListener('online', handleOnline);
        return () => {
            active = false;
            window.removeEventListener('online', handleOnline);
        };
    }, [processRestoredSnapshot, queue]);

    useEffect(() => {
        if (!channel) return;
        const handleMessage = (event: MessageEvent<unknown>) => {
            const message = parseDeliveryActionChannelMessage(event.data);
            if (!message) return;
            if (message.kind === 'run-completed') {
                void finishCompletedRun(message.completion, false).catch(
                    () => undefined,
                );
                return;
            }
            void queue
                .restore()
                .then(processRestoredSnapshot)
                .catch(() => undefined);
        };
        channel.addEventListener('message', handleMessage);
        return () => {
            channel.removeEventListener('message', handleMessage);
            channel.close();
        };
    }, [channel, finishCompletedRun, processRestoredSnapshot, queue]);

    const enqueue = useCallback(
        async (command: DeliveryActionCommand) => {
            const entry = await queue.enqueue(command);
            announceChange();
            if (navigator.onLine && command.kind !== 'verification-scan') {
                void replay().catch(() => undefined);
            }
            return entry;
        },
        [announceChange, queue, replay],
    );

    const enqueueRouteAction = useCallback(
        async (
            serverRouteRevision: number,
            createCommand: (
                expectedRouteRevision: number,
            ) => DeliveryServerActionCommand,
        ) => {
            const entry = await queue.enqueueRouteAction(
                serverRouteRevision,
                createCommand,
            );
            announceChange();
            if (navigator.onLine) void replay().catch(() => undefined);
            return entry;
        },
        [announceChange, queue, replay],
    );

    const retry = useCallback(
        async (operationIdValue: string) => {
            const changed = await queue.retry(operationIdValue);
            if (changed) announceChange();
            if (changed && navigator.onLine) await replay();
            return changed;
        },
        [announceChange, queue, replay],
    );
    const recoverConflict = useCallback(
        async (operationIdValue: string) => {
            const refreshed = await refreshServerStateRef.current({ runId });
            if (!refreshed) return false;
            const recovered =
                await queue.discardConflictAndDependents(operationIdValue);
            if (recovered) announceChange();
            return recovered;
        },
        [announceChange, queue, runId],
    );

    return {
        snapshot,
        enqueueArrive: (stopId: number, serverRouteRevision: number) =>
            enqueueRouteAction(serverRouteRevision, (expectedRouteRevision) =>
                createDeliveryArriveCommand({
                    operationId: operationId('arrival'),
                    runId,
                    stopId,
                    expectedRouteRevision,
                }),
            ),
        enqueueDelivery: (
            stopId: number,
            serverRouteRevision: number,
            notes?: string,
        ) =>
            enqueueRouteAction(serverRouteRevision, (expectedRouteRevision) =>
                createDeliveryCompleteCommand({
                    operationId: operationId('delivery'),
                    runId,
                    stopId,
                    expectedRouteRevision,
                    notes,
                }),
            ),
        enqueueException: (
            stopId: number,
            mutation: DeliveryExceptionMutation,
        ) =>
            enqueueRouteAction(
                mutation.expectedRouteRevision,
                (expectedRouteRevision) =>
                    createDeliveryExceptionCommand({
                        operationId: mutation.clientOperationId,
                        runId,
                        stopId,
                        expectedRouteRevision,
                        occurredAt: mutation.occurredAt,
                        exceptions: mutation.exceptions,
                    }),
            ),
        enqueueVerificationScan: (stopId: number, tracePath: string) =>
            enqueue(
                createDeliveryVerificationScanCommand({
                    operationId: operationId('verification'),
                    runId,
                    stopId,
                    tracePath,
                }),
            ),
        retry,
        recoverConflict,
        reconcilePendingServerState,
        clear: () => queue.clear(),
        isBarrierError: (error: unknown) =>
            error instanceof DeliveryActionBarrierError,
    };
}
