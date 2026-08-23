'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    Calendar,
    ExternalLink,
    Leaf,
    MapPin,
    Mobile,
    MyLocation,
    Navigate,
    Reset,
    Timer,
    User,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { deliveryActionPermanentFailureMessage } from '../lib/deliveryActionPresentation';
import type { DeliveryActionQueueEntry } from '../lib/deliveryActionQueue';
import type { DeliveryStopSummary } from '../lib/deliveryDashboardTypes';
import {
    actionableDeliveryExceptionItems,
    type DeliveryExceptionMutation,
    type DeliveryExceptionSubmitResult,
    deliveryExceptionOutcomeLabel,
    deliveryExceptionReasonLabel,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import { DeliveryCustomerReceipt } from './DeliveryCustomerReceipt';
import { DeliveryCustomerRecovery } from './DeliveryCustomerRecovery';
import { DeliveryExceptionSheet } from './DeliveryExceptionSheet';
import { DeliveryHarvestVerification } from './DeliveryHarvestVerification';

function statusColor(
    status: string,
): 'success' | 'info' | 'error' | 'warning' | 'neutral' {
    if (status === 'Dostavljeno') return 'success';
    if (status === 'Vozač je stigao') return 'info';
    if (
        status === 'Otkazano' ||
        status === 'Dostava je otkazana' ||
        status === 'Dostava nije uspjela'
    ) {
        return 'error';
    }
    if (status === 'Dostava je odgođena') return 'warning';
    if (status === 'Vozač stiže' || status === 'U dostavi') {
        return 'warning';
    }
    return 'neutral';
}

export function DeliveryStopCard({
    stop,
    mode,
    pendingAction,
    routeRevision,
    onRetry,
    onArrive,
    onDeliver,
    onException,
    syncEntry,
    verifiedTracePaths = [],
    onVerificationScan,
    onRetrySync,
    onDiscardSync,
    routeSyncBlocked = false,
    showDriverCommand = true,
}: {
    stop: DeliveryStopSummary;
    mode: 'driver' | 'customer';
    pendingAction?: 'retry' | 'arrive' | 'deliver' | 'exception' | null;
    routeRevision?: number;
    onRetry?: () => void;
    onArrive?: () => void;
    onDeliver?: (notes?: string) => void;
    onException?: (
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
    syncEntry?: DeliveryActionQueueEntry | null;
    verifiedTracePaths?: string[];
    onVerificationScan?: (tracePath: string) => unknown | Promise<unknown>;
    onRetrySync?: (operationId: string) => unknown | Promise<unknown>;
    onDiscardSync?: (operationId: string) => unknown | Promise<unknown>;
    routeSyncBlocked?: boolean;
    showDriverCommand?: boolean;
}) {
    const [notes, setNotes] = useState('');
    const [syncRecoveryPending, setSyncRecoveryPending] = useState(false);
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
    const driverMode = mode === 'driver';
    const customerReceipt = driverMode ? null : (stop.receipt ?? null);
    const delivered = stop.statusLabel === 'Dostavljeno';
    const driverActionState =
        stop.actionState ??
        (delivered ? 'completed' : stop.isCurrent ? 'current' : 'upcoming');
    const customerActionAvailable = driverActionState === 'current';
    const acknowledgedOfflineArrival =
        syncEntry?.command.kind === 'arrive' && syncEntry.state === 'synced';
    const pendingOfflineArrival =
        syncEntry?.command.kind === 'arrive' &&
        syncEntry.state !== 'conflicted' &&
        syncEntry.state !== 'synced';
    const pendingOfflineCompletion =
        syncEntry?.command.kind === 'deliver' ||
        syncEntry?.command.kind === 'exception';
    const offlineConflict = syncEntry?.state === 'conflicted';
    const routeCommandBlocking =
        routeSyncBlocked ||
        Boolean(pendingOfflineCompletion) ||
        Boolean(offlineConflict);
    const actionableDeliveries = actionableDeliveryExceptionItems(
        stop.deliveries,
    );
    const currentDeliveryCount =
        stop.stopState === 'deferred'
            ? stop.deliveryCount
            : actionableDeliveries.length;
    const displayedDeliveryCount =
        driverMode && customerActionAvailable && !delivered
            ? currentDeliveryCount
            : stop.deliveryCount;
    const groupedDelivery = stop.deliveries.length > 1;
    const estimatedOutsideWindow = Boolean(
        stop.estimatedArrivalAt &&
            stop.slotEndAt &&
            new Date(stop.estimatedArrivalAt) > new Date(stop.slotEndAt),
    );
    const runSyncRecovery = async (
        action: (() => unknown | Promise<unknown>) | undefined,
    ) => {
        if (!action || syncRecoveryPending) return;
        setSyncRecoveryPending(true);
        try {
            await action();
        } finally {
            setSyncRecoveryPending(false);
        }
    };
    const completedDriverException =
        driverMode &&
        driverActionState === 'completed' &&
        (stop.stopState === 'failed' || stop.stopState === 'cancelled');
    const showRouteEstimates =
        Boolean(stop.estimatedArrivalAt || stop.estimatedTravelSeconds) &&
        !completedDriverException &&
        (!driverMode || showDriverCommand) &&
        (driverMode ||
            !stop.recovery ||
            stop.recovery.kind === 'retry-planned');

    return (
        <Card
            className={
                stop.isCurrent
                    ? 'border-primary shadow-md ring-1 ring-primary/20'
                    : undefined
            }
        >
            <CardContent noHeader className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        {stop.sequence ? (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                {stop.sequence}
                            </div>
                        ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Leaf className="size-4" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <Typography
                                level="body1"
                                semiBold
                                className="truncate"
                            >
                                {driverMode
                                    ? groupedDelivery
                                        ? `${displayedDeliveryCount} ${displayedDeliveryCount === 1 ? 'urod' : 'uroda'} · skupna dostava`
                                        : stop.contactName
                                    : stop.harvest.plantName}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-0.5 text-muted-foreground"
                            >
                                {driverMode
                                    ? groupedDelivery
                                        ? 'Ista adresa i termin'
                                        : stop.harvest.plantName
                                    : formatDeliveryDateTime(stop.slotStartAt)}
                            </Typography>
                        </div>
                    </div>
                    <Chip color={statusColor(stop.statusLabel)} size="sm">
                        {stop.statusLabel}
                    </Chip>
                </div>

                {showRouteEstimates ? (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/70 p-3 text-center">
                        <div>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Dolazak
                            </Typography>
                            <Typography level="body2" semiBold>
                                {formatDeliveryTime(stop.estimatedArrivalAt)}
                            </Typography>
                        </div>
                        <div className="border-x">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Vožnja
                            </Typography>
                            <Typography level="body2" semiBold>
                                {formatTravelDuration(
                                    stop.estimatedTravelSeconds,
                                )}
                            </Typography>
                        </div>
                        <div>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Udaljenost
                            </Typography>
                            <Typography level="body2" semiBold>
                                {formatDistance(stop.estimatedDistanceMeters)}
                            </Typography>
                        </div>
                    </div>
                ) : null}

                {!driverMode && stop.recovery ? (
                    <DeliveryCustomerRecovery
                        recovery={stop.recovery}
                        requestReference={stop.requestId}
                        harvest={stop.harvest}
                    />
                ) : null}

                {driverMode && showDriverCommand ? (
                    <div className="space-y-2 text-sm">
                        {stop.slotStartAt && stop.slotEndAt ? (
                            <div className="flex items-start gap-2">
                                <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <span>
                                    Termin:{' '}
                                    {formatDeliveryDateTime(stop.slotStartAt)} –{' '}
                                    {formatDeliveryTime(stop.slotEndAt)}
                                </span>
                            </div>
                        ) : null}
                        <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span>{stop.address}</span>
                        </div>
                        {showRouteEstimates &&
                        estimatedOutsideWindow &&
                        !delivered ? (
                            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                <Warning className="mt-0.5 size-4 shrink-0" />
                                <span>
                                    Trenutačna procjena dolaska je nakon
                                    završetka termina. Obavijesti korisnika o
                                    kašnjenju.
                                </span>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {driverMode &&
                showDriverCommand &&
                customerActionAvailable &&
                !delivered &&
                stop.stopState === 'deferred' ? (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                        <Typography level="body2" semiBold>
                            Ponovni pokušaj je na redu
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Potvrdi početak pokušaja prije navigacije i
                            evidentiranja dolaska.
                        </Typography>
                        <Button
                            color="warning"
                            loading={pendingAction === 'retry'}
                            disabled={
                                Boolean(pendingAction) ||
                                routeSyncBlocked ||
                                stop.reroutePending
                            }
                            onClick={onRetry}
                            startDecorator={<Reset className="size-4" />}
                        >
                            Pokreni ponovni pokušaj
                        </Button>
                    </div>
                ) : null}

                {driverMode &&
                showDriverCommand &&
                customerActionAvailable &&
                !delivered &&
                stop.stopState !== 'deferred' ? (
                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex flex-wrap gap-2">
                            {routeSyncBlocked || stop.reroutePending ? (
                                <Button
                                    disabled
                                    variant="outlined"
                                    startDecorator={
                                        <Navigate className="size-4" />
                                    }
                                >
                                    Navigacija čeka novi plan
                                </Button>
                            ) : (
                                <Button
                                    href={navigationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="outlined"
                                    startDecorator={
                                        <Navigate className="size-4" />
                                    }
                                >
                                    Navigacija
                                </Button>
                            )}
                            {stop.runId &&
                            routeRevision !== undefined &&
                            onException ? (
                                <DeliveryExceptionSheet
                                    runId={stop.runId}
                                    routeRevision={routeRevision}
                                    stop={stop}
                                    disabled={
                                        Boolean(pendingAction) ||
                                        routeCommandBlocking
                                    }
                                    onSubmit={onException}
                                />
                            ) : null}
                        </div>
                        {stop.stopState === 'arrived' ||
                        pendingOfflineArrival ? (
                            <DeliveryHarvestVerification
                                deliveries={actionableDeliveries}
                                disabled={
                                    Boolean(pendingAction) ||
                                    routeCommandBlocking
                                }
                                verifiedTracePaths={verifiedTracePaths}
                                onVerifiedTrace={onVerificationScan}
                            />
                        ) : (
                            <Typography
                                level="body3"
                                className="rounded-md bg-muted/70 p-3 text-muted-foreground"
                            >
                                Nakon potvrde dolaska možeš opcionalno skenirati
                                QR etikete i provjeriti urode za ovu stanicu.
                            </Typography>
                        )}
                        <label
                            className="block text-sm font-medium"
                            htmlFor={`notes-${stop.id}`}
                        >
                            {groupedDelivery
                                ? 'Napomena za skupnu dostavu'
                                : 'Napomena o dostavi'}
                        </label>
                        <textarea
                            id={`notes-${stop.id}`}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={2}
                            maxLength={1_000}
                            placeholder="Npr. predano članu kućanstva"
                            disabled={routeCommandBlocking}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        />
                        {syncEntry ? (
                            <Alert
                                color={
                                    syncEntry.state === 'conflicted'
                                        ? 'danger'
                                        : syncEntry.state === 'failed'
                                          ? 'warning'
                                          : 'info'
                                }
                                startDecorator={<Warning className="size-5" />}
                            >
                                <div className="space-y-2">
                                    <Typography level="body3" semiBold>
                                        {syncEntry.state === 'conflicted'
                                            ? deliveryActionPermanentFailureMessage(
                                                  syncEntry.errorCode,
                                                  'stop',
                                              )
                                            : syncEntry.state === 'failed'
                                              ? 'Radnja je spremljena na uređaju, ali slanje nije uspjelo.'
                                              : syncEntry.state ===
                                                  'reconciling'
                                                ? 'Problem je potvrđen, ali novi plan rute još nije učitan.'
                                                : syncEntry.state === 'sending'
                                                  ? 'Radnja se šalje i još nije potvrđena.'
                                                  : syncEntry.state === 'synced'
                                                    ? 'Poslužitelj je potvrdio radnju. Čeka se osvježeno stanje rute.'
                                                    : 'Radnja je spremljena na uređaju i čeka potvrdu.'}
                                    </Typography>
                                    {syncEntry.state === 'failed' ? (
                                        <Button
                                            size="sm"
                                            color="warning"
                                            loading={syncRecoveryPending}
                                            disabled={syncRecoveryPending}
                                            onClick={() =>
                                                void runSyncRecovery(() =>
                                                    onRetrySync?.(
                                                        syncEntry.command
                                                            .operationId,
                                                    ),
                                                )
                                            }
                                        >
                                            Pokušaj ponovno
                                        </Button>
                                    ) : null}
                                    {syncEntry.state === 'conflicted' ? (
                                        <Button
                                            size="sm"
                                            color="danger"
                                            variant="outlined"
                                            loading={syncRecoveryPending}
                                            disabled={syncRecoveryPending}
                                            onClick={() =>
                                                void runSyncRecovery(() =>
                                                    onDiscardSync?.(
                                                        syncEntry.command
                                                            .operationId,
                                                    ),
                                                )
                                            }
                                        >
                                            Učitaj stanje poslužitelja
                                        </Button>
                                    ) : null}
                                </div>
                            </Alert>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                                variant="outlined"
                                loading={pendingAction === 'arrive'}
                                disabled={
                                    Boolean(pendingAction) ||
                                    stop.stopState === 'arrived' ||
                                    acknowledgedOfflineArrival ||
                                    pendingOfflineArrival ||
                                    routeCommandBlocking
                                }
                                onClick={onArrive}
                                startDecorator={
                                    <MyLocation className="size-4" />
                                }
                            >
                                {pendingOfflineArrival
                                    ? 'Dolazak čeka potvrdu'
                                    : stop.stopState === 'arrived' ||
                                        acknowledgedOfflineArrival
                                      ? 'Dolazak potvrđen'
                                      : 'Stigao sam'}
                            </Button>
                            <Button
                                color="success"
                                loading={pendingAction === 'deliver'}
                                disabled={
                                    Boolean(pendingAction) ||
                                    routeCommandBlocking ||
                                    actionableDeliveries.length === 0 ||
                                    !(
                                        stop.stopState === 'arrived' ||
                                        pendingOfflineArrival ||
                                        acknowledgedOfflineArrival
                                    )
                                }
                                onClick={() => onDeliver?.(notes || undefined)}
                                startDecorator={<Approved className="size-4" />}
                            >
                                {syncEntry?.command.kind === 'deliver'
                                    ? syncEntry.state === 'synced'
                                        ? 'Dostava potvrđena'
                                        : 'Dostava čeka potvrdu'
                                    : groupedDelivery
                                      ? `Dostavi ${actionableDeliveries.length} ${actionableDeliveries.length === 1 ? 'urod' : 'uroda'} · dalje`
                                      : 'Dostavljeno · dalje'}
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="space-y-2 text-sm">
                    {driverMode ? (
                        <div className="space-y-2">
                            {stop.deliveries.map((delivery) => (
                                <div
                                    key={delivery.requestId}
                                    className="space-y-2 rounded-md border p-3"
                                >
                                    <Typography
                                        level="body3"
                                        semiBold
                                        className="flex items-center gap-2"
                                    >
                                        <User className="size-4" />
                                        {delivery.contactName}
                                    </Typography>
                                    {delivery.phone && showDriverCommand ? (
                                        <a
                                            href={`tel:${delivery.phone}`}
                                            className="flex items-center gap-2 text-primary hover:underline"
                                        >
                                            <Mobile className="size-4" />
                                            {delivery.phone}
                                        </a>
                                    ) : delivery.phone ? (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Mobile className="size-4" />
                                            <span>{delivery.phone}</span>
                                        </div>
                                    ) : null}
                                    <div className="flex items-start gap-2">
                                        <Leaf className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        <span>
                                            {[
                                                delivery.harvest.plantName,
                                                delivery.harvest.raisedBedName,
                                                delivery.harvest.fieldName,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </div>
                                    {delivery.exception ? (
                                        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Chip
                                                    color={
                                                        delivery.exception
                                                            .outcome ===
                                                        'deferred'
                                                            ? 'warning'
                                                            : 'error'
                                                    }
                                                    size="sm"
                                                >
                                                    {deliveryExceptionOutcomeLabel(
                                                        delivery.exception
                                                            .outcome,
                                                    )}
                                                </Chip>
                                                <span className="font-medium">
                                                    {deliveryExceptionReasonLabel(
                                                        delivery.exception
                                                            .reason,
                                                    )}
                                                </span>
                                            </div>
                                            {delivery.exception.note ? (
                                                <Typography level="body3">
                                                    Interna napomena:{' '}
                                                    {delivery.exception.note}
                                                </Typography>
                                            ) : null}
                                            <Typography
                                                level="body3"
                                                className="text-current/70"
                                            >
                                                Zabilježeno{' '}
                                                {formatDeliveryDateTime(
                                                    delivery.exception
                                                        .occurredAt,
                                                )}
                                            </Typography>
                                        </div>
                                    ) : null}
                                    {delivery.requestNotes ? (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                            <strong>Napomena:</strong>{' '}
                                            {delivery.requestNotes}
                                        </div>
                                    ) : null}
                                    {delivery.harvest.tracePath ? (
                                        <Button
                                            href={`https://www.gredice.com${delivery.harvest.tracePath}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="plain"
                                            startDecorator={
                                                <ExternalLink className="size-4" />
                                            }
                                        >
                                            Trag uroda
                                        </Button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : customerReceipt ? (
                        stop.requestNotes ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                <strong>Napomena:</strong> {stop.requestNotes}
                            </div>
                        ) : null
                    ) : (
                        <>
                            <div className="flex items-start gap-2">
                                <Leaf className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <span>
                                    {[
                                        stop.harvest.plantName,
                                        stop.harvest.raisedBedName,
                                        stop.harvest.fieldName,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            </div>
                            {stop.requestNotes ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                    <strong>Napomena:</strong>{' '}
                                    {stop.requestNotes}
                                </div>
                            ) : null}
                        </>
                    )}
                    {!driverMode &&
                    showRouteEstimates &&
                    estimatedOutsideWindow &&
                    !delivered ? (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            <Warning className="mt-0.5 size-4 shrink-0" />
                            <span>
                                Trenutačna procjena dolaska je nakon završetka
                                termina. Prikaz će se ažurirati kada vozač
                                nastavi rutu.
                            </span>
                        </div>
                    ) : null}
                </div>

                {!driverMode && !customerReceipt && stop.harvest.tracePath ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            href={`https://www.gredice.com${stop.harvest.tracePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="plain"
                            startDecorator={<ExternalLink className="size-4" />}
                        >
                            Trag uroda
                        </Button>
                    </div>
                ) : null}

                {customerReceipt ? (
                    <DeliveryCustomerReceipt receipt={customerReceipt} />
                ) : null}

                {driverMode &&
                (driverActionState === 'locked' ||
                    driverActionState === 'upcoming') &&
                !delivered ? (
                    <Alert
                        color={
                            driverActionState === 'locked' ? 'warning' : 'info'
                        }
                        startDecorator={<Warning className="size-5" />}
                    >
                        {stop.lockedReason ??
                            (driverActionState === 'locked'
                                ? 'Dostava će se otključati nakon potvrde svih uroda za ovu stanicu.'
                                : 'Ova je stanica spremna i otključat će se kada dođe na red rute.')}
                    </Alert>
                ) : null}

                {stop.deliveredAt && !customerReceipt ? (
                    <Typography
                        level="body3"
                        className="flex items-center gap-2 text-muted-foreground"
                    >
                        <Timer className="size-4" /> Dostavljeno{' '}
                        {formatDeliveryDateTime(stop.deliveredAt)}
                    </Typography>
                ) : null}
            </CardContent>
        </Card>
    );
}
