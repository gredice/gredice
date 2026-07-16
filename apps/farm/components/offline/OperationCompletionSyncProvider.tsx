'use client';

import { useRouter } from 'next/navigation';
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    acquireOperationCompletionDraftLease,
    captureOperationCompletionDraftLogoutNonce,
    type OperationCompletionDraftLease,
    subscribeToOperationCompletionDraftLogout,
} from '../../lib/offline/operationCompletionDraftStore';
import {
    claimNextOperationCompletionQueueItem,
    discardOperationCompletionQueueItem,
    listOperationCompletionQueueItems,
    type OperationCompletionQueueFailureCode,
    type OperationCompletionQueueSummary,
    renewOperationCompletionQueueClaim,
    retryOperationCompletionQueueItem,
    subscribeToOperationCompletionQueueChanges,
} from '../../lib/offline/operationCompletionQueueStore';
import { syncClaimedOperationCompletionQueueItem } from '../../lib/offline/operationCompletionQueueSync';
import type { FarmOperationCompletionSyncMode } from '../../lib/offline/operationCompletionSyncMode';
import type {
    FarmCompletionSyncFailureCode,
    FarmCompletionSyncState,
    FarmCompletionSyncTrigger,
} from '../analytics/farmAnalytics';
import { useFarmAnalytics } from '../analytics/farmAnalyticsContext';
import {
    OperationCompletionSyncContext,
    type OperationCompletionSyncContextValue,
    type OperationCompletionSyncPublicItem,
} from './OperationCompletionSyncContext';

const QUEUE_LOCK_NAME_PREFIX = 'gredice:farm:operation-completion-queue:v1';
const QUEUE_CLAIM_RENEW_INTERVAL_MS = 30_000;
const EMPTY_QUEUE_ITEMS: OperationCompletionQueueSummary[] = [];

type SyncItem = typeof syncClaimedOperationCompletionQueueItem;
type DrainPromise = {
    identityKey: string;
    promise: Promise<void>;
};
type QueueSnapshot = {
    identityKey: string;
    items: OperationCompletionQueueSummary[];
};
type StorageSnapshot = {
    available: boolean;
    identityKey: string;
};

type OperationCompletionSyncProviderProps = PropsWithChildren<{
    accountId: string;
    enabled?: boolean;
    mode: FarmOperationCompletionSyncMode;
    sessionIncarnation: string;
    syncItem?: SyncItem;
    userId: string;
}>;

function queueFailureMessage(code: OperationCompletionQueueFailureCode | null) {
    switch (code) {
        case 'network_unavailable':
            return 'Nema internetske veze. Slanje će se nastaviti kada ponovno otvoriš aplikaciju uz vezu.';
        case 'server_unavailable':
            return 'Farma trenutačno nije dostupna. Pokušat ćemo ponovno.';
        case 'upload_failed':
            return 'Fotografije se nisu mogle poslati. Pokušaj ponovno uz stabilnu vezu.';
        case 'expired':
            return 'Lokalni unos je istekao. Sadržaj je uklonjen s uređaja; provjeri raspored prije nastavka.';
        case 'not_authorized':
            return 'Pristup zadatku se promijenio. Osvježi prijavu i provjeri raspored.';
        case 'assignment_changed':
            return 'Zaduženje se promijenilo. Provjeri zadatak prije odbacivanja lokalnog unosa.';
        case 'idempotency_conflict':
            return 'Poslužitelj je pronašao drugačiji pokušaj za ovu radnju. Provjeri raspored prije odbacivanja.';
        case 'invalid_input':
        case 'invalid_status':
        case 'not_found':
        case 'task_changed':
            return 'Zadatak se promijenio. Provjeri trenutni raspored prije odbacivanja lokalnog unosa.';
        case 'discarded':
        case null:
            return null;
    }
}

function isRetryableFailure(code: OperationCompletionQueueFailureCode | null) {
    return (
        code === 'network_unavailable' ||
        code === 'server_unavailable' ||
        code === 'upload_failed'
    );
}

function publicItem(
    item: OperationCompletionQueueSummary,
): OperationCompletionSyncPublicItem {
    return {
        createdAt: item.createdAt,
        failureMessage: queueFailureMessage(item.failureCode),
        key: item.key,
        label: item.operationLabel || null,
        operationId: item.operationId,
        retryable: isRetryableFailure(item.failureCode),
        serverState: item.serverState,
        state: item.state,
    };
}

function queueSizeBucket(size: number) {
    if (size <= 1) return 'one' as const;
    if (size <= 5) return 'two_to_five' as const;
    return 'six_plus' as const;
}

function queueAgeBucket(createdAt: number) {
    const age = Math.max(0, Date.now() - createdAt);
    if (age < 5 * 60_000) return 'under_5m' as const;
    if (age < 60 * 60_000) return 'under_1h' as const;
    if (age < 24 * 60 * 60_000) return 'under_1d' as const;
    return 'older' as const;
}

function queueAttemptBucket(attemptCount: number) {
    if (attemptCount <= 0) return 'none' as const;
    if (attemptCount === 1) return 'one' as const;
    if (attemptCount === 2) return 'two' as const;
    return 'three_plus' as const;
}

function analyticsFailureCode(
    code: OperationCompletionQueueFailureCode | null,
): FarmCompletionSyncFailureCode | undefined {
    switch (code) {
        case 'network_unavailable':
            return 'network';
        case 'server_unavailable':
            return 'server_unavailable';
        case 'upload_failed':
            return 'upload_unavailable';
        case 'expired':
            return 'expired';
        case 'not_authorized':
            return 'auth_changed';
        case 'idempotency_conflict':
            return 'submission_conflict';
        case 'assignment_changed':
        case 'invalid_input':
        case 'invalid_status':
        case 'not_found':
        case 'task_changed':
            return 'task_changed';
        case 'discarded':
        case null:
            return undefined;
    }
}

function analyticsState(
    state: OperationCompletionQueueSummary['state'],
): Exclude<FarmCompletionSyncState, 'saved_local'> {
    return state;
}

function canDrainInForeground(mode: FarmOperationCompletionSyncMode) {
    return (
        mode !== 'off' &&
        navigator.onLine &&
        document.visibilityState === 'visible'
    );
}

export function OperationCompletionSyncProvider({
    accountId,
    children,
    enabled = true,
    mode,
    sessionIncarnation,
    syncItem = syncClaimedOperationCompletionQueueItem,
    userId,
}: OperationCompletionSyncProviderProps) {
    const analytics = useFarmAnalytics();
    const router = useRouter();
    const durableIdentityKey = enabled
        ? JSON.stringify([userId, accountId, sessionIncarnation])
        : null;
    const previousDurableIdentityKeyRef = useRef<string | null>(null);
    const identityEpochRef = useRef(0);
    if (previousDurableIdentityKeyRef.current !== durableIdentityKey) {
        previousDurableIdentityKeyRef.current = durableIdentityKey;
        identityEpochRef.current += 1;
    }
    const identityKey = durableIdentityKey
        ? `${identityEpochRef.current.toString()}:${durableIdentityKey}`
        : null;
    const identityRef = useRef(identityKey);
    identityRef.current = identityKey;
    const [queueSnapshot, setQueueSnapshot] = useState<QueueSnapshot | null>(
        null,
    );
    const [storageSnapshot, setStorageSnapshot] =
        useState<StorageSnapshot | null>(null);
    const items =
        queueSnapshot?.identityKey === identityKey
            ? queueSnapshot.items
            : EMPTY_QUEUE_ITEMS;
    const isStorageAvailable =
        storageSnapshot?.identityKey === identityKey
            ? storageSnapshot.available
            : true;
    const activeRef = useRef(false);
    const drainPromiseRef = useRef<DrainPromise | null>(null);
    const pendingDrainTriggerRef = useRef<FarmCompletionSyncTrigger | null>(
        null,
    );
    const requestDrainRef = useRef<
        (trigger: FarmCompletionSyncTrigger) => Promise<void>
    >(async () => undefined);
    const leaseRef = useRef<OperationCompletionDraftLease | null>(null);
    const modeRef = useRef(mode);
    const previousStatesRef = useRef(new Map<string, string>());
    const refreshItemsRef = useRef<
        (trigger: FarmCompletionSyncTrigger) => Promise<void>
    >(async () => undefined);

    modeRef.current = enabled ? mode : 'off';

    const deactivateCurrentIdentity = useCallback(() => {
        if (!identityKey || identityRef.current !== identityKey) {
            return;
        }
        activeRef.current = false;
        leaseRef.current = null;
        drainPromiseRef.current = null;
        pendingDrainTriggerRef.current = null;
        previousStatesRef.current.clear();
        setQueueSnapshot(null);
        setStorageSnapshot(null);
    }, [identityKey]);

    const setCurrentStorageAvailability = useCallback(
        (available: boolean) => {
            if (identityKey && identityRef.current === identityKey) {
                setStorageSnapshot({ available, identityKey });
            }
        },
        [identityKey],
    );

    const captureChangedStates = useCallback(
        (
            nextItems: OperationCompletionQueueSummary[],
            trigger: FarmCompletionSyncTrigger,
        ) => {
            const previousStates = previousStatesRef.current;
            const nextStates = new Map<string, string>();
            for (const item of nextItems) {
                nextStates.set(
                    item.key,
                    `${item.state}:${item.failureCode ?? ''}`,
                );
                if (
                    previousStates.get(item.key) ===
                    `${item.state}:${item.failureCode ?? ''}`
                ) {
                    continue;
                }
                const failureCode = analyticsFailureCode(item.failureCode);
                analytics?.captureCompletionSyncState({
                    age_bucket: queueAgeBucket(item.createdAt),
                    attempt_bucket: queueAttemptBucket(item.attemptCount),
                    ...(failureCode ? { failure_code: failureCode } : {}),
                    queue_size_bucket: queueSizeBucket(nextItems.length),
                    state: analyticsState(item.state),
                    trigger,
                });
            }
            previousStatesRef.current = nextStates;
        },
        [analytics],
    );

    const refreshItems = useCallback(
        async (trigger: FarmCompletionSyncTrigger) => {
            const lease = leaseRef.current;
            if (
                !identityKey ||
                identityRef.current !== identityKey ||
                !lease ||
                !activeRef.current
            ) {
                return;
            }
            const result = await listOperationCompletionQueueItems(
                { accountId, userId },
                lease,
            );
            if (identityRef.current !== identityKey || !activeRef.current) {
                return;
            }
            if (result.status === 'session_changed') {
                deactivateCurrentIdentity();
                return;
            }
            if (result.status === 'unavailable') {
                setCurrentStorageAvailability(false);
                return;
            }
            setCurrentStorageAvailability(true);
            setQueueSnapshot({ identityKey, items: result.items });
            captureChangedStates(result.items, trigger);
        },
        [
            accountId,
            captureChangedStates,
            deactivateCurrentIdentity,
            identityKey,
            setCurrentStorageAvailability,
            userId,
        ],
    );
    refreshItemsRef.current = refreshItems;

    const drainOwnedQueue = useCallback(
        async (trigger: FarmCompletionSyncTrigger) => {
            const lease = leaseRef.current;
            const providerIsActive = () =>
                Boolean(identityKey) &&
                identityRef.current === identityKey &&
                activeRef.current &&
                leaseRef.current === lease &&
                leaseRef.current?.generation === lease?.generation &&
                leaseRef.current?.sessionIncarnation === sessionIncarnation;
            if (!lease || !providerIsActive()) {
                return;
            }
            if (!canDrainInForeground(modeRef.current)) {
                await refreshItemsRef.current(trigger);
                return;
            }

            while (
                providerIsActive() &&
                canDrainInForeground(modeRef.current)
            ) {
                const claim = await claimNextOperationCompletionQueueItem(
                    { accountId, userId },
                    { claimId: crypto.randomUUID(), lease },
                );
                if (!providerIsActive()) {
                    return;
                }
                if (claim.status !== 'claimed') {
                    if (claim.status === 'session_changed') {
                        deactivateCurrentIdentity();
                    } else if (claim.status === 'unavailable') {
                        setCurrentStorageAvailability(false);
                    }
                    break;
                }
                setCurrentStorageAvailability(true);
                await refreshItemsRef.current(trigger);
                const claimId = claim.item.claim?.claimId;
                if (!claimId) {
                    break;
                }
                let claimIsOwned = true;
                let renewalInFlight = false;
                const renewClaim = async () => {
                    if (
                        renewalInFlight ||
                        !claimIsOwned ||
                        !providerIsActive()
                    ) {
                        return;
                    }
                    renewalInFlight = true;
                    try {
                        const result = await renewOperationCompletionQueueClaim(
                            {
                                claimId,
                                key: claim.item.key,
                                submissionId: claim.item.submissionId,
                            },
                            lease,
                        );
                        if (!providerIsActive()) {
                            claimIsOwned = false;
                            return;
                        }
                        if (result.status !== 'ok') {
                            claimIsOwned = false;
                            if (result.status === 'session_changed') {
                                deactivateCurrentIdentity();
                            } else if (result.status === 'unavailable') {
                                setCurrentStorageAvailability(false);
                            }
                        }
                    } finally {
                        renewalInFlight = false;
                    }
                };
                const heartbeat = window.setInterval(
                    () => void renewClaim(),
                    QUEUE_CLAIM_RENEW_INTERVAL_MS,
                );
                const outcome = await syncItem(
                    claim.item,
                    lease,
                    () => claimIsOwned && providerIsActive(),
                ).finally(() => window.clearInterval(heartbeat));
                if (!providerIsActive()) {
                    return;
                }
                if (outcome.status === 'confirmed') {
                    router.refresh();
                }
                await refreshItemsRef.current(trigger);
            }
        },
        [
            accountId,
            deactivateCurrentIdentity,
            identityKey,
            router,
            sessionIncarnation,
            setCurrentStorageAvailability,
            syncItem,
            userId,
        ],
    );

    const requestDrain = useCallback(
        (trigger: FarmCompletionSyncTrigger): Promise<void> => {
            if (!identityKey || identityRef.current !== identityKey) {
                return Promise.resolve();
            }
            if (drainPromiseRef.current?.identityKey === identityKey) {
                pendingDrainTriggerRef.current = trigger;
                return drainPromiseRef.current.promise;
            }
            if (drainPromiseRef.current) {
                drainPromiseRef.current = null;
                pendingDrainTriggerRef.current = null;
            }
            const run = async () => {
                if (identityRef.current !== identityKey) {
                    return;
                }
                const locks = navigator.locks;
                if (!locks) {
                    await drainOwnedQueue(trigger);
                    return;
                }
                await locks.request(
                    `${QUEUE_LOCK_NAME_PREFIX}:${userId}:${accountId}`,
                    { ifAvailable: true },
                    async (lock) => {
                        if (identityRef.current !== identityKey) {
                            return;
                        }
                        if (lock) {
                            await drainOwnedQueue(trigger);
                        } else {
                            await refreshItemsRef.current(trigger);
                        }
                    },
                );
            };
            let drain: DrainPromise;
            const promise = run().finally(() => {
                if (drainPromiseRef.current === drain) {
                    drainPromiseRef.current = null;
                    const pendingTrigger = pendingDrainTriggerRef.current;
                    pendingDrainTriggerRef.current = null;
                    if (pendingTrigger && identityRef.current === identityKey) {
                        void requestDrainRef.current(pendingTrigger);
                    }
                }
            });
            drain = { identityKey, promise };
            drainPromiseRef.current = drain;
            return promise;
        },
        [accountId, drainOwnedQueue, identityKey, userId],
    );
    requestDrainRef.current = requestDrain;

    useEffect(() => {
        if (!enabled || !identityKey) {
            activeRef.current = false;
            leaseRef.current = null;
            drainPromiseRef.current = null;
            pendingDrainTriggerRef.current = null;
            previousStatesRef.current.clear();
            setQueueSnapshot(null);
            setStorageSnapshot(null);
            return;
        }

        let cancelled = false;
        activeRef.current = true;
        leaseRef.current = null;
        drainPromiseRef.current = null;
        pendingDrainTriggerRef.current = null;
        previousStatesRef.current.clear();
        setQueueSnapshot(null);
        setStorageSnapshot(null);
        const capturedLogoutNonce =
            captureOperationCompletionDraftLogoutNonce(userId);

        const unsubscribeLogout = subscribeToOperationCompletionDraftLogout(
            userId,
            sessionIncarnation,
            () => {
                deactivateCurrentIdentity();
            },
        );
        const unsubscribeQueue = subscribeToOperationCompletionQueueChanges(
            userId,
            accountId,
            () => {
                void refreshItemsRef.current('created').then(() => {
                    if (modeRef.current !== 'off') {
                        void requestDrain('created');
                    }
                });
            },
        );

        void acquireOperationCompletionDraftLease(
            userId,
            capturedLogoutNonce,
            sessionIncarnation,
        ).then((result) => {
            if (
                cancelled ||
                identityRef.current !== identityKey ||
                !activeRef.current
            ) {
                return;
            }
            if (result.status !== 'ready') {
                if (result.status === 'unavailable') {
                    setCurrentStorageAvailability(false);
                } else {
                    deactivateCurrentIdentity();
                }
                return;
            }
            leaseRef.current = result.lease;
            setCurrentStorageAvailability(true);
            void refreshItemsRef.current('auth_mount').then(() => {
                if (modeRef.current !== 'off') {
                    void requestDrain('auth_mount');
                }
            });
        });

        return () => {
            cancelled = true;
            activeRef.current = false;
            leaseRef.current = null;
            if (drainPromiseRef.current?.identityKey === identityKey) {
                drainPromiseRef.current = null;
            }
            pendingDrainTriggerRef.current = null;
            unsubscribeLogout();
            unsubscribeQueue();
        };
    }, [
        accountId,
        deactivateCurrentIdentity,
        enabled,
        identityKey,
        requestDrain,
        sessionIncarnation,
        setCurrentStorageAvailability,
        userId,
    ]);

    useEffect(() => {
        const handleOnline = () => void requestDrain('online');
        const handlePageShow = () => void requestDrain('pageshow');
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void requestDrain('visibility');
            }
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('pageshow', handlePageShow);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    }, [requestDrain]);

    useEffect(() => {
        if (mode === 'off') {
            return;
        }
        const nextRetryAt = items.reduce<number | null>((earliest, item) => {
            if (
                item.state !== 'queued' ||
                item.nextAttemptAt === null ||
                item.nextAttemptAt <= Date.now()
            ) {
                return earliest;
            }
            return earliest === null
                ? item.nextAttemptAt
                : Math.min(earliest, item.nextAttemptAt);
        }, null);
        if (nextRetryAt === null) {
            return;
        }
        const timer = window.setTimeout(
            () => void requestDrain('retry_timer'),
            Math.max(0, nextRetryAt - Date.now()),
        );
        return () => window.clearTimeout(timer);
    }, [items, mode, requestDrain]);

    const retry = useCallback(
        async (key: string) => {
            const lease = leaseRef.current;
            const item = items.find((candidate) => candidate.key === key);
            if (
                !enabled ||
                !identityKey ||
                identityRef.current !== identityKey ||
                !activeRef.current ||
                !lease ||
                !item ||
                modeRef.current === 'off' ||
                !isRetryableFailure(item.failureCode)
            ) {
                return;
            }
            const result = await retryOperationCompletionQueueItem(
                { key: item.key, submissionId: item.submissionId },
                lease,
            );
            if (
                identityRef.current !== identityKey ||
                !activeRef.current ||
                leaseRef.current !== lease
            ) {
                return;
            }
            if (result.status === 'session_changed') {
                deactivateCurrentIdentity();
                return;
            }
            await refreshItemsRef.current('manual');
            await requestDrain('manual');
        },
        [deactivateCurrentIdentity, enabled, identityKey, items, requestDrain],
    );

    const retryAll = useCallback(async () => {
        for (const item of items) {
            if (
                item.state === 'failed' &&
                isRetryableFailure(item.failureCode)
            ) {
                await retry(item.key);
            }
        }
    }, [items, retry]);

    const discard = useCallback(
        async (key: string) => {
            const lease = leaseRef.current;
            const item = items.find((candidate) => candidate.key === key);
            if (
                !enabled ||
                !identityKey ||
                identityRef.current !== identityKey ||
                !activeRef.current ||
                !lease ||
                !item ||
                item.state === 'syncing'
            ) {
                return false;
            }
            const result = await discardOperationCompletionQueueItem(
                { key: item.key, submissionId: item.submissionId },
                lease,
            );
            if (
                identityRef.current !== identityKey ||
                !activeRef.current ||
                leaseRef.current !== lease
            ) {
                return false;
            }
            if (result.status === 'session_changed') {
                deactivateCurrentIdentity();
                return false;
            }
            await refreshItemsRef.current('manual');
            return result.status === 'ok';
        },
        [deactivateCurrentIdentity, enabled, identityKey, items],
    );

    const value = useMemo<OperationCompletionSyncContextValue>(
        () => ({
            discard,
            isStorageAvailable,
            items: items.map(publicItem),
            mode: enabled ? mode : 'off',
            retry,
            retryAll,
        }),
        [discard, enabled, isStorageAvailable, items, mode, retry, retryAll],
    );

    return (
        <OperationCompletionSyncContext.Provider value={value}>
            {children}
        </OperationCompletionSyncContext.Provider>
    );
}
