'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { LoaderSpinner, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useDriverTracking } from '../hooks/useDriverTracking';
import { usePickupManifestSync } from '../hooks/usePickupManifestSync';
import type {
    DeliveryDashboard as DeliveryDashboardData,
    DriverDeliveryDashboard,
} from '../lib/deliveryDashboardTypes';
import {
    type DeliveryExceptionMutation,
    type DeliveryExceptionSubmitResult,
    deliveryExceptionConfirmation,
} from '../lib/deliveryExceptionPresentation';
import {
    clearPickupManifestQueueScope,
    createWebStoragePickupManifestQueuePersistence,
} from '../lib/pickupManifestQueue';
import { CustomerDashboard } from './CustomerDashboard';
import { DriverDashboard } from './DriverDashboard';

async function clearStoredPickupQueues(userId: string) {
    try {
        await clearPickupManifestQueueScope(
            createWebStoragePickupManifestQueuePersistence(window.localStorage),
            { userId },
        );
    } catch {
        // Storage may be unavailable in private/restricted browser contexts.
    }
}

async function readDashboard() {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Podatke o dostavama trenutačno nije moguće učitati.');
    }
    const data: unknown = await response.json();
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
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data: unknown = await response.json().catch(() => null);
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

type DeliveryExceptionAction = (
    runId: string,
    stopId: number,
    mutation: DeliveryExceptionMutation,
) => Promise<DeliveryExceptionSubmitResult>;

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
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onRetry,
    onArrive,
    onDeliver,
    onException,
    onPickupError,
    onPickupAcknowledged,
}: {
    dashboard: DriverDeliveryDashboard;
    trackingState: ReturnType<typeof useDriverTracking>;
    pendingAction: string | null;
    onSelectionChange: () => void;
    onStartRun: (deliveryRequestIds: string[]) => void;
    onRetry: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onArrive: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onDeliver: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
        notes?: string,
    ) => void;
    onException: DeliveryExceptionAction;
    onPickupError: (error: unknown) => void;
    onPickupAcknowledged: () => void | Promise<void>;
}) {
    const activeRun = dashboard.activeRun;
    if (!activeRun) {
        return (
            <DriverDashboard
                dashboard={dashboard}
                trackingState={trackingState}
                pendingAction={pendingAction}
                onSelectionChange={onSelectionChange}
                onStartRun={onStartRun}
                onRetry={onRetry}
                onArrive={onArrive}
                onDeliver={onDeliver}
                onException={onException}
                pickupQueue={null}
                onPickupScan={() => undefined}
                onPickupItemState={() => undefined}
                onConfirmPickupManifest={() => undefined}
                onRetryPickupSync={() => undefined}
                onDiscardPickupSync={() => undefined}
            />
        );
    }

    return (
        <ActiveDriverDashboardWithPickupSync
            dashboard={dashboard}
            activeRunId={activeRun.id}
            trackingState={trackingState}
            pendingAction={pendingAction}
            onSelectionChange={onSelectionChange}
            onStartRun={onStartRun}
            onRetry={onRetry}
            onArrive={onArrive}
            onDeliver={onDeliver}
            onException={onException}
            onPickupError={onPickupError}
            onPickupAcknowledged={onPickupAcknowledged}
        />
    );
}

function ActiveDriverDashboardWithPickupSync({
    dashboard,
    activeRunId,
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onRetry,
    onArrive,
    onDeliver,
    onException,
    onPickupError,
    onPickupAcknowledged,
}: {
    dashboard: DriverDeliveryDashboard;
    activeRunId: string;
    trackingState: ReturnType<typeof useDriverTracking>;
    pendingAction: string | null;
    onSelectionChange: () => void;
    onStartRun: (deliveryRequestIds: string[]) => void;
    onRetry: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onArrive: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
    ) => void;
    onDeliver: (
        runId: string,
        stopId: number,
        expectedRouteRevision: number,
        notes?: string,
    ) => void;
    onException: DeliveryExceptionAction;
    onPickupError: (error: unknown) => void;
    onPickupAcknowledged: () => void | Promise<void>;
}) {
    const pickupSync = usePickupManifestSync({
        userId: dashboard.user.id,
        runId: activeRunId,
        onAcknowledged: onPickupAcknowledged,
    });
    const report = async (action: Promise<unknown>) => {
        try {
            await action;
        } catch (error) {
            onPickupError(error);
        }
    };

    return (
        <DriverDashboard
            dashboard={dashboard}
            trackingState={trackingState}
            pendingAction={pendingAction}
            onSelectionChange={onSelectionChange}
            onStartRun={onStartRun}
            onRetry={onRetry}
            onArrive={onArrive}
            onDeliver={onDeliver}
            onException={onException}
            pickupQueue={pickupSync.snapshot}
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
        />
    );
}

export function DeliveryDashboard() {
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionConfirmation, setActionConfirmation] = useState<string | null>(
        null,
    );
    const query = useQuery({
        queryKey: ['delivery-dashboard'],
        queryFn: readDashboard,
        refetchInterval: 10_000,
    });
    const dashboardData = query.data;
    const activeRun =
        dashboardData && 'activeRun' in dashboardData
            ? dashboardData.activeRun
            : null;
    const activeRunId = activeRun?.id ?? null;
    const trackingState = useDriverTracking({
        runId: activeRunId,
        serverTracking: activeRun?.tracking ?? null,
        dashboardRefreshedAt:
            dashboardData?.kind === 'driver' ? dashboardData.refreshedAt : null,
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
    const previousDriverUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!driverWithoutActiveRun) return;
        void clearStoredPickupQueues(driverWithoutActiveRun);
    }, [driverWithoutActiveRun]);

    useEffect(() => {
        const previousUserId = previousDriverUserIdRef.current;
        if (previousUserId && previousUserId !== currentDriverUserId) {
            void clearStoredPickupQueues(previousUserId);
        }
        previousDriverUserIdRef.current = currentDriverUserId;
    }, [currentDriverUserId]);

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

    if (query.isPending) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <LoaderSpinner className="size-5 animate-spin" />
                    <Typography>Učitavanje dostava…</Typography>
                </div>
            </main>
        );
    }

    if (query.isError || !query.data) {
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
            {actionError ? (
                <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl">
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {actionError}
                    </Alert>
                </div>
            ) : null}
            {actionConfirmation ? (
                <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl">
                    <Alert
                        color="success"
                        endDecorator={
                            <Button
                                aria-label="Zatvori potvrdu"
                                color="success"
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
                    onArrive={(runId, stopId, expectedRouteRevision) =>
                        void perform(
                            `${stopId}:arrive`,
                            `/api/driver/runs/${runId}/stops/${stopId}/arrive`,
                            {
                                expectedRouteRevision,
                            },
                        )
                    }
                    onDeliver={(runId, stopId, expectedRouteRevision, notes) =>
                        void perform(
                            `${stopId}:deliver`,
                            `/api/driver/runs/${runId}/stops/${stopId}/deliver`,
                            {
                                notes,
                                expectedRouteRevision,
                            },
                        )
                    }
                    onException={async (runId, stopId, mutation) => {
                        const result = await perform(
                            `${stopId}:exception`,
                            `/api/driver/runs/${runId}/exceptions`,
                            mutation,
                            deliveryExceptionConfirmation(mutation),
                        );
                        if (result.status === 'saved') {
                            return result;
                        }
                        if (result.statusCode === 409) {
                            return {
                                status: 'review-required',
                                message:
                                    'Ruta ili odabrani urodi promijenili su se. Provjeri osvježeni odabir i ponovno potvrdi spremanje.',
                            };
                        }
                        return {
                            status: 'retryable',
                            message:
                                'Promjena možda nije potvrđena. Provjeri vezu i pokušaj ponovno bez izmjene odabira.',
                        };
                    }}
                    onPickupError={(error) => {
                        setActionConfirmation(null);
                        setActionError(
                            error instanceof Error
                                ? error.message
                                : 'Promjenu preuzimanja nije moguće spremiti.',
                        );
                    }}
                    onPickupAcknowledged={async () => {
                        await query.refetch();
                    }}
                />
            ) : (
                <CustomerDashboard dashboard={dashboard} />
            )}
        </>
    );
}
