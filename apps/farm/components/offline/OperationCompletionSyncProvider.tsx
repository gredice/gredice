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

type SyncItem = typeof syncClaimedOperationCompletionQueueItem;

type OperationCompletionSyncProviderProps = PropsWithChildren<{
    accountId: string;
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
    mode,
    sessionIncarnation,
    syncItem = syncClaimedOperationCompletionQueueItem,
    userId,
}: OperationCompletionSyncProviderProps) {
    const analytics = useFarmAnalytics();
    const router = useRouter();
    const [items, setItems] = useState<OperationCompletionQueueSummary[]>([]);
    const [isStorageAvailable, setIsStorageAvailable] = useState(true);
    const activeRef = useRef(false);
    const drainPromiseRef = useRef<Promise<void> | null>(null);
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

    modeRef.current = mode;

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
            if (!lease || !activeRef.current) {
                return;
            }
            const result = await listOperationCompletionQueueItems(
                { accountId, userId },
                lease,
            );
            if (!activeRef.current) {
                return;
            }
            if (result.status === 'session_changed') {
                activeRef.current = false;
                leaseRef.current = null;
                setItems([]);
                return;
            }
            if (result.status === 'unavailable') {
                setIsStorageAvailable(false);
                return;
            }
            setIsStorageAvailable(true);
            setItems(result.items);
            captureChangedStates(result.items, trigger);
        },
        [accountId, captureChangedStates, userId],
    );
    refreshItemsRef.current = refreshItems;

    const drainOwnedQueue = useCallback(
        async (trigger: FarmCompletionSyncTrigger) => {
            const lease = leaseRef.current;
            if (
                !lease ||
                !activeRef.current ||
                !canDrainInForeground(modeRef.current)
            ) {
                await refreshItemsRef.current(trigger);
                return;
            }

            while (activeRef.current && canDrainInForeground(modeRef.current)) {
                const claim = await claimNextOperationCompletionQueueItem(
                    { accountId, userId },
                    { claimId: crypto.randomUUID(), lease },
                );
                if (!activeRef.current) {
                    return;
                }
                if (claim.status !== 'claimed') {
                    if (claim.status === 'session_changed') {
                        activeRef.current = false;
                        leaseRef.current = null;
                    } else if (claim.status === 'unavailable') {
                        setIsStorageAvailable(false);
                    }
                    break;
                }
                setIsStorageAvailable(true);
                await refreshItemsRef.current(trigger);
                const claimId = claim.item.claim?.claimId;
                if (!claimId) {
                    break;
                }
                let claimIsOwned = true;
                let renewalInFlight = false;
                const providerIsActive = () =>
                    activeRef.current &&
                    leaseRef.current?.generation === lease.generation &&
                    leaseRef.current.sessionIncarnation === sessionIncarnation;
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
                        if (result.status !== 'ok') {
                            claimIsOwned = false;
                            if (result.status === 'session_changed') {
                                activeRef.current = false;
                                leaseRef.current = null;
                            } else if (result.status === 'unavailable') {
                                setIsStorageAvailable(false);
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
                if (outcome.status === 'confirmed') {
                    router.refresh();
                }
                if (outcome.status === 'abandoned' && !activeRef.current) {
                    return;
                }
                await refreshItemsRef.current(trigger);
            }
        },
        [accountId, router, sessionIncarnation, syncItem, userId],
    );

    const requestDrain = useCallback(
        (trigger: FarmCompletionSyncTrigger): Promise<void> => {
            if (drainPromiseRef.current) {
                pendingDrainTriggerRef.current = trigger;
                return drainPromiseRef.current;
            }
            const run = async () => {
                const locks = navigator.locks;
                if (!locks) {
                    await drainOwnedQueue(trigger);
                    return;
                }
                await locks.request(
                    `${QUEUE_LOCK_NAME_PREFIX}:${userId}:${accountId}`,
                    { ifAvailable: true },
                    async (lock) => {
                        if (lock) {
                            await drainOwnedQueue(trigger);
                        } else {
                            await refreshItemsRef.current(trigger);
                        }
                    },
                );
            };
            const promise = run().finally(() => {
                if (drainPromiseRef.current === promise) {
                    drainPromiseRef.current = null;
                    const pendingTrigger = pendingDrainTriggerRef.current;
                    pendingDrainTriggerRef.current = null;
                    if (pendingTrigger) {
                        void requestDrainRef.current(pendingTrigger);
                    }
                }
            });
            drainPromiseRef.current = promise;
            return promise;
        },
        [accountId, drainOwnedQueue, userId],
    );
    requestDrainRef.current = requestDrain;

    useEffect(() => {
        let cancelled = false;
        activeRef.current = true;
        leaseRef.current = null;
        previousStatesRef.current.clear();
        setItems([]);
        const capturedLogoutNonce =
            captureOperationCompletionDraftLogoutNonce(userId);

        const unsubscribeLogout = subscribeToOperationCompletionDraftLogout(
            userId,
            sessionIncarnation,
            () => {
                activeRef.current = false;
                leaseRef.current = null;
                setItems([]);
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
            if (cancelled || !activeRef.current) {
                return;
            }
            if (result.status !== 'ready') {
                if (result.status === 'unavailable') {
                    setIsStorageAvailable(false);
                } else {
                    activeRef.current = false;
                }
                return;
            }
            leaseRef.current = result.lease;
            setIsStorageAvailable(true);
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
            pendingDrainTriggerRef.current = null;
            unsubscribeLogout();
            unsubscribeQueue();
        };
    }, [accountId, requestDrain, sessionIncarnation, userId]);

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
                !lease ||
                !item ||
                modeRef.current === 'off' ||
                !isRetryableFailure(item.failureCode)
            ) {
                return;
            }
            await retryOperationCompletionQueueItem(
                { key: item.key, submissionId: item.submissionId },
                lease,
            );
            await refreshItemsRef.current('manual');
            await requestDrain('manual');
        },
        [items, requestDrain],
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
            if (!lease || !item || item.state === 'syncing') {
                return false;
            }
            const result = await discardOperationCompletionQueueItem(
                { key: item.key, submissionId: item.submissionId },
                lease,
            );
            await refreshItemsRef.current('manual');
            return result.status === 'ok';
        },
        [items],
    );

    const value = useMemo<OperationCompletionSyncContextValue>(
        () => ({
            discard,
            isStorageAvailable,
            items: items.map(publicItem),
            mode,
            retry,
            retryAll,
        }),
        [discard, isStorageAvailable, items, mode, retry, retryAll],
    );

    return (
        <OperationCompletionSyncContext.Provider value={value}>
            {children}
        </OperationCompletionSyncContext.Provider>
    );
}
