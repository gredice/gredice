'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Map as MapIcon,
    MapPin,
    Play,
    Reset,
    Timer,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import type {
    ActiveDeliveryRunSummary,
    DeliveryPickupStepSummary,
    DeliveryRouteOrderSummary,
    DriverDeliveryDashboard,
} from '../lib/deliveryDashboardTypes';
import type {
    DeliveryExceptionMutation,
    DeliveryExceptionSubmitResult,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import {
    applyDeliveryRouteSelection,
    deliveryRouteSelectionCandidatesFromBatches,
    inspectDeliveryRouteSelection,
} from '../lib/deliveryRouteSelection';
import { groupByDeliveryStop } from '../lib/deliveryStopGrouping';
import { deliveryTrackingMapVersion } from '../lib/deliveryTrackingPresentation';
import {
    normalizeHarvestTraceScanValue,
    selectDeliveryStopFromHarvestTrace,
} from '../lib/harvestTraceScan';
import type {
    PickupManifestQueueEntry,
    PickupManifestQueueSnapshot,
} from '../lib/pickupManifestQueue';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DeliveryBatchCard } from './DeliveryBatchCard';
import { DeliveryMap } from './DeliveryMap';
import {
    DeliveryPickupCard,
    type PickupManifestSyncSummary,
} from './DeliveryPickupCard';
import { DeliveryStopCard } from './DeliveryStopCard';
import { DriverTrackingStatus } from './DriverTrackingStatus';
import { HarvestTraceScanner } from './HarvestTraceScanner';

function routeEstimateSourceLabel(
    source: ActiveDeliveryRunSummary['estimateSource'],
) {
    switch (source) {
        case 'google':
            return 'Google promet';
        case 'local':
            return 'Lokalno, bez prometa';
        case 'legacy':
            return 'Starija procjena';
    }
}

function queuedPickup(
    pickup: DeliveryPickupStepSummary,
    entries: readonly PickupManifestQueueEntry[],
) {
    const applicableEntries = entries.filter(
        (entry) =>
            entry.command.pickupNodeId === pickup.id &&
            entry.state !== 'conflicted',
    );
    if (applicableEntries.length === 0) return pickup;

    const manifests = pickup.manifests.map((manifest) => ({
        ...manifest,
        items: manifest.items.map((item) => ({ ...item })),
    }));
    for (const entry of applicableEntries) {
        const command = entry.command;
        if (command.kind === 'scan') {
            for (const manifest of manifests) {
                for (const item of manifest.items) {
                    if (
                        item.tracePath === command.tracePath &&
                        item.state !== 'scanned' &&
                        item.state !== 'missing-label'
                    ) {
                        item.state = 'scanned';
                    }
                }
            }
            continue;
        }
        if (command.kind === 'manual-outcome') {
            const manifest = manifests.find(
                (candidate) => candidate.id === command.manifestId,
            );
            const item = manifest?.items.find(
                (candidate) => candidate.stopId === command.stopId,
            );
            if (item) item.state = command.outcome;
        }
    }

    const summarizedManifests = manifests.map((manifest) => {
        const scannedCount = manifest.items.filter(
            (item) => item.state === 'scanned',
        ).length;
        const missingLabelCount = manifest.items.filter(
            (item) => item.state === 'missing-label',
        ).length;
        const notReadyCount = manifest.items.filter(
            (item) => item.state === 'not-ready',
        ).length;
        return {
            ...manifest,
            scannedCount,
            missingLabelCount,
            notReadyCount,
            remainingCount:
                manifest.expectedCount - scannedCount - missingLabelCount,
        };
    });
    return {
        ...pickup,
        manifests: summarizedManifests,
        scannedCount: summarizedManifests.reduce(
            (count, manifest) => count + manifest.scannedCount,
            0,
        ),
        missingLabelCount: summarizedManifests.reduce(
            (count, manifest) => count + manifest.missingLabelCount,
            0,
        ),
        notReadyCount: summarizedManifests.reduce(
            (count, manifest) => count + manifest.notReadyCount,
            0,
        ),
        remainingCount: summarizedManifests.reduce(
            (count, manifest) => count + manifest.remainingCount,
            0,
        ),
    };
}

function pickupSyncSummary(
    pickupNodeId: string,
    snapshot: PickupManifestQueueSnapshot | null,
): PickupManifestSyncSummary {
    const entries =
        snapshot?.entries.filter(
            (entry) => entry.command.pickupNodeId === pickupNodeId,
        ) ?? [];
    const coordination = snapshot?.coordination ?? 'coordinated';
    const pendingEntries = entries.filter((entry) => entry.state !== 'synced');
    const conflicted = pendingEntries.find(
        (entry) => entry.state === 'conflicted',
    );
    if (conflicted) {
        return {
            state: 'conflicted',
            pendingCount: pendingEntries.length,
            durability: snapshot?.durability ?? 'durable',
            coordination,
            blockingOperationId: conflicted.command.operationId,
            message: pickupQueueErrorMessage(conflicted.errorCode, false),
        };
    }
    const failed = pendingEntries.find((entry) => entry.state === 'failed');
    if (failed) {
        return {
            state: 'failed',
            pendingCount: pendingEntries.length,
            durability: snapshot?.durability ?? 'durable',
            coordination,
            blockingOperationId: failed.command.operationId,
            message: pickupQueueErrorMessage(failed.errorCode, true),
        };
    }
    if (pendingEntries.some((entry) => entry.state === 'sending')) {
        return {
            state: 'sending',
            pendingCount: pendingEntries.length,
            durability: snapshot?.durability ?? 'durable',
            coordination,
            blockingOperationId: null,
        };
    }
    if (pendingEntries.length > 0) {
        return {
            state: 'queued',
            pendingCount: pendingEntries.length,
            durability: snapshot?.durability ?? 'durable',
            coordination,
            blockingOperationId: null,
        };
    }
    return {
        state: 'idle',
        pendingCount: 0,
        durability: snapshot?.durability ?? 'durable',
        coordination,
        blockingOperationId: null,
    };
}

function pickupQueueErrorMessage(code: string | undefined, retryable: boolean) {
    switch (code) {
        case 'pickup-trace-not-found':
            return 'Očitani QR nije pronađen na ovom manifestu. Provjeri etiketu ili odbaci očitanje.';
        case 'pickup-trace-ambiguous':
            return 'Očitani QR pripada različitim skupnim stanicama. Provjeri urode ručno i odbaci očitanje.';
        case 'pickup-operation-conflict':
            return 'Promjena je već poslana s drugim podacima. Odbaci lokalnu kopiju i osvježi manifest.';
        case 'pickup-not-current':
        case 'route-order':
        case 'pickup-dependency-pending':
            return 'Ruta se promijenila. Odbaci lokalnu promjenu i učitaj trenutačni korak.';
        case 'offline':
        case 'transport-error':
            return 'Promjena je spremljena na uređaju. Provjeri vezu i pokušaj ponovno.';
        default:
            return retryable
                ? 'Promjena čeka provjeru. Pokušaj ponovno nakon provjere veze.'
                : 'Promjenu nije moguće ponovno poslati. Odbaci je i provjeri trenutačni manifest.';
    }
}

export function DriverDashboard({
    dashboard,
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onRetry,
    onArrive,
    onDeliver,
    onException,
    pickupQueue,
    onPickupScan,
    onPickupItemState,
    onConfirmPickupManifest,
    onRetryPickupSync,
    onDiscardPickupSync,
}: {
    dashboard: DriverDeliveryDashboard;
    trackingState: DriverTrackingState;
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
    onException: (
        runId: string,
        stopId: number,
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
    pickupQueue: PickupManifestQueueSnapshot | null;
    onPickupScan: (pickupNodeId: string, scanValue: string) => void;
    onPickupItemState: (
        pickupNodeId: string,
        manifestId: string,
        stopId: number,
        outcome: 'ready' | 'missing-label' | 'not-ready',
    ) => void;
    onConfirmPickupManifest: (
        pickupNodeId: string,
        manifestId: string,
    ) => void | Promise<void>;
    onRetryPickupSync: (operationId: string) => void | Promise<void>;
    onDiscardPickupSync: (operationId: string) => void | Promise<void>;
}) {
    const run = dashboard.activeRun;
    const [selectedRequestIds, setSelectedRequestIdsState] = useState<string[]>(
        [],
    );
    const [rejectedSelectionAttempt, setRejectedSelectionAttempt] = useState<{
        currentRequestIds: string[];
        nextRequestIds: string[];
    } | null>(null);
    const selectedRequestIdsRef = useRef<string[]>([]);
    const availableOrders = dashboard.batches.flatMap((batch) => batch.orders);
    const selectableOrders = availableOrders.filter(
        (order) => order.readyForPickup,
    );
    const availableRequestIds = selectableOrders.map(
        (order) => order.requestId,
    );
    const availableRequestIdSet = new Set(availableRequestIds);
    const ordersByRequestId = new Map(
        availableOrders.map((order) => [order.requestId, order]),
    );
    const availableStopGroups = groupByDeliveryStop(selectableOrders);
    const selectionCandidates = deliveryRouteSelectionCandidatesFromBatches(
        dashboard.batches,
    );
    const effectiveSelectedRequestIds = selectedRequestIds.filter((requestId) =>
        availableRequestIdSet.has(requestId),
    );
    const selectedRequestIdSet = new Set(effectiveSelectedRequestIds);
    const selectedStopKeys = new Set(
        effectiveSelectedRequestIds.flatMap((requestId) => {
            const order = ordersByRequestId.get(requestId);
            return order ? [order.stopKey] : [];
        }),
    );
    const selectionInspection = inspectDeliveryRouteSelection({
        candidates: selectionCandidates,
        requestIds: effectiveSelectedRequestIds,
        maximumRouteStops: dashboard.maximumRouteStops,
        maximumRouteWindowHours: dashboard.maximumRouteWindowHours,
    });
    const selectionLimitReached =
        selectionInspection.summary.routeNodeCount >=
        dashboard.maximumRouteStops + 1;
    const selectedSlotCount = selectionInspection.summary.slots.length;
    const selectedPickupLocationCount =
        selectionInspection.summary.pickupLocations.length;
    const selectedWindowSpanHours = Math.ceil(
        selectionInspection.summary.windowSpanMinutes / 60,
    );
    const reconciledRejectedSelection = rejectedSelectionAttempt
        ? applyDeliveryRouteSelection({
              candidates: selectionCandidates,
              currentRequestIds: rejectedSelectionAttempt.currentRequestIds,
              nextRequestIds: rejectedSelectionAttempt.nextRequestIds,
              maximumRouteStops: dashboard.maximumRouteStops,
              maximumRouteWindowHours: dashboard.maximumRouteWindowHours,
          })
        : null;
    const activeSelectionConflict =
        reconciledRejectedSelection?.status === 'rejected'
            ? reconciledRejectedSelection.conflict
            : selectionInspection.conflict;
    const availableTraceCount = new Set(
        selectableOrders.flatMap((order) =>
            order.harvest.tracePath ? [order.harvest.tracePath] : [],
        ),
    ).size;

    const replaceSelectedRequestIds = (requestIds: string[]) => {
        selectedRequestIdsRef.current = requestIds;
        setSelectedRequestIdsState(requestIds);
    };

    const applySelectedRequestIds = (requestIds: string[]) => {
        onSelectionChange();
        const currentRequestIds = selectedRequestIdsRef.current;
        const result = applyDeliveryRouteSelection({
            candidates: selectionCandidates,
            currentRequestIds,
            nextRequestIds: requestIds,
            maximumRouteStops: dashboard.maximumRouteStops,
            maximumRouteWindowHours: dashboard.maximumRouteWindowHours,
        });
        if (result.status === 'rejected') {
            setRejectedSelectionAttempt({
                currentRequestIds,
                nextRequestIds: requestIds,
            });
            return result;
        }

        setRejectedSelectionAttempt(null);
        replaceSelectedRequestIds(result.requestIds);
        return result;
    };

    const updateSelectedRequestIds = (
        update: (current: string[]) => string[],
    ) => {
        const nextRequestIds = update(selectedRequestIdsRef.current);
        return applySelectedRequestIds(nextRequestIds);
    };

    const appendCompatibleStopGroups = (
        currentRequestIds: string[],
        groups: Array<{
            stopKey: string;
            items: DeliveryRouteOrderSummary[];
        }>,
    ) => {
        let acceptedRequestIds = currentRequestIds;
        for (const group of groups) {
            const result = applyDeliveryRouteSelection({
                candidates: selectionCandidates,
                currentRequestIds: acceptedRequestIds,
                nextRequestIds: [
                    ...acceptedRequestIds,
                    ...group.items.map((order) => order.requestId),
                ],
                maximumRouteStops: dashboard.maximumRouteStops,
                maximumRouteWindowHours: dashboard.maximumRouteWindowHours,
            });
            if (result.status === 'accepted') {
                acceptedRequestIds = result.requestIds;
            }
        }
        return acceptedRequestIds;
    };

    const toggleOrder = (requestId: string, checked: boolean) => {
        const order = ordersByRequestId.get(requestId);
        if (!order?.readyForPickup) return;
        const groupedRequestIds = selectableOrders.flatMap((candidate) =>
            candidate.stopKey === order.stopKey ? [candidate.requestId] : [],
        );
        const groupedRequestIdSet = new Set(groupedRequestIds);
        updateSelectedRequestIds((current) => {
            const availableCurrent = current.filter((id) =>
                availableRequestIdSet.has(id),
            );
            if (!checked) {
                return availableCurrent.filter(
                    (id) => !groupedRequestIdSet.has(id),
                );
            }
            return Array.from(
                new Set([...availableCurrent, ...groupedRequestIds]),
            );
        });
    };

    const toggleBatch = (
        batch: DriverDeliveryDashboard['batches'][number],
        checked: boolean,
    ) => {
        const readyBatchOrders = batch.orders.filter(
            (order) => order.readyForPickup,
        );
        const batchIds = new Set(
            readyBatchOrders.map((order) => order.requestId),
        );
        updateSelectedRequestIds((current) => {
            const availableCurrent = current.filter((id) =>
                availableRequestIdSet.has(id),
            );
            if (!checked) {
                return availableCurrent.filter((id) => !batchIds.has(id));
            }

            return appendCompatibleStopGroups(
                availableCurrent,
                groupByDeliveryStop(readyBatchOrders),
            );
        });
    };

    const selectAllAvailable = () => {
        applySelectedRequestIds(
            appendCompatibleStopGroups([], availableStopGroups),
        );
    };

    const scanHarvestTrace = (value: string) => {
        const result = selectDeliveryStopFromHarvestTrace({
            orders: availableOrders,
            selectedRequestIds: selectedRequestIdsRef.current,
            maximumRouteStops: dashboard.maximumRouteStops,
            scanValue: value,
        });

        if (result.status === 'selected') {
            const selectionResult = applySelectedRequestIds(
                result.nextSelectedRequestIds,
            );
            if (selectionResult.status === 'rejected') {
                return {
                    ...result,
                    status: 'route-conflict' as const,
                    message: selectionResult.conflict.message,
                    code: selectionResult.conflict.code,
                    conflictingRequestIds:
                        selectionResult.conflict.conflictingRequestIds,
                    separateRouteRequestIds:
                        selectionResult.conflict.separateRouteRequestIds,
                };
            }
        }

        return result;
    };

    return (
        <div className="min-h-[100dvh] bg-background">
            <DeliveryAppHeader
                displayName={dashboard.user.displayName}
                role={dashboard.user.role}
            />
            <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:py-8">
                <div>
                    <Typography level="h2" semiBold>
                        {run ? 'Aktivna ruta' : 'Preuzimanje uroda'}
                    </Typography>
                    <Typography className="mt-1 text-muted-foreground">
                        {run
                            ? 'Slijedi redoslijed stanica, potvrdi dolazak i nastavi nakon svake dostave.'
                            : 'Odaberi urode koje je lokacija preuzimanja označila spremnima. Zatim se računa povezana ruta kroz sve lokacije.'}
                    </Typography>
                </div>

                {run ? (
                    <>
                        <DriverTrackingStatus tracking={trackingState} />
                        {run.reroutePending ? (
                            <Alert
                                color="warning"
                                startDecorator={<Timer className="size-5" />}
                            >
                                Preostala ruta i vremena dolaska se ažuriraju.
                            </Alert>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
                            <DeliveryMap
                                mapUrl={run.mapUrl}
                                version={deliveryTrackingMapVersion(
                                    run.tracking,
                                    run.estimatesUpdatedAt,
                                )}
                                title="Karta aktivne dostavne rute"
                            />
                            <Card>
                                <CardContent
                                    noHeader
                                    className="grid h-full grid-cols-2 gap-3 p-4"
                                >
                                    <div className="rounded-lg bg-muted p-3">
                                        <MapIcon className="mb-2 size-5 text-primary" />
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Ukupno
                                        </Typography>
                                        <Typography level="body1" semiBold>
                                            {formatDistance(
                                                run.totalDistanceMeters,
                                            )}
                                        </Typography>
                                    </div>
                                    <div className="rounded-lg bg-muted p-3">
                                        <Timer className="mb-2 size-5 text-primary" />
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Procjena rute
                                        </Typography>
                                        <Typography level="body1" semiBold>
                                            {formatTravelDuration(
                                                run.totalDurationSeconds,
                                            )}
                                        </Typography>
                                        <Chip
                                            aria-label={`Izvor procjene rute: ${routeEstimateSourceLabel(run.estimateSource)}. Verzija plana ${run.routePlanVersion}.`}
                                            className="mt-2"
                                            color={
                                                run.estimateSource === 'google'
                                                    ? 'info'
                                                    : run.estimateSource ===
                                                        'local'
                                                      ? 'warning'
                                                      : 'neutral'
                                            }
                                            size="sm"
                                            title={`Plan rute v${run.routePlanVersion}`}
                                            variant="soft"
                                        >
                                            {routeEstimateSourceLabel(
                                                run.estimateSource,
                                            )}
                                        </Chip>
                                    </div>
                                    <div className="col-span-2 rounded-lg border p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Dostavljeno
                                            </Typography>
                                            <Chip color="success" size="sm">
                                                {
                                                    run.stops.filter(
                                                        (stop) =>
                                                            stop.statusLabel ===
                                                            'Dostavljeno',
                                                    ).length
                                                }{' '}
                                                / {run.stops.length}
                                            </Chip>
                                        </div>
                                        <Typography
                                            level="body3"
                                            className="mt-1 text-muted-foreground"
                                        >
                                            {run.deliveryCount}{' '}
                                            {run.deliveryCount === 1
                                                ? 'urod'
                                                : 'uroda'}{' '}
                                            na {run.stops.length}{' '}
                                            {run.stops.length === 1
                                                ? 'stanici'
                                                : 'stanica'}
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="mt-1"
                                        >
                                            {formatDeliveryDateTime(
                                                run.startedAt,
                                            )}
                                        </Typography>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="size-5 text-primary" />
                                <Typography level="h3" semiBold>
                                    Tijek rute
                                </Typography>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {run.routeSteps.map((step) => {
                                    if (step.kind === 'pickup') {
                                        const pickup = queuedPickup(
                                            step.pickup,
                                            pickupQueue?.entries ?? [],
                                        );
                                        return (
                                            <DeliveryPickupCard
                                                key={`pickup:${pickup.id}`}
                                                pickup={pickup}
                                                actionState={step.actionState}
                                                pendingAction={pendingAction}
                                                sync={pickupSyncSummary(
                                                    pickup.id,
                                                    pickupQueue,
                                                )}
                                                onScan={(scanValue) => {
                                                    const tracePath =
                                                        normalizeHarvestTraceScanValue(
                                                            scanValue,
                                                        );
                                                    if (!tracePath) {
                                                        return {
                                                            status: 'pickup-invalid',
                                                        };
                                                    }
                                                    const matchingItems =
                                                        pickup.manifests.flatMap(
                                                            (manifest) =>
                                                                manifest.items.filter(
                                                                    (item) =>
                                                                        item.tracePath ===
                                                                        tracePath,
                                                                ),
                                                        );
                                                    if (
                                                        matchingItems.length ===
                                                        0
                                                    ) {
                                                        return {
                                                            status: 'pickup-not-at-location',
                                                            tracePath,
                                                        };
                                                    }
                                                    if (
                                                        new Set(
                                                            matchingItems.map(
                                                                (item) =>
                                                                    item.stopKey,
                                                            ),
                                                        ).size > 1
                                                    ) {
                                                        return {
                                                            status: 'pickup-ambiguous',
                                                            tracePath,
                                                        };
                                                    }
                                                    const pendingItems =
                                                        matchingItems.filter(
                                                            (item) =>
                                                                item.state ===
                                                                    'ready' ||
                                                                item.state ===
                                                                    'not-ready',
                                                        );
                                                    const firstItem =
                                                        matchingItems[0];
                                                    if (!firstItem) {
                                                        return {
                                                            status: 'pickup-not-at-location',
                                                            tracePath,
                                                        };
                                                    }
                                                    if (
                                                        pendingItems.length >
                                                            0 &&
                                                        pendingItems.every(
                                                            (item) =>
                                                                item.state ===
                                                                'not-ready',
                                                        )
                                                    ) {
                                                        return {
                                                            status: 'pickup-not-ready',
                                                            tracePath,
                                                            plantName:
                                                                firstItem
                                                                    .harvest
                                                                    .plantName,
                                                        };
                                                    }
                                                    if (
                                                        pendingItems.length ===
                                                        0
                                                    ) {
                                                        return {
                                                            status: 'pickup-already-collected',
                                                            tracePath,
                                                            plantName:
                                                                firstItem
                                                                    .harvest
                                                                    .plantName,
                                                        };
                                                    }
                                                    onPickupScan(
                                                        pickup.id,
                                                        tracePath,
                                                    );
                                                    return {
                                                        status: 'pickup-queued',
                                                        tracePath,
                                                        plantName:
                                                            firstItem.harvest
                                                                .plantName,
                                                        matchedCount:
                                                            pendingItems.length,
                                                    };
                                                }}
                                                onSetItemState={(
                                                    pickupNodeId,
                                                    manifestId,
                                                    stopId,
                                                    outcome,
                                                ) =>
                                                    onPickupItemState(
                                                        pickupNodeId,
                                                        manifestId,
                                                        stopId,
                                                        outcome,
                                                    )
                                                }
                                                onResolveRemaining={(
                                                    pickupNodeId,
                                                    manifest,
                                                ) => {
                                                    for (const item of manifest.items) {
                                                        if (
                                                            item.state ===
                                                            'ready'
                                                        ) {
                                                            onPickupItemState(
                                                                pickupNodeId,
                                                                manifest.id,
                                                                item.stopId,
                                                                'missing-label',
                                                            );
                                                        }
                                                    }
                                                }}
                                                onConfirmManifest={
                                                    onConfirmPickupManifest
                                                }
                                                onRetrySync={onRetryPickupSync}
                                                onDiscardSync={
                                                    onDiscardPickupSync
                                                }
                                            />
                                        );
                                    }
                                    const stop = {
                                        ...step.stop,
                                        actionState: step.actionState,
                                        lockedReason: step.lockedReason,
                                        isCurrent:
                                            step.actionState === 'current',
                                    };
                                    return (
                                        <div
                                            key={`delivery:${stop.id ?? stop.requestId}`}
                                            className="space-y-2"
                                        >
                                            {step.retryLaneRank !== null ? (
                                                <Chip color="warning" size="sm">
                                                    Ponovni pokušaj #
                                                    {step.retryLaneRank}
                                                    {step.retryAttempt > 1
                                                        ? ` · pokušaj ${step.retryAttempt}`
                                                        : null}
                                                </Chip>
                                            ) : null}
                                            <DeliveryStopCard
                                                stop={stop}
                                                mode="driver"
                                                routeRevision={
                                                    run.routeRevision
                                                }
                                                pendingAction={
                                                    pendingAction?.startsWith(
                                                        `${stop.id}:`,
                                                    )
                                                        ? pendingAction.endsWith(
                                                              ':retry',
                                                          )
                                                            ? 'retry'
                                                            : pendingAction.endsWith(
                                                                    ':arrive',
                                                                )
                                                              ? 'arrive'
                                                              : pendingAction.endsWith(
                                                                      ':exception',
                                                                  )
                                                                ? 'exception'
                                                                : 'deliver'
                                                        : null
                                                }
                                                onRetry={() =>
                                                    stop.id &&
                                                    onRetry(
                                                        run.id,
                                                        stop.id,
                                                        run.routeRevision,
                                                    )
                                                }
                                                onArrive={() =>
                                                    stop.id &&
                                                    onArrive(
                                                        run.id,
                                                        stop.id,
                                                        run.routeRevision,
                                                    )
                                                }
                                                onDeliver={(notes) =>
                                                    stop.id &&
                                                    onDeliver(
                                                        run.id,
                                                        stop.id,
                                                        run.routeRevision,
                                                        notes,
                                                    )
                                                }
                                                onException={(mutation) =>
                                                    stop.id
                                                        ? onException(
                                                              run.id,
                                                              stop.id,
                                                              mutation,
                                                          )
                                                        : Promise.resolve({
                                                              status: 'review-required',
                                                              message:
                                                                  'Stanica više nije dostupna. Osvježi rutu i provjeri odabir.',
                                                          })
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="space-y-3">
                        {dashboard.batches.length > 0 ? (
                            <>
                                <Card className="shadow-md">
                                    <CardContent
                                        noHeader
                                        className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                                    >
                                        <div>
                                            <Typography level="body1" semiBold>
                                                Plan povezane rute
                                            </Typography>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Chip color="info" size="sm">
                                                    {
                                                        effectiveSelectedRequestIds.length
                                                    }{' '}
                                                    {effectiveSelectedRequestIds.length ===
                                                    1
                                                        ? 'urod'
                                                        : 'uroda'}
                                                </Chip>
                                                <Chip color="neutral" size="sm">
                                                    {
                                                        selectionInspection
                                                            .summary
                                                            .routeNodeCount
                                                    }{' '}
                                                    fizičkih lokacija
                                                </Chip>
                                                <Chip color="neutral" size="sm">
                                                    {selectedSlotCount}{' '}
                                                    {selectedSlotCount === 1
                                                        ? 'termin'
                                                        : 'termina'}
                                                </Chip>
                                                <Chip color="neutral" size="sm">
                                                    {
                                                        selectedPickupLocationCount
                                                    }{' '}
                                                    {selectedPickupLocationCount ===
                                                    1
                                                        ? 'lokacija preuzimanja'
                                                        : 'lokacije preuzimanja'}
                                                </Chip>
                                                {effectiveSelectedRequestIds.length >
                                                0 ? (
                                                    <Chip
                                                        color="neutral"
                                                        size="sm"
                                                    >
                                                        {
                                                            selectedWindowSpanHours
                                                        }{' '}
                                                        h raspon termina
                                                    </Chip>
                                                ) : null}
                                            </div>
                                            <Typography
                                                level="body3"
                                                className="mt-2 text-muted-foreground"
                                            >
                                                Najviše{' '}
                                                {dashboard.maximumRouteStops +
                                                    1}{' '}
                                                fizičkih lokacija po ruti,
                                                uključujući preuzimanja. Svi
                                                urodi za istu adresu u istom
                                                terminu računaju se kao jedna
                                                skupna stanica. Termini moraju
                                                biti unutar najviše{' '}
                                                {
                                                    dashboard.maximumRouteWindowHours
                                                }{' '}
                                                sata i poštuju se pri izračunu
                                                dolazaka. Urodi koji se još
                                                pripremaju ostaju vidljivi, ali
                                                ih nije moguće odabrati.
                                            </Typography>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <HarvestTraceScanner
                                                variant="pickup"
                                                availableTraceCount={
                                                    availableTraceCount
                                                }
                                                disabled={
                                                    Boolean(pendingAction) ||
                                                    selectableOrders.length ===
                                                        0
                                                }
                                                completedTraceCount={
                                                    effectiveSelectedRequestIds.length
                                                }
                                                onScan={scanHarvestTrace}
                                                onReplacePickupSelection={(
                                                    requestIds,
                                                ) => {
                                                    const result =
                                                        applySelectedRequestIds(
                                                            requestIds,
                                                        );
                                                    return (
                                                        result.status ===
                                                            'accepted' &&
                                                        result.requestIds
                                                            .length > 0
                                                    );
                                                }}
                                            />
                                            <Button
                                                variant="outlined"
                                                disabled={
                                                    Boolean(pendingAction) ||
                                                    selectableOrders.length ===
                                                        0
                                                }
                                                onClick={selectAllAvailable}
                                            >
                                                Odaberi sve spremne
                                            </Button>
                                            <Button
                                                variant="plain"
                                                disabled={
                                                    Boolean(pendingAction) ||
                                                    effectiveSelectedRequestIds.length ===
                                                        0
                                                }
                                                onClick={() =>
                                                    applySelectedRequestIds([])
                                                }
                                                startDecorator={
                                                    <Reset className="size-4" />
                                                }
                                            >
                                                Poništi
                                            </Button>
                                            <Button
                                                loading={
                                                    pendingAction ===
                                                    'start-route'
                                                }
                                                disabled={
                                                    Boolean(pendingAction) ||
                                                    effectiveSelectedRequestIds.length ===
                                                        0 ||
                                                    Boolean(
                                                        selectionInspection.conflict,
                                                    )
                                                }
                                                onClick={() =>
                                                    onStartRun(
                                                        effectiveSelectedRequestIds,
                                                    )
                                                }
                                                startDecorator={
                                                    <Play className="size-4" />
                                                }
                                            >
                                                Pokreni rutu s{' '}
                                                {
                                                    effectiveSelectedRequestIds.length
                                                }{' '}
                                                {effectiveSelectedRequestIds.length ===
                                                1
                                                    ? 'urod'
                                                    : 'uroda'}{' '}
                                                i pokreni rutu
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {activeSelectionConflict ? (
                                    <Alert
                                        color="warning"
                                        startDecorator={
                                            <Warning className="size-5" />
                                        }
                                    >
                                        <div className="space-y-3">
                                            <span className="block">
                                                {
                                                    activeSelectionConflict.message
                                                }
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {activeSelectionConflict
                                                    .separateRouteRequestIds
                                                    .length > 0 ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outlined"
                                                        onClick={() =>
                                                            applySelectedRequestIds(
                                                                activeSelectionConflict.separateRouteRequestIds,
                                                            )
                                                        }
                                                    >
                                                        Zadrži kompatibilan
                                                        odabir
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    onClick={() =>
                                                        applySelectedRequestIds(
                                                            [],
                                                        )
                                                    }
                                                >
                                                    Poništi odabir
                                                </Button>
                                            </div>
                                        </div>
                                    </Alert>
                                ) : null}

                                {selectionLimitReached &&
                                selectionInspection.summary.routeNodeCount >=
                                    dashboard.maximumRouteStops + 1 ? (
                                    <Alert
                                        color="info"
                                        startDecorator={
                                            <Warning className="size-5" />
                                        }
                                    >
                                        Dosegnut je najveći broj fizičkih
                                        lokacija za jednu rutu, uključujući
                                        preuzimanja. Urodi na već odabranoj
                                        adresi i u istom terminu i dalje se
                                        dodaju skupno.
                                    </Alert>
                                ) : null}

                                {dashboard.batches.map((batch) => (
                                    <DeliveryBatchCard
                                        key={batch.slotId}
                                        batch={batch}
                                        disabled={Boolean(pendingAction)}
                                        selectionLimitReached={
                                            selectionLimitReached
                                        }
                                        selectedRequestIds={
                                            selectedRequestIdSet
                                        }
                                        selectedStopKeys={selectedStopKeys}
                                        onToggleBatch={(checked) =>
                                            toggleBatch(batch, checked)
                                        }
                                        onToggleOrder={toggleOrder}
                                    />
                                ))}
                            </>
                        ) : (
                            <Card>
                                <CardContent
                                    noHeader
                                    className="flex flex-col items-center gap-3 p-10 text-center"
                                >
                                    <Truck className="size-10 text-muted-foreground" />
                                    <Typography level="h3" semiBold>
                                        Nema spremnih dostava
                                    </Typography>
                                    <Typography className="max-w-md text-muted-foreground">
                                        Novi termini pojavit će se ovdje kada su
                                        dostave potvrđene.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
