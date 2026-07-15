'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Map as MapIcon,
    MapPin,
    MyLocation,
    Play,
    Reset,
    Timer,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import type { DriverDeliveryDashboard } from '../lib/deliveryDashboardTypes';
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
import { selectDeliveryStopFromHarvestTrace } from '../lib/harvestTraceScan';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DeliveryBatchCard } from './DeliveryBatchCard';
import { DeliveryMap } from './DeliveryMap';
import { DeliveryStopCard } from './DeliveryStopCard';
import { HarvestTraceScanner } from './HarvestTraceScanner';

function trackingMessage(state: DriverTrackingState) {
    switch (state) {
        case 'active':
            return 'GPS praćenje je aktivno. Korisnici vide tvoju zadnju lokaciju dok je ruta otvorena.';
        case 'requesting':
            return 'Čeka se dopuštenje za GPS lokaciju…';
        case 'denied':
            return 'Dopusti pristup lokaciji u pregledniku kako bi korisnici mogli pratiti dostavu.';
        case 'unavailable':
            return 'Ovaj uređaj ne podržava GPS praćenje u pregledniku.';
        case 'error':
            return 'Lokaciju trenutačno nije moguće poslati. Provjeri vezu i GPS postavke.';
        default:
            return null;
    }
}

export function DriverDashboard({
    dashboard,
    trackingState,
    pendingAction,
    onSelectionChange,
    onStartRun,
    onArrive,
    onDeliver,
}: {
    dashboard: DriverDeliveryDashboard;
    trackingState: DriverTrackingState;
    pendingAction: string | null;
    onSelectionChange: () => void;
    onStartRun: (deliveryRequestIds: string[]) => void;
    onArrive: (runId: string, stopId: number) => void;
    onDeliver: (runId: string, stopId: number, notes?: string) => void;
}) {
    const run = dashboard.activeRun;
    const locationMessage = trackingMessage(trackingState);
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
        selectionInspection.summary.stopCount >= dashboard.maximumRouteStops;
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
    const separateRouteLocation =
        activeSelectionConflict?.pickupLocations.find((location) =>
            location.requestIds.some((requestId) =>
                activeSelectionConflict.separateRouteRequestIds.includes(
                    requestId,
                ),
            ),
        ) ?? null;
    const separateRouteLocationLabel =
        separateRouteLocation?.name ??
        separateRouteLocation?.address ??
        'odabranu lokaciju';
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
            const currentStopKeys = new Set(
                availableCurrent.flatMap((id) => {
                    const currentOrder = ordersByRequestId.get(id);
                    return currentOrder ? [currentOrder.stopKey] : [];
                }),
            );
            if (
                !currentStopKeys.has(order.stopKey) &&
                currentStopKeys.size >= dashboard.maximumRouteStops
            ) {
                return availableCurrent;
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

            const next = new Set(availableCurrent);
            const nextStopKeys = new Set(
                availableCurrent.flatMap((id) => {
                    const order = ordersByRequestId.get(id);
                    return order ? [order.stopKey] : [];
                }),
            );
            for (const group of groupByDeliveryStop(readyBatchOrders)) {
                if (!nextStopKeys.has(group.stopKey)) {
                    if (nextStopKeys.size >= dashboard.maximumRouteStops) {
                        continue;
                    }
                    nextStopKeys.add(group.stopKey);
                }
                for (const order of group.items) {
                    next.add(order.requestId);
                }
            }
            return Array.from(next);
        });
    };

    const selectAllAvailable = () => {
        applySelectedRequestIds(
            availableStopGroups
                .slice(0, dashboard.maximumRouteStops)
                .flatMap((group) =>
                    group.items.map((order) => order.requestId),
                ),
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
                        {locationMessage ? (
                            <Alert
                                color={
                                    trackingState === 'active'
                                        ? 'success'
                                        : trackingState === 'requesting'
                                          ? 'info'
                                          : 'warning'
                                }
                                startDecorator={
                                    trackingState === 'active' ? (
                                        <MyLocation className="size-5" />
                                    ) : (
                                        <Warning className="size-5" />
                                    )
                                }
                            >
                                {locationMessage}
                            </Alert>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
                            <DeliveryMap
                                mapUrl={run.mapUrl}
                                version={
                                    run.location?.recordedAt ??
                                    run.estimatesUpdatedAt
                                }
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
                                    Stanice rute
                                </Typography>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {run.stops.map((stop) => (
                                    <DeliveryStopCard
                                        key={stop.id ?? stop.requestId}
                                        stop={stop}
                                        mode="driver"
                                        pendingAction={
                                            pendingAction?.startsWith(
                                                `${stop.id}:`,
                                            )
                                                ? pendingAction.endsWith(
                                                      ':arrive',
                                                  )
                                                    ? 'arrive'
                                                    : 'deliver'
                                                : null
                                        }
                                        onArrive={() =>
                                            stop.id && onArrive(run.id, stop.id)
                                        }
                                        onDeliver={(notes) =>
                                            stop.id &&
                                            onDeliver(run.id, stop.id, notes)
                                        }
                                    />
                                ))}
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
                                                    {selectedStopKeys.size}{' '}
                                                    {selectedStopKeys.size === 1
                                                        ? 'stanica'
                                                        : selectedStopKeys.size <
                                                            5
                                                          ? 'stanice'
                                                          : 'stanica'}
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
                                                {dashboard.maximumRouteStops}{' '}
                                                fizičkih stanica po ruti. Svi
                                                urodi za istu adresu u istom
                                                terminu računaju se kao jedna
                                                skupna stanica. Termini moraju
                                                biti unutar najviše{' '}
                                                {
                                                    dashboard.maximumRouteWindowHours
                                                }{' '}
                                                sata i poštuju se pri izračunu
                                                dolazaka. Dok povezane lokacije
                                                preuzimanja nisu dio plana,
                                                jedna ruta kreće s jedne
                                                lokacije. Urodi koji se još
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
                                                Preuzmi{' '}
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
                                                        {activeSelectionConflict.code ===
                                                        'mixed-pickup-locations'
                                                            ? `Zadrži samo ${separateRouteLocationLabel}`
                                                            : 'Zadrži kompatibilan odabir'}
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
                                availableStopGroups.length >
                                    dashboard.maximumRouteStops ? (
                                    <Alert
                                        color="info"
                                        startDecorator={
                                            <Warning className="size-5" />
                                        }
                                    >
                                        Dosegnut je najveći broj fizičkih
                                        stanica za jednu rutu. Urodi na već
                                        odabranoj adresi i u istom terminu i
                                        dalje se dodaju skupno.
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
