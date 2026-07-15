'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    MapPin,
    Mobile,
    MyLocation,
    Navigate,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import {
    deliveryActionAcknowledgementBlocksRoute,
    deliveryActionCompletionMessage,
    deliveryActionLocallyCompletesStop,
} from '../lib/deliveryActionPresentation';
import {
    type DeliveryActionQueueSnapshot,
    deliveryActionPendingEntryForStop,
    deliveryActionVerifiedTracePaths,
} from '../lib/deliveryActionQueue';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import type {
    DeliveryExceptionMutation,
    DeliveryExceptionSubmitResult,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import type {
    OfflineRouteDeliveryStep,
    OfflineRouteSnapshot,
    OfflineRouteStep,
} from '../lib/offlineRouteCache';
import { DeliveryExceptionSheet } from './DeliveryExceptionSheet';
import { DeliveryHarvestVerification } from './DeliveryHarvestVerification';
import { DeliveryActionSyncStatus } from './DriverDashboard';

function stepTitle(step: OfflineRouteStep) {
    return step.kind === 'pickup' ? step.name : step.statusLabel;
}

function stepItems(step: OfflineRouteStep) {
    return step.kind === 'pickup'
        ? step.items.map((item) => ({
              id: item.requestId,
              label: [
                  item.harvest.plantName,
                  item.harvest.raisedBedName,
                  item.harvest.fieldName,
              ]
                  .filter(Boolean)
                  .join(' · '),
              detail:
                  item.state === 'not-ready'
                      ? 'Nije spremno'
                      : item.state === 'scanned'
                        ? 'Skenirano'
                        : item.state === 'missing-label'
                          ? 'Bez etikete'
                          : 'Spremno',
              note: null,
          }))
        : step.items.map((item) => ({
              id: item.requestId,
              label: [
                  item.harvest.plantName,
                  item.harvest.raisedBedName,
                  item.harvest.fieldName,
              ]
                  .filter(Boolean)
                  .join(' · '),
              detail: item.contactName,
              note: item.requestNotes,
          }));
}

function hasDeliveryStopId(
    step: OfflineRouteStep,
): step is OfflineRouteDeliveryStep & { id: number } {
    return step.kind === 'delivery' && step.id !== null;
}

function OfflineDeliveryContacts({ step }: { step: OfflineRouteDeliveryStep }) {
    const phoneNumbers = Array.from(
        new Set(step.items.flatMap((item) => (item.phone ? [item.phone] : []))),
    );
    if (phoneNumbers.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {phoneNumbers.map((phone) => (
                <Button
                    key={phone}
                    href={`tel:${phone}`}
                    size="sm"
                    variant="plain"
                    startDecorator={<Mobile className="size-4" />}
                >
                    {phone}
                </Button>
            ))}
        </div>
    );
}

function offlineDeliveryItems(
    step: OfflineRouteDeliveryStep,
): DeliveryStopDeliverySummary[] {
    return step.items.map((item) => ({
        stopId: item.stopId,
        stopState: item.stopState,
        requestId: item.requestId,
        requestState: item.requestState,
        contactName: item.contactName,
        phone: item.phone,
        addressLabel: null,
        requestNotes: item.requestNotes,
        deliveryNotes: null,
        harvest: {
            ...item.harvest,
            operationName: null,
        },
        exception: null,
    }));
}

export function OfflineRoutePanel({
    snapshot,
    actionQueue,
    onArrive,
    onDeliver,
    onException,
    onVerificationScan,
    onRetry,
    onRecoverConflict,
    onReconcile,
}: {
    snapshot: OfflineRouteSnapshot;
    actionQueue: DeliveryActionQueueSnapshot;
    onArrive: (stopId: number, routeRevision: number) => void | Promise<void>;
    onDeliver: (
        stopId: number,
        routeRevision: number,
        notes?: string,
    ) => void | Promise<void>;
    onException: (
        stopId: number,
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
    onVerificationScan: (stopId: number, tracePath: string) => void;
    onRetry: (operationId: string) => void | Promise<void>;
    onRecoverConflict: (operationId: string) => void | Promise<void>;
    onReconcile: () => void | Promise<void>;
}) {
    const [notesByStop, setNotesByStop] = useState<Record<number, string>>({});
    const firstStep = snapshot.steps[0];
    const firstStopId = firstStep?.kind === 'delivery' ? firstStep.id : null;
    const firstEntry = firstStopId
        ? deliveryActionPendingEntryForStop(actionQueue, firstStopId)
        : undefined;
    const activeStepIndex =
        deliveryActionLocallyCompletesStop(firstEntry) &&
        snapshot.steps.length > 1
            ? 1
            : 0;
    const currentStep = snapshot.steps[activeStepIndex];
    const currentStopId =
        currentStep?.kind === 'delivery' ? currentStep.id : null;
    const currentEntry = currentStopId
        ? deliveryActionPendingEntryForStop(actionQueue, currentStopId)
        : undefined;
    const acknowledgedArrival =
        currentEntry?.command.kind === 'arrive' &&
        currentEntry.state === 'synced';
    const pendingArrival =
        currentEntry?.command.kind === 'arrive' &&
        currentEntry.state !== 'conflicted' &&
        currentEntry.state !== 'synced';
    const deliveryQueued = deliveryActionLocallyCompletesStop(currentEntry);
    const deliveryAcknowledged =
        deliveryQueued && currentEntry?.state === 'synced';
    const routeBarrier =
        snapshot.source.reroutePending ||
        actionQueue.entries.some(
            (entry) =>
                (entry.command.kind === 'exception' &&
                    entry.state !== 'synced') ||
                entry.state === 'failed' ||
                deliveryActionAcknowledgementBlocksRoute(entry),
        ) ||
        actionQueue.conflictedCount > 0;
    const currentActionBlocked =
        routeBarrier ||
        Boolean(
            currentEntry &&
                (currentEntry.command.kind !== 'arrive' ||
                    currentEntry.state === 'conflicted'),
        );
    const currentDeliveryReady = Boolean(
        currentStep?.kind === 'delivery' &&
            (currentStep.stopState === 'arrived' ||
                pendingArrival ||
                acknowledgedArrival),
    );
    return (
        <main className="min-h-[100dvh] bg-muted/30 p-4">
            <div className="mx-auto max-w-3xl space-y-4">
                <Alert
                    color="warning"
                    startDecorator={<Warning className="size-5" />}
                >
                    Prikazana je zaštićena izvanmrežna kopija trenutačnog i
                    sljedećeg koraka. Radnje na čekanju nisu potvrđene na
                    poslužitelju. Kopija je osvježena{' '}
                    {formatDeliveryDateTime(snapshot.source.refreshedAt)}.
                </Alert>
                <DeliveryActionSyncStatus
                    snapshot={actionQueue}
                    onRetry={onRetry}
                    onRecoverConflict={onRecoverConflict}
                    onReconcile={onReconcile}
                />
                {routeBarrier ? (
                    <Alert color="warning">
                        Ruta čeka novi plan. Nemoj nastaviti na sljedeću stanicu
                        dok se veza ne vrati i plan ne osvježi.
                    </Alert>
                ) : null}
                {snapshot.steps.map((step, index) => {
                    const actionState =
                        index < activeStepIndex
                            ? 'completed'
                            : index === activeStepIndex
                              ? 'current'
                              : step.actionState;
                    return (
                        <Card
                            key={`${step.kind}:${step.id}`}
                            className={
                                index === activeStepIndex
                                    ? 'border-primary'
                                    : undefined
                            }
                        >
                            <CardContent noHeader className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {index < activeStepIndex
                                                ? firstEntry?.state === 'synced'
                                                    ? 'Dovršeni korak čeka osvježenu rutu'
                                                    : 'Dovršeni korak čeka potvrdu'
                                                : index === activeStepIndex
                                                  ? 'Trenutačni korak'
                                                  : 'Sljedeći korak'}
                                        </Typography>
                                        <Typography level="h3" semiBold>
                                            {stepTitle(step)}
                                        </Typography>
                                    </div>
                                    <Chip
                                        color={
                                            index === activeStepIndex
                                                ? 'info'
                                                : 'neutral'
                                        }
                                        size="sm"
                                    >
                                        #{step.itinerarySequence}
                                    </Chip>
                                </div>
                                {index < activeStepIndex ? (
                                    <Alert color="info">
                                        {deliveryActionCompletionMessage(
                                            firstEntry,
                                            !routeBarrier,
                                        )}
                                    </Alert>
                                ) : null}
                                <Typography className="flex items-start gap-2">
                                    <MapPin className="mt-0.5 size-4 shrink-0" />
                                    {step.address}
                                </Typography>
                                <div className="flex flex-wrap gap-2">
                                    {step.kind === 'delivery' &&
                                    step.slotStartAt ? (
                                        <Chip size="sm">
                                            Termin{' '}
                                            {formatDeliveryTime(
                                                step.slotStartAt,
                                            )}
                                            {step.slotEndAt
                                                ? `–${formatDeliveryTime(step.slotEndAt)}`
                                                : ''}
                                        </Chip>
                                    ) : null}
                                    {step.estimatedArrivalAt ? (
                                        <Chip size="sm">
                                            Dolazak{' '}
                                            {formatDeliveryDateTime(
                                                step.estimatedArrivalAt,
                                            )}
                                        </Chip>
                                    ) : null}
                                    {step.estimatedTravelSeconds !== null ? (
                                        <Chip size="sm">
                                            {formatTravelDuration(
                                                step.estimatedTravelSeconds,
                                            )}
                                        </Chip>
                                    ) : null}
                                    {step.estimatedDistanceMeters !== null ? (
                                        <Chip size="sm">
                                            {formatDistance(
                                                step.estimatedDistanceMeters,
                                            )}
                                        </Chip>
                                    ) : null}
                                </div>
                                {routeBarrier ||
                                actionState === 'locked' ||
                                index < activeStepIndex ||
                                (index > activeStepIndex && !deliveryQueued) ? (
                                    <Button
                                        disabled
                                        variant="outlined"
                                        aria-label={
                                            index < activeStepIndex
                                                ? 'Navigacija do prethodne stanice nije potrebna'
                                                : index === activeStepIndex
                                                  ? 'Navigacija do trenutačne stanice čeka novi plan'
                                                  : routeBarrier
                                                    ? 'Navigacija do sljedeće stanice čeka novi plan'
                                                    : 'Navigacija do sljedeće stanice čeka završetak trenutačne dostave'
                                        }
                                        startDecorator={
                                            <Navigate className="size-4" />
                                        }
                                    >
                                        {index < activeStepIndex
                                            ? 'Prethodna dostava je spremljena'
                                            : index === activeStepIndex
                                              ? 'Navigacija čeka novi plan'
                                              : routeBarrier
                                                ? 'Navigacija čeka novi plan'
                                                : 'Navigacija čeka završetak dostave'}
                                    </Button>
                                ) : (
                                    <Button
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(step.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="outlined"
                                        aria-label={
                                            index === activeStepIndex
                                                ? 'Navigacija do trenutačne stanice'
                                                : 'Navigacija do sljedeće stanice'
                                        }
                                        startDecorator={
                                            <Navigate className="size-4" />
                                        }
                                    >
                                        Navigacija
                                    </Button>
                                )}
                                {step.kind === 'delivery' ? (
                                    <OfflineDeliveryContacts step={step} />
                                ) : null}
                                {hasDeliveryStopId(step) &&
                                index === activeStepIndex ? (
                                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                        <label
                                            className="block text-sm font-medium"
                                            htmlFor={`offline-notes-${step.id}`}
                                        >
                                            Napomena o dostavi
                                        </label>
                                        <textarea
                                            id={`offline-notes-${step.id}`}
                                            value={notesByStop[step.id] ?? ''}
                                            onChange={(event) =>
                                                setNotesByStop((current) => ({
                                                    ...current,
                                                    [step.id]:
                                                        event.target.value,
                                                }))
                                            }
                                            disabled={currentActionBlocked}
                                            rows={2}
                                            maxLength={1_000}
                                            className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                                        />
                                        <DeliveryExceptionSheet
                                            runId={snapshot.scope.runId}
                                            routeRevision={
                                                snapshot.source.routeRevision
                                            }
                                            stop={{
                                                id: step.id,
                                                requestId:
                                                    step.items[0]?.requestId ??
                                                    `stop-${step.id}`,
                                                deliveries:
                                                    offlineDeliveryItems(step),
                                            }}
                                            disabled={currentActionBlocked}
                                            onSubmit={(mutation) =>
                                                onException(step.id, mutation)
                                            }
                                        />
                                        {currentDeliveryReady ? (
                                            <DeliveryHarvestVerification
                                                deliveries={offlineDeliveryItems(
                                                    step,
                                                )}
                                                disabled={
                                                    routeBarrier ||
                                                    deliveryQueued
                                                }
                                                verifiedTracePaths={deliveryActionVerifiedTracePaths(
                                                    actionQueue,
                                                    step.id,
                                                )}
                                                onVerifiedTrace={(tracePath) =>
                                                    onVerificationScan(
                                                        step.id,
                                                        tracePath,
                                                    )
                                                }
                                            />
                                        ) : null}
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <Button
                                                variant="outlined"
                                                disabled={
                                                    step.stopState ===
                                                        'arrived' ||
                                                    acknowledgedArrival ||
                                                    pendingArrival ||
                                                    currentActionBlocked
                                                }
                                                onClick={() =>
                                                    onArrive(
                                                        step.id,
                                                        snapshot.source
                                                            .routeRevision,
                                                    )
                                                }
                                                startDecorator={
                                                    <MyLocation className="size-4" />
                                                }
                                            >
                                                {pendingArrival
                                                    ? 'Dolazak čeka potvrdu'
                                                    : step.stopState ===
                                                            'arrived' ||
                                                        acknowledgedArrival
                                                      ? 'Dolazak potvrđen'
                                                      : 'Stigao sam'}
                                            </Button>
                                            <Button
                                                color="success"
                                                disabled={
                                                    currentActionBlocked ||
                                                    deliveryQueued ||
                                                    !(
                                                        step.stopState ===
                                                            'arrived' ||
                                                        pendingArrival ||
                                                        acknowledgedArrival
                                                    )
                                                }
                                                onClick={() =>
                                                    onDeliver(
                                                        step.id,
                                                        snapshot.source
                                                            .routeRevision,
                                                        notesByStop[step.id] ||
                                                            undefined,
                                                    )
                                                }
                                                startDecorator={
                                                    <Approved className="size-4" />
                                                }
                                            >
                                                {deliveryAcknowledged
                                                    ? 'Dostava potvrđena'
                                                    : deliveryQueued
                                                      ? 'Dostava čeka potvrdu'
                                                      : 'Dostavljeno · dalje'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                {step.kind === 'delivery' &&
                                actionState === 'locked' &&
                                step.lockedReason ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {step.lockedReason}
                                    </Typography>
                                ) : null}
                                <ul className="space-y-2">
                                    {stepItems(step).map((item) => (
                                        <li
                                            key={item.id}
                                            className="rounded-md bg-muted px-3 py-2"
                                        >
                                            <Typography level="body3" semiBold>
                                                {item.label}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                {item.detail}
                                            </Typography>
                                            {item.note ? (
                                                <Typography
                                                    level="body3"
                                                    className="mt-1 text-amber-800 dark:text-amber-200"
                                                >
                                                    Napomena: {item.note}
                                                </Typography>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    );
                })}
                <Typography level="body3" className="text-muted-foreground">
                    Kopija vrijedi najviše 24 sata i briše se završetkom rute,
                    promjenom korisnika ili odjavom.
                </Typography>
            </div>
        </main>
    );
}
