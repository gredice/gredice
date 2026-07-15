'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import { deliveryRunCompletedEvent } from '../lib/deliveryOfflineEvents';
import {
    createMemoryPickupManifestQueuePersistence,
    createPickupManifestConfirmCommand,
    createPickupManifestManualOutcomeCommand,
    createPickupManifestScanCommand,
    createWebStoragePickupManifestQueuePersistence,
    type PickupManifestAcknowledgement,
    type PickupManifestCommand,
    type PickupManifestManualOutcome,
    PickupManifestQueue,
    type PickupManifestQueueCoordinator,
    type PickupManifestQueuePersistence,
    type PickupManifestTransportResult,
    pickupManifestQueueStorageKey,
} from '../lib/pickupManifestQueue';
import {
    pickupManifestHttpFailure,
    pickupManifestTransportResult,
} from '../lib/pickupManifestTransport';

function operationId() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `pickup-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
}

function mutationForCommand(command: PickupManifestCommand) {
    const common = {
        clientOperationId: command.operationId,
        occurredAt: command.occurredAt,
    };
    switch (command.kind) {
        case 'scan':
            return {
                ...common,
                kind: 'scan' as const,
                traceToken: command.tracePath,
            };
        case 'manual-outcome':
            return {
                ...common,
                kind: 'mark-item' as const,
                stopId: command.stopId,
                outcome: command.outcome,
            };
        case 'confirm':
            return {
                ...common,
                kind: 'confirm-manifest' as const,
                manifestId: command.manifestId,
            };
    }
}

async function sendPickupManifestCommand(
    command: PickupManifestCommand,
): Promise<PickupManifestTransportResult> {
    let response: Response;
    try {
        response = await fetch(
            `/api/driver/runs/${encodeURIComponent(command.runId)}/pickups/${encodeURIComponent(command.pickupNodeId)}/mutations`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mutations: [mutationForCommand(command)],
                }),
            },
        );
    } catch {
        return { status: 'retryable-failure', code: 'offline' };
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        return pickupManifestHttpFailure(response.status, data);
    }
    return pickupManifestTransportResult(data, command);
}

function pickupManifestQueueLockName({
    userId,
    runId,
    purpose,
}: {
    userId: string;
    runId: string;
    purpose: 'state' | 'replay';
}) {
    return `gredice:delivery:pickup-manifest:${purpose}:${encodeURIComponent(userId)}:${encodeURIComponent(runId)}`;
}

function pickupManifestLockCoordinator(
    lockManager: LockManager,
    purpose: 'state' | 'replay',
): PickupManifestQueueCoordinator {
    return {
        runExclusive: async (scope, task) =>
            await lockManager.request(
                pickupManifestQueueLockName({ ...scope, purpose }),
                { mode: 'exclusive' },
                async () => await task(),
            ),
    };
}

function pickupManifestQueueResources(): {
    persistence: PickupManifestQueuePersistence;
    coordinator?: PickupManifestQueueCoordinator;
    replayCoordinator?: PickupManifestQueueCoordinator;
} {
    const memory = createMemoryPickupManifestQueuePersistence();
    if (typeof window === 'undefined') return { persistence: memory };

    try {
        const persistence = createWebStoragePickupManifestQueuePersistence(
            window.localStorage,
        );
        if (!navigator.locks) return { persistence };
        const lockManager = navigator.locks;
        return {
            persistence,
            coordinator: pickupManifestLockCoordinator(lockManager, 'state'),
            replayCoordinator: pickupManifestLockCoordinator(
                lockManager,
                'replay',
            ),
        };
    } catch {
        return { persistence: memory };
    }
}

export function usePickupManifestSync({
    userId,
    runId,
    onAcknowledged,
}: {
    userId: string;
    runId: string;
    onAcknowledged: () => void | Promise<void>;
}) {
    const onAcknowledgedRef = useRef(onAcknowledged);
    useEffect(() => {
        onAcknowledgedRef.current = onAcknowledged;
    }, [onAcknowledged]);

    const resources = useMemo(pickupManifestQueueResources, []);
    const queue = useMemo(
        () =>
            new PickupManifestQueue({
                scope: { userId, runId },
                persistence: resources.persistence,
                transport: sendPickupManifestCommand,
                coordinator: resources.coordinator,
                replayCoordinator: resources.replayCoordinator,
            }),
        [resources, runId, userId],
    );
    const snapshot = useSyncExternalStore(
        queue.subscribe,
        queue.getSnapshot,
        queue.getServerSnapshot,
    );

    const replay = useCallback(async () => {
        const before = queue.getSnapshot().syncedCount;
        const result = await queue.replay();
        if (result.syncedCount > before) {
            await onAcknowledgedRef.current();
        }
        return result;
    }, [queue]);

    useEffect(() => {
        let active = true;
        void queue
            .restore()
            .then(() => {
                if (active && navigator.onLine) {
                    void replay().catch(() => undefined);
                }
            })
            .catch(() => undefined);
        const handleOnline = () => void replay().catch(() => undefined);
        const handleRunCompleted = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail;
            if (
                typeof detail === 'object' &&
                detail !== null &&
                'userId' in detail &&
                detail.userId === userId &&
                'runId' in detail &&
                detail.runId === runId
            ) {
                void queue.clear().catch(() => undefined);
            }
        };
        const handleStorage = (event: StorageEvent) => {
            let storage: Storage;
            try {
                storage = window.localStorage;
            } catch {
                return;
            }
            if (
                event.storageArea !== storage ||
                event.key !== pickupManifestQueueStorageKey({ userId, runId })
            ) {
                return;
            }
            void queue
                .refresh()
                .then((next) => {
                    if (
                        active &&
                        navigator.onLine &&
                        next.failedCount === 0 &&
                        next.conflictedCount === 0 &&
                        next.queuedCount + next.sendingCount > 0
                    ) {
                        void replay().catch(() => undefined);
                    }
                })
                .catch(() => undefined);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('storage', handleStorage);
        window.addEventListener(deliveryRunCompletedEvent, handleRunCompleted);
        return () => {
            active = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(
                deliveryRunCompletedEvent,
                handleRunCompleted,
            );
        };
    }, [queue, replay, runId, userId]);

    const enqueue = useCallback(
        async (command: PickupManifestCommand) => {
            await queue.enqueue(command);
            if (navigator.onLine) void replay().catch(() => undefined);
        },
        [queue, replay],
    );

    const retryEntry = useCallback(
        async (operationIdValue: string) => {
            const changed = await queue.retryEntry(operationIdValue);
            if (changed && navigator.onLine) await replay();
            return changed;
        },
        [queue, replay],
    );
    const discardEntry = useCallback(
        async (operationIdValue: string) => {
            const changed = await queue.discardEntry(operationIdValue);
            if (changed) await onAcknowledgedRef.current();
            if (changed && navigator.onLine) await replay();
            return changed;
        },
        [queue, replay],
    );
    const reconcileEntry = useCallback(
        async (
            operationIdValue: string,
            acknowledgement: PickupManifestAcknowledgement = 'applied',
        ) => {
            const changed = await queue.reconcileEntry(
                operationIdValue,
                acknowledgement,
            );
            if (changed) await onAcknowledgedRef.current();
            if (changed && navigator.onLine) await replay();
            return changed;
        },
        [queue, replay],
    );

    return {
        snapshot,
        durability: snapshot.durability,
        isDurable: snapshot.durability === 'durable',
        coordination: snapshot.coordination,
        enqueueScan: (pickupNodeId: string, scanValue: string) =>
            enqueue(
                createPickupManifestScanCommand({
                    operationId: operationId(),
                    runId,
                    pickupNodeId,
                    scanValue,
                }),
            ),
        enqueueItemOutcome: ({
            pickupNodeId,
            manifestId,
            stopId,
            outcome,
        }: {
            pickupNodeId: string;
            manifestId: string;
            stopId: number;
            outcome: PickupManifestManualOutcome;
        }) =>
            enqueue(
                createPickupManifestManualOutcomeCommand({
                    operationId: operationId(),
                    runId,
                    pickupNodeId,
                    manifestId,
                    stopId,
                    outcome,
                }),
            ),
        enqueueConfirm: (pickupNodeId: string, manifestId: string) =>
            enqueue(
                createPickupManifestConfirmCommand({
                    operationId: operationId(),
                    runId,
                    pickupNodeId,
                    manifestId,
                }),
            ),
        retry: replay,
        retryEntry,
        discardEntry,
        reconcileEntry,
        clear: () => queue.clear(),
    };
}
