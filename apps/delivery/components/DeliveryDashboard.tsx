'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { LoaderSpinner, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    type DeliveryServerStateExpectation,
    useDeliveryActionSync,
} from '../hooks/useDeliveryActionSync';
import {
    type DriverRouteWakeLockState,
    useDriverRouteWakeLock,
} from '../hooks/useDriverRouteWakeLock';
import { useDriverTracking } from '../hooks/useDriverTracking';
import { useOfflineRouteCache } from '../hooks/useOfflineRouteCache';
import { usePickupManifestSync } from '../hooks/usePickupManifestSync';
import {
    clearOtherDeliveryActionQueueScopes,
    createBrowserDeliveryActionQueuePersistence,
} from '../lib/deliveryActionQueue';
import type {
    DeliveryDashboard as DeliveryDashboardData,
    DriverDeliveryDashboard,
} from '../lib/deliveryDashboardTypes';
import { performDeliveryLogout } from '../lib/deliveryLogout';
import {
    assertDeliveryOfflineWritesAllowed,
    deliveryLogoutCompletedEvent,
    deliveryLogoutEvent,
    deliveryLogoutFailedEvent,
    deliveryOfflineWriteBlockReason,
    deliveryRunCompletedEvent,
    subscribeToRemoteDeliveryLogout,
} from '../lib/deliveryOfflineEvents';
import {
    clearDeliveryUserStoredState,
    createBrowserDeliveryUserStoredState,
} from '../lib/deliveryRunStoredState';
import {
    clearOtherOfflineRouteCacheScopes,
    createBrowserOfflineRouteCachePersistence,
} from '../lib/offlineRouteCache';
import {
    clearOtherPickupManifestQueueScopes,
    createWebStoragePickupManifestQueuePersistence,
} from '../lib/pickupManifestQueue';
import { CustomerDashboard } from './CustomerDashboard';
import { DriverDashboard } from './DriverDashboard';
import { OfflineRouteRecovery } from './OfflineRouteRecovery';

async function clearStoredDriverState(userId: string, runId?: string) {
    try {
        await clearDeliveryUserStoredState(
            createBrowserDeliveryUserStoredState(),
            { userId, runId },
        );
        return true;
    } catch {
        // Storage may be unavailable in private/restricted browser contexts.
        return false;
    }
}

async function clearOtherStoredDriverRuns(userId: string, activeRunId: string) {
    try {
        await clearOtherOfflineRouteCacheScopes(
            createBrowserOfflineRouteCachePersistence(),
            { userId, activeRunId },
        );
        await clearOtherPickupManifestQueueScopes(
            createWebStoragePickupManifestQueuePersistence(window.localStorage),
            { userId, activeRunId },
        );
        await clearOtherDeliveryActionQueueScopes(
            createBrowserDeliveryActionQueuePersistence(),
            { userId, activeRunId },
        );
        return true;
    } catch {
        // A completion marker is retained when supporting cleanup is uncertain.
        return false;
    }
}

async function readDashboard({ signal }: { signal: AbortSignal }) {
    assertDeliveryOfflineWritesAllowed();
    const response = await fetch('/api/dashboard', {
        cache: 'no-store',
        signal,
    });
    const data: unknown = await response.json().catch(() => null);
    assertDeliveryOfflineWritesAllowed();
    if (!response.ok) {
        throw new Error('Podatke o dostavama trenutačno nije moguće učitati.');
    }
    if (!isDeliveryDashboard(data)) {
        throw new Error(
            'Poslužitelj je vratio neispravne podatke o dostavama.',
        );
    }
    return data;
}

function isDeliveryDashboard(value: unknown): value is DeliveryDashboardData {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('kind' in value) ||
        !('user' in value) ||
        typeof value.user !== 'object' ||
        value.user === null ||
        !('id' in value.user) ||
        typeof value.user.id !== 'string' ||
        !('displayName' in value.user) ||
        typeof value.user.displayName !== 'string' ||
        !('role' in value.user) ||
        typeof value.user.role !== 'string'
    ) {
        return false;
    }

    return value.kind === 'driver'
        ? 'activeRun' in value &&
              isSafeActiveRun(value.activeRun) &&
              'batches' in value &&
              Array.isArray(value.batches) &&
              'maximumRouteStops' in value &&
              typeof value.maximumRouteStops === 'number' &&
              'maximumRouteWindowHours' in value &&
              typeof value.maximumRouteWindowHours === 'number'
        : value.kind === 'customer' &&
              'deliveries' in value &&
              Array.isArray(value.deliveries);
}

function isSafeActiveRun(value: unknown) {
    if (value === null) return true;
    if (typeof value !== 'object') return false;

    return (
        'stops' in value &&
        Array.isArray(value.stops) &&
        'routeRevision' in value &&
        typeof value.routeRevision === 'number' &&
        Number.isInteger(value.routeRevision) &&
        value.routeRevision >= 0 &&
        'reroutePending' in value &&
        typeof value.reroutePending === 'boolean' &&
        'routeSteps' in value &&
        Array.isArray(value.routeSteps) &&
        value.routeSteps.every((step) => {
            if (
                typeof step !== 'object' ||
                step === null ||
                !('kind' in step)
            ) {
                return false;
            }
            if (step.kind === 'pickup') {
                return (
                    'pickup' in step &&
                    typeof step.pickup === 'object' &&
                    step.pickup !== null &&
                    'manifests' in step.pickup &&
                    Array.isArray(step.pickup.manifests)
                );
            }
            return (
                step.kind === 'delivery' &&
                'retryLaneRank' in step &&
                (step.retryLaneRank === null ||
                    (typeof step.retryLaneRank === 'number' &&
                        Number.isInteger(step.retryLaneRank) &&
                        step.retryLaneRank > 0)) &&
                'retryAttempt' in step &&
                typeof step.retryAttempt === 'number' &&
                Number.isInteger(step.retryAttempt) &&
                step.retryAttempt >= 0 &&
                'stop' in step &&
                typeof step.stop === 'object' &&
                step.stop !== null &&
                'deliveries' in step.stop &&
                Array.isArray(step.stop.deliveries)
            );
        })
    );
}

async function postAction(path: string, body?: object) {
    assertDeliveryOfflineWritesAllowed();
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data: unknown = await response.json().catch(() => null);
    assertDeliveryOfflineWritesAllowed();
    if (!response.ok) {
        const message =
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof data.error === 'string'
                ? data.error
                : 'Radnju nije moguće dovršiti.';
        const code =
            typeof data === 'object' &&
            data !== null &&
            'code' in data &&
            typeof data.code === 'string'
                ? data.code
                : null;
        throw new DeliveryActionError(message, response.status, code);
    }
    return data;
}

class DeliveryActionError extends Error {
    override name = 'DeliveryActionError';

    constructor(
        message: string,
        readonly status: number,
        readonly code: string | null,
    ) {
        super(message);
    }
}

function isDeliveryRunPreflightResponse(
    value: unknown,
): value is { preparationToken: string; expiresAt: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'preparationToken' in value &&
        typeof value.preparationToken === 'string' &&
        'expiresAt' in value &&
        typeof value.expiresAt === 'string'
    );
}

const refreshPreparationCodes = new Set([
    'delivery-request-changed',
    'delivery-source-changed',
    'preparation-expired',
    'preparation-not-found',
]);

type DeliveryActionResult =
    | { status: 'saved' }
    | {
          status: 'failed';
          code: string | null;
          statusCode: number | null;
          message: string;
      };

function DriverDashboardWithPickupSync({
    dashboard,
    routeWakeLock,
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onRetry,
    onActionError,
    onActionQueued,
    onServerStateChanged,
}: {
    dashboard: DriverDeliveryDashboard;
    routeWakeLock: DriverRouteWakeLockState;
    trackingState: ReturnType<typeof useDriverTracking>;
    pendingAction: string | null;
    onSelectionChange: () => void;
    onStartRun: (deliveryRequestIds: string[]) => void;
    onRetry: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onActionError: (error: unknown) => void;
    onActionQueued: (message: string) => void;
    onServerStateChanged: (
        expectation?: DeliveryServerStateExpectation,
    ) => Promise<boolean>;
}) {
    const activeRun = dashboard.activeRun;
    if (!activeRun) {
        return (
            <DriverDashboard
                dashboard={dashboard}
                routeWakeLock={routeWakeLock}
                trackingState={trackingState}
                pendingAction={pendingAction}
                onSelectionChange={onSelectionChange}
                onStartRun={onStartRun}
                onRetry={onRetry}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({
                    status: 'review-required',
                    message: 'Nema aktivne rute.',
                })}
                pickupQueue={null}
                deliveryQueue={null}
                onPickupScan={() => undefined}
                onPickupItemState={() => undefined}
                onConfirmPickupManifest={() => undefined}
                onRetryPickupSync={() => undefined}
                onDiscardPickupSync={() => undefined}
                onVerificationScan={() => undefined}
                onRetryDeliverySync={() => undefined}
                onDiscardDeliverySync={() => undefined}
                onReconcileDeliverySync={() => undefined}
            />
        );
    }

    return (
        <ActiveDriverDashboardWithPickupSync
            dashboard={dashboard}
            activeRunId={activeRun.id}
            routeWakeLock={routeWakeLock}
            trackingState={trackingState}
            pendingAction={pendingAction}
            onSelectionChange={onSelectionChange}
            onStartRun={onStartRun}
            onRetry={onRetry}
            onActionError={onActionError}
            onActionQueued={onActionQueued}
            onServerStateChanged={onServerStateChanged}
        />
    );
}

function ActiveDriverDashboardWithPickupSync({
    dashboard,
    activeRunId,
    routeWakeLock,
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onRetry,
    onActionError,
    onActionQueued,
    onServerStateChanged,
}: {
    dashboard: DriverDeliveryDashboard;
    activeRunId: string;
    routeWakeLock: DriverRouteWakeLockState;
    trackingState: ReturnType<typeof useDriverTracking>;
    pendingAction: string | null;
    onSelectionChange: () => void;
    onStartRun: (deliveryRequestIds: string[]) => void;
    onRetry: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onActionError: (error: unknown) => void;
    onActionQueued: (message: string) => void;
    onServerStateChanged: (
        expectation?: DeliveryServerStateExpectation,
    ) => Promise<boolean>;
}) {
    const pickupSync = usePickupManifestSync({
        userId: dashboard.user.id,
        runId: activeRunId,
        onAcknowledged: async () => {
            await onServerStateChanged();
        },
    });
    const deliverySync = useDeliveryActionSync({
        userId: dashboard.user.id,
        runId: activeRunId,
        refreshServerState: onServerStateChanged,
    });
    const serverAcknowledgementCount = deliverySync.snapshot.entries.filter(
        (entry) =>
            entry.command.kind !== 'verification-scan' &&
            entry.acknowledgement?.kind === 'server',
    ).length;
    const minimumAcknowledgedRouteRevision = Math.max(
        -1,
        ...deliverySync.snapshot.entries.flatMap((entry) =>
            entry.acknowledgement?.kind === 'server' &&
            entry.acknowledgement.routeRevision !== undefined
                ? [entry.acknowledgement.routeRevision]
                : [],
        ),
    );
    const reconcileDeliveryServerState =
        deliverySync.reconcilePendingServerState;
    useEffect(() => {
        if (
            dashboard.activeRun?.id !== activeRunId ||
            dashboard.activeRun.reroutePending ||
            dashboard.activeRun.routeRevision <
                minimumAcknowledgedRouteRevision ||
            serverAcknowledgementCount === 0
        ) {
            return;
        }
        void reconcileDeliveryServerState().catch(() => undefined);
    }, [
        activeRunId,
        dashboard.activeRun?.id,
        dashboard.activeRun?.reroutePending,
        dashboard.activeRun?.routeRevision,
        minimumAcknowledgedRouteRevision,
        reconcileDeliveryServerState,
        serverAcknowledgementCount,
    ]);
    const report = async (action: Promise<unknown>) => {
        try {
            await action;
        } catch (error) {
            onActionError(error);
        }
    };
    const reportQueued = async (
        action: Promise<unknown>,
        confirmation: string,
    ) => {
        try {
            await action;
            onActionQueued(confirmation);
        } catch (error) {
            onActionError(error);
        }
    };

    return (
        <DriverDashboard
            dashboard={dashboard}
            routeWakeLock={routeWakeLock}
            trackingState={trackingState}
            pendingAction={pendingAction}
            onSelectionChange={onSelectionChange}
            onStartRun={onStartRun}
            onRetry={onRetry}
            onArrive={(runId, stopId, routeRevision) => {
                if (runId !== activeRunId) return;
                void reportQueued(
                    deliverySync.enqueueArrive(stopId, routeRevision),
                    'Dolazak je spremljen. Oznaka čekanja nestat će nakon potvrde poslužitelja.',
                );
            }}
            onDeliver={(runId, stopId, routeRevision, notes) => {
                if (runId !== activeRunId) return;
                void reportQueued(
                    deliverySync.enqueueDelivery(stopId, routeRevision, notes),
                    'Dostava je spremljena. Oznaka čekanja nestat će nakon potvrde poslužitelja.',
                );
            }}
            onException={async (runId, stopId, mutation) => {
                if (runId !== activeRunId) {
                    return {
                        status: 'review-required',
                        message:
                            'Aktivna ruta se promijenila. Provjeri stanicu.',
                    };
                }
                try {
                    await deliverySync.enqueueException(stopId, mutation);
                    onActionQueued(
                        'Problem je spremljen na uređaju. Ruta se neće nastaviti dok poslužitelj ne potvrdi novi plan.',
                    );
                    return { status: 'saved' };
                } catch (error) {
                    onActionError(error);
                    return deliverySync.isBarrierError(error)
                        ? {
                              status: 'review-required',
                              message:
                                  'Prethodni problem još čeka sinkronizaciju. Pričekaj potvrdu nove rute.',
                          }
                        : {
                              status: 'retryable',
                              message:
                                  'Promjenu nije moguće sigurno spremiti na uređaj. Provjeri prostor i pokušaj ponovno.',
                          };
                }
            }}
            pickupQueue={pickupSync.snapshot}
            deliveryQueue={deliverySync.snapshot}
            onPickupScan={(pickupNodeId, scanValue) =>
                report(pickupSync.enqueueScan(pickupNodeId, scanValue))
            }
            onPickupItemState={(pickupNodeId, manifestId, stopId, outcome) =>
                report(
                    pickupSync.enqueueItemOutcome({
                        pickupNodeId,
                        manifestId,
                        stopId,
                        outcome,
                    }),
                )
            }
            onConfirmPickupManifest={(pickupNodeId, manifestId) =>
                report(pickupSync.enqueueConfirm(pickupNodeId, manifestId))
            }
            onRetryPickupSync={(operationId) =>
                report(pickupSync.retryEntry(operationId))
            }
            onDiscardPickupSync={(operationId) =>
                report(pickupSync.discardEntry(operationId))
            }
            onVerificationScan={(stopId, tracePath) =>
                void report(
                    deliverySync.enqueueVerificationScan(stopId, tracePath),
                )
            }
            onRetryDeliverySync={(operationId) =>
                report(deliverySync.retry(operationId))
            }
            onDiscardDeliverySync={(operationId) =>
                report(
                    deliverySync
                        .recoverConflict(operationId)
                        .then((changed) => {
                            if (!changed) {
                                throw new Error(
                                    'Novo stanje rute nije moguće potvrditi. Lokalna radnja ostaje spremljena.',
                                );
                            }
                        }),
                )
            }
            onReconcileDeliverySync={() =>
                report(
                    deliverySync
                        .reconcilePendingServerState()
                        .then((reconciled) => {
                            if (!reconciled) {
                                throw new Error(
                                    'Novi plan rute još nije moguće potvrditi. Iznimka ostaje blokirajuća.',
                                );
                            }
                        }),
                )
            }
        />
    );
}

export function DeliveryDashboard({
    authenticatedUserId,
    authenticatedRole,
}: {
    authenticatedUserId: string;
    authenticatedRole: string;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionConfirmation, setActionConfirmation] = useState<string | null>(
        null,
    );
    const [networkOnline, setNetworkOnline] = useState(true);
    const [offlineFallbackReady, setOfflineFallbackReady] = useState(false);
    const [logoutState, setLogoutState] = useState<
        'idle' | 'pending' | 'failed'
    >('idle');
    const [completedRunId, setCompletedRunId] = useState<string | null>(null);
    const [offlineSessionUserId, setOfflineSessionUserId] = useState<
        string | null
    >(null);
    const offlineSessionReady = offlineSessionUserId === authenticatedUserId;
    const sessionOperational = offlineSessionReady && logoutState === 'idle';
    const query = useQuery({
        queryKey: ['delivery-dashboard'],
        queryFn: readDashboard,
        enabled: sessionOperational,
        refetchInterval: 10_000,
    });
    const refetchDashboard = query.refetch;
    const dashboardData = query.data;
    const driverDashboard: DriverDeliveryDashboard | null =
        dashboardData?.kind === 'driver' ? dashboardData : null;
    const authenticatedDriverUserId =
        authenticatedRole === 'driver' || authenticatedRole === 'admin'
            ? authenticatedUserId
            : null;
    const verifyOfflineSession = useCallback(() => {
        const blockReason = deliveryOfflineWriteBlockReason();
        if (blockReason === 'stale-session') {
            window.location.reload();
            return false;
        }
        if (blockReason === 'logout') {
            setOfflineSessionUserId(null);
            setLogoutState((current) =>
                current === 'pending' ? current : 'failed',
            );
            queryClient.removeQueries({ queryKey: ['delivery-dashboard'] });
            return false;
        }
        setOfflineSessionUserId(authenticatedUserId);
        return true;
    }, [authenticatedUserId, queryClient]);
    useEffect(() => {
        const verify = () => void verifyOfflineSession();
        const verifyVisibleSession = () => {
            if (document.visibilityState === 'visible') verify();
        };
        verify();
        window.addEventListener('focus', verify);
        window.addEventListener('pageshow', verify);
        document.addEventListener('visibilitychange', verifyVisibleSession);
        return () => {
            window.removeEventListener('focus', verify);
            window.removeEventListener('pageshow', verify);
            document.removeEventListener(
                'visibilitychange',
                verifyVisibleSession,
            );
        };
    }, [verifyOfflineSession]);
    useEffect(() => {
        if (query.isError) verifyOfflineSession();
    }, [query.isError, verifyOfflineSession]);
    const offlineRoute = useOfflineRouteCache(
        sessionOperational ? authenticatedDriverUserId : null,
        sessionOperational ? driverDashboard : null,
    );
    const activeRun =
        dashboardData && 'activeRun' in dashboardData
            ? dashboardData.activeRun
            : null;
    const activeRunId = activeRun?.id ?? null;
    const routeWakeLock = useDriverRouteWakeLock({
        runId: sessionOperational
            ? dashboardData
                ? activeRunId
                : (offlineRoute?.scope.runId ?? null)
            : null,
    });
    const trackingState = useDriverTracking({
        runId: sessionOperational ? activeRunId : null,
        serverTracking: sessionOperational
            ? (activeRun?.tracking ?? null)
            : null,
        dashboardRefreshedAt:
            sessionOperational && dashboardData?.kind === 'driver'
                ? dashboardData.refreshedAt
                : null,
        onDashboardRefresh: async () => {
            await query.refetch();
        },
    });
    const driverWithoutActiveRun =
        query.data?.kind === 'driver' && !query.data.activeRun
            ? query.data.user.id
            : null;
    const currentDriverUserId =
        query.data?.kind === 'driver' ? query.data.user.id : null;
    const currentDriverRunId = driverDashboard?.activeRun?.id ?? null;
    const previousDriverUserIdRef = useRef<string | null>(null);
    const previousDriverRunScopeRef = useRef<{
        userId: string;
        runId: string;
    } | null>(null);
    const prunedDriverRunScopeRef = useRef<string | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(
            () => setOfflineFallbackReady(true),
            1_500,
        );
        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => {
        const update = () => setNetworkOnline(navigator.onLine);
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    useEffect(() => {
        const clearVisibleSession = () => {
            setLogoutState('pending');
            queryClient.removeQueries({ queryKey: ['delivery-dashboard'] });
        };
        const handleLocalLogout = () => clearVisibleSession();
        const handleLogoutCompleted = () => router.refresh();
        const handleLogoutFailed = () => setLogoutState('failed');
        window.addEventListener(deliveryLogoutEvent, handleLocalLogout);
        window.addEventListener(
            deliveryLogoutCompletedEvent,
            handleLogoutCompleted,
        );
        window.addEventListener(deliveryLogoutFailedEvent, handleLogoutFailed);
        const unsubscribeRemote = subscribeToRemoteDeliveryLogout({
            onLogout: () =>
                window.dispatchEvent(new Event(deliveryLogoutEvent)),
            onCompleted: () =>
                window.dispatchEvent(new Event(deliveryLogoutCompletedEvent)),
            onFailed: () =>
                window.dispatchEvent(new Event(deliveryLogoutFailedEvent)),
            onResumed: () => window.location.reload(),
        });
        return () => {
            window.removeEventListener(deliveryLogoutEvent, handleLocalLogout);
            window.removeEventListener(
                deliveryLogoutCompletedEvent,
                handleLogoutCompleted,
            );
            window.removeEventListener(
                deliveryLogoutFailedEvent,
                handleLogoutFailed,
            );
            unsubscribeRemote();
        };
    }, [queryClient, router]);

    useEffect(() => {
        const handleRunCompleted = (event: Event) => {
            if (!(event instanceof CustomEvent)) return;
            const detail: unknown = event.detail;
            if (
                typeof detail !== 'object' ||
                detail === null ||
                !('userId' in detail) ||
                detail.userId !== authenticatedUserId ||
                !('runId' in detail) ||
                typeof detail.runId !== 'string'
            ) {
                return;
            }
            setCompletedRunId(detail.runId);
            queryClient.removeQueries({ queryKey: ['delivery-dashboard'] });
            void refetchDashboard();
        };
        window.addEventListener(deliveryRunCompletedEvent, handleRunCompleted);
        return () =>
            window.removeEventListener(
                deliveryRunCompletedEvent,
                handleRunCompleted,
            );
    }, [authenticatedUserId, queryClient, refetchDashboard]);

    useEffect(() => {
        if (!completedRunId || query.data?.kind !== 'driver') return;
        if (query.data.activeRun?.id !== completedRunId) {
            setCompletedRunId(null);
        }
    }, [completedRunId, query.data]);

    useEffect(() => {
        if (authenticatedDriverUserId) return;
        void clearStoredDriverState(authenticatedUserId);
    }, [authenticatedDriverUserId, authenticatedUserId]);

    useEffect(() => {
        if (!driverWithoutActiveRun) return;
        let active = true;
        let running = false;
        let retryTimer: number | null = null;
        const cleanup = async () => {
            if (running) return;
            if (retryTimer) {
                window.clearTimeout(retryTimer);
                retryTimer = null;
            }
            running = true;
            const cleared = await clearStoredDriverState(
                driverWithoutActiveRun,
            );
            running = false;
            if (active && !cleared) {
                retryTimer = window.setTimeout(() => void cleanup(), 10_000);
            }
        };
        const handleOnline = () => void cleanup();
        void cleanup();
        window.addEventListener('online', handleOnline);
        return () => {
            active = false;
            if (retryTimer) window.clearTimeout(retryTimer);
            window.removeEventListener('online', handleOnline);
        };
    }, [driverWithoutActiveRun]);

    useEffect(() => {
        const previousUserId = previousDriverUserIdRef.current;
        if (previousUserId && previousUserId !== currentDriverUserId) {
            void clearStoredDriverState(previousUserId);
        }
        previousDriverUserIdRef.current = currentDriverUserId;
    }, [currentDriverUserId]);

    useEffect(() => {
        const currentScope =
            currentDriverRunId && currentDriverUserId
                ? {
                      userId: currentDriverUserId,
                      runId: currentDriverRunId,
                  }
                : null;
        const previousScope = previousDriverRunScopeRef.current;
        if (
            previousScope &&
            (!currentScope ||
                previousScope.userId !== currentScope.userId ||
                previousScope.runId !== currentScope.runId)
        ) {
            void clearStoredDriverState(
                previousScope.userId,
                previousScope.runId,
            );
        }
        previousDriverRunScopeRef.current = currentScope;
        if (!currentScope) return;

        const scopeKey = `${currentScope.userId}\u0000${currentScope.runId}`;
        if (prunedDriverRunScopeRef.current === scopeKey) return;

        let active = true;
        let running = false;
        let retryTimer: number | null = null;
        const prune = async () => {
            if (running || prunedDriverRunScopeRef.current === scopeKey) return;
            if (retryTimer) {
                window.clearTimeout(retryTimer);
                retryTimer = null;
            }
            running = true;
            const cleared = await clearOtherStoredDriverRuns(
                currentScope.userId,
                currentScope.runId,
            );
            running = false;
            if (!active) return;
            if (cleared) {
                prunedDriverRunScopeRef.current = scopeKey;
                return;
            }
            retryTimer = window.setTimeout(() => void prune(), 10_000);
        };
        const handleOnline = () => void prune();
        void prune();
        window.addEventListener('online', handleOnline);
        return () => {
            active = false;
            if (retryTimer) window.clearTimeout(retryTimer);
            window.removeEventListener('online', handleOnline);
        };
    }, [currentDriverRunId, currentDriverUserId]);

    const perform = async (
        key: string,
        path: string,
        body?: object,
        confirmation?: string,
    ): Promise<DeliveryActionResult> => {
        setPendingAction(key);
        setActionError(null);
        setActionConfirmation(null);
        try {
            await postAction(path, body);
            await query.refetch();
            setActionConfirmation(confirmation ?? null);
            return { status: 'saved' };
        } catch (error) {
            const code =
                error instanceof DeliveryActionError ? error.code : null;
            const statusCode =
                error instanceof DeliveryActionError ? error.status : null;
            if (statusCode === 409 || code === 'route-revision-conflict') {
                await query.refetch();
            }
            const message =
                error instanceof Error
                    ? error.message
                    : 'Radnju nije moguće dovršiti.';
            setActionError(message);
            return { status: 'failed', code, statusCode, message };
        } finally {
            setPendingAction(null);
        }
    };

    const refreshDriverServerState = async (
        expectation?: DeliveryServerStateExpectation,
    ) => {
        const refreshed = await query.refetch();
        if (!refreshed.isSuccess || refreshed.data?.kind !== 'driver') {
            return false;
        }
        if (!expectation) {
            setActionConfirmation(null);
            return true;
        }
        const refreshedRun = refreshed.data.activeRun;
        if (!refreshedRun || refreshedRun.id !== expectation.runId) {
            setActionConfirmation(null);
            return true;
        }
        if (expectation.runCompleted) return false;
        const minimumRouteRevision = expectation.minimumRouteRevision;
        const reconciled =
            !refreshedRun.reroutePending &&
            (minimumRouteRevision === undefined ||
                refreshedRun.routeRevision >= minimumRouteRevision);
        if (reconciled) setActionConfirmation(null);
        return reconciled;
    };

    const startRun = async (deliveryRequestIds: string[]) => {
        setPendingAction('start-route');
        setActionError(null);
        setActionConfirmation(null);
        try {
            const createPreparation = async () => {
                const data = await postAction('/api/driver/runs/preflight', {
                    deliveryRequestIds,
                });
                if (!isDeliveryRunPreflightResponse(data)) {
                    throw new Error(
                        'Poslužitelj nije vratio valjanu pripremu rute.',
                    );
                }
                return data;
            };
            const startPreparation = async (preparationToken: string) => {
                const body = { deliveryRequestIds, preparationToken };
                try {
                    await postAction('/api/driver/runs', body);
                } catch (error) {
                    if (
                        !(error instanceof DeliveryActionError) ||
                        error.status >= 500
                    ) {
                        await postAction('/api/driver/runs', body);
                        return;
                    }
                    throw error;
                }
            };

            const preparation = await createPreparation();
            try {
                await startPreparation(preparation.preparationToken);
            } catch (error) {
                if (
                    error instanceof DeliveryActionError &&
                    error.code &&
                    refreshPreparationCodes.has(error.code)
                ) {
                    const refreshedPreparation = await createPreparation();
                    await startPreparation(
                        refreshedPreparation.preparationToken,
                    );
                } else {
                    throw error;
                }
            }
            await query.refetch();
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Rutu nije moguće pokrenuti.',
            );
        } finally {
            setPendingAction(null);
        }
    };

    if (logoutState !== 'idle') {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                {logoutState === 'pending' ? (
                    <div
                        className="flex items-center gap-3 text-muted-foreground"
                        role="status"
                    >
                        <LoaderSpinner className="size-5 animate-spin" />
                        <Typography>Odjava…</Typography>
                    </div>
                ) : (
                    <Card
                        aria-atomic="true"
                        className="w-full max-w-md"
                        role="alert"
                    >
                        <CardContent
                            noHeader
                            className="space-y-4 p-6 text-center"
                        >
                            <Warning className="mx-auto size-9 text-warning" />
                            <Typography level="h3" semiBold>
                                Odjava nije potvrđena
                            </Typography>
                            <Typography className="text-muted-foreground">
                                Sigurno brisanje lokalnih podataka ili odjava na
                                poslužitelju nije potvrđena. Provjeri vezu i
                                pokušaj ponovno.
                            </Typography>
                            <Button
                                onClick={() =>
                                    void performDeliveryLogout(
                                        authenticatedUserId,
                                    )
                                }
                            >
                                Pokušaj odjavu ponovno
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </main>
        );
    }

    if (completedRunId) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <Card
                    aria-atomic="true"
                    aria-live="polite"
                    className="w-full max-w-md"
                    role="status"
                >
                    <CardContent noHeader className="space-y-4 p-6 text-center">
                        <Typography level="h3" semiBold>
                            Ruta je završena
                        </Typography>
                        <Typography className="text-muted-foreground">
                            Završena ruta uklonjena je s ovog uređaja. Novo
                            stanje prikazat će se nakon potvrde poslužitelja.
                        </Typography>
                        <Button
                            startDecorator={<Reset className="size-4" />}
                            onClick={() => void refetchDashboard()}
                        >
                            Učitaj novo stanje
                        </Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    if (!offlineSessionReady) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <div
                    className="flex items-center gap-3 text-muted-foreground"
                    role="status"
                >
                    <LoaderSpinner className="size-5 animate-spin" />
                    <Typography>Učitavanje dostava…</Typography>
                </div>
            </main>
        );
    }

    if (
        query.isPending &&
        !(offlineRoute && (!networkOnline || offlineFallbackReady))
    ) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <LoaderSpinner className="size-5 animate-spin" />
                    <Typography>Učitavanje dostava…</Typography>
                </div>
            </main>
        );
    }

    if (!query.data) {
        if (offlineRoute && authenticatedDriverUserId) {
            return (
                <OfflineRouteRecovery
                    snapshot={offlineRoute}
                    authenticatedUserId={authenticatedDriverUserId}
                    authenticatedRole={authenticatedRole}
                    routeWakeLock={routeWakeLock}
                    refreshServerState={refreshDriverServerState}
                />
            );
        }
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardContent noHeader className="space-y-4 p-6 text-center">
                        <Warning className="mx-auto size-9 text-warning" />
                        <Typography level="h3" semiBold>
                            Dostave nisu dostupne
                        </Typography>
                        <Typography className="text-muted-foreground">
                            {query.error instanceof Error
                                ? query.error.message
                                : 'Pokušaj ponovno za nekoliko trenutaka.'}
                        </Typography>
                        <Button
                            startDecorator={<Reset className="size-4" />}
                            onClick={() => void query.refetch()}
                        >
                            Pokušaj ponovno
                        </Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const dashboard = query.data;
    return (
        <>
            {!networkOnline || query.isError ? (
                <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl">
                    <Alert
                        color="warning"
                        startDecorator={<Warning className="size-5" />}
                    >
                        Veza nije dostupna. Trenutačni i sljedeći korak ostaju
                        na uređaju, a spremljene radnje čekaju potvrdu.
                    </Alert>
                </div>
            ) : null}
            {actionError ? (
                <div className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto max-w-xl">
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {actionError}
                    </Alert>
                </div>
            ) : null}
            {actionConfirmation ? (
                <div className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto max-w-xl">
                    <Alert
                        color="info"
                        endDecorator={
                            <Button
                                aria-label="Zatvori potvrdu"
                                color="info"
                                size="sm"
                                variant="plain"
                                onClick={() => setActionConfirmation(null)}
                            >
                                U redu
                            </Button>
                        }
                    >
                        {actionConfirmation}
                    </Alert>
                </div>
            ) : null}
            {dashboard.kind === 'driver' ? (
                <DriverDashboardWithPickupSync
                    dashboard={dashboard}
                    routeWakeLock={routeWakeLock}
                    trackingState={trackingState}
                    pendingAction={pendingAction}
                    onSelectionChange={() => {
                        setActionError(null);
                        setActionConfirmation(null);
                    }}
                    onStartRun={(deliveryRequestIds) =>
                        void startRun(deliveryRequestIds)
                    }
                    onRetry={(runId, stopId, expectedRouteRevision) =>
                        void perform(
                            `${stopId}:retry`,
                            `/api/driver/runs/${runId}/stops/${stopId}/retry`,
                            { expectedRouteRevision },
                        )
                    }
                    onActionError={(error) => {
                        setActionConfirmation(null);
                        setActionError(
                            error instanceof Error
                                ? error.message
                                : 'Promjenu dostave nije moguće spremiti.',
                        );
                    }}
                    onActionQueued={(message) => {
                        setActionError(null);
                        setActionConfirmation(message);
                    }}
                    onServerStateChanged={refreshDriverServerState}
                />
            ) : (
                <CustomerDashboard dashboard={dashboard} />
            )}
            {!networkOnline || query.isError ? (
                <div aria-hidden="true" className="h-32 sm:h-24" />
            ) : null}
        </>
    );
}
