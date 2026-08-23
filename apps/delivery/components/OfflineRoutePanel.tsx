'use client';

import type { DeliveryRunCompletionOverrideReason } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Navigate, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { croatianCountLabel } from '../lib/croatianCount';
import {
    deliveryActionAcknowledgementBlocksRoute,
    deliveryActionCompletionMessage,
    deliveryActionLocallyCompletesStop,
} from '../lib/deliveryActionPresentation';
import {
    type DeliveryActionQueueSnapshot,
    deliveryActionPendingEntryForStop,
    deliveryActionVerifiedTracePaths,
    isDeliveryHandoffCommand,
} from '../lib/deliveryActionQueue';
import type {
    DeliveryPickupStepSummary,
    DeliveryStopDeliverySummary,
    DeliveryStopSummary,
} from '../lib/deliveryDashboardTypes';
import type {
    DeliveryExceptionMutation,
    DeliveryExceptionSubmitResult,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
} from '../lib/deliveryFormatting';
import type {
    DriverRouteTimelineItem,
    DriverRouteTimelineState,
} from '../lib/deliveryRouteTimelinePresentation';
import type {
    OfflineRouteDeliveryStep,
    OfflineRoutePickupStep,
    OfflineRouteSnapshot,
    OfflineRouteStep,
} from '../lib/offlineRouteCache';
import {
    type DeliveryHandoffCommandController,
    DriverCurrentStopCommandCenter,
} from './DriverCurrentStopCommandCenter';
import { DeliveryActionSyncStatus } from './DriverDashboard';
import { DriverRouteProgressTimeline } from './DriverRouteProgressTimeline';

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
              detail: [item.contactName, item.phone]
                  .filter(Boolean)
                  .join(' · '),
              note: item.requestNotes,
          }));
}

function offlineStepIdentity(step: OfflineRouteStep) {
    return `${step.kind}:${step.id ?? step.itinerarySequence}`;
}

function offlineTimelineState(
    step: OfflineRouteStep,
    index: number,
    activeStepIndex: number,
): DriverRouteTimelineState {
    if (
        step.kind === 'delivery' &&
        (step.stopState === 'failed' ||
            step.stopState === 'cancelled' ||
            step.items.some(
                (item) =>
                    item.exception?.outcome === 'failed' ||
                    item.exception?.outcome === 'cancelled',
            ))
    ) {
        return 'exception';
    }
    if (
        step.kind === 'delivery' &&
        (step.stopState === 'deferred' || step.retryLaneRank !== null)
    ) {
        return 'retry';
    }
    if (index < activeStepIndex) return 'syncing';
    if (index === activeStepIndex) return 'current';
    if (index === activeStepIndex + 1) return 'next';
    if (step.actionState === 'locked') return 'locked';
    return 'upcoming';
}

function offlineTimelineItems(
    steps: readonly OfflineRouteStep[],
    activeStepIndex: number,
): DriverRouteTimelineItem[] {
    return steps.map((step, index) => ({
        id: offlineStepIdentity(step),
        sequence: step.itinerarySequence,
        kind: step.kind,
        state: offlineTimelineState(step, index, activeStepIndex),
        title:
            step.kind === 'pickup'
                ? step.name
                : step.items.length === 1
                  ? (step.items[0]?.contactName ?? step.statusLabel)
                  : croatianCountLabel(
                        step.recipientCount ?? step.items.length,
                        'primatelj',
                        'primatelja',
                        'primatelja',
                    ),
        destination: step.address,
        deliveryCount:
            step.kind === 'pickup' ? step.expectedCount : step.items.length,
        estimatedArrivalAt: step.estimatedArrivalAt,
        estimatedTravelSeconds: step.estimatedTravelSeconds,
    }));
}

function hasDeliveryStopId(
    step: OfflineRouteStep,
): step is OfflineRouteDeliveryStep & { id: number } {
    return step.kind === 'delivery' && step.id !== null;
}

export function offlineDeliveryItems(
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

export function offlineRouteActiveStepIndex(
    snapshot: OfflineRouteSnapshot,
    actionQueue: DeliveryActionQueueSnapshot,
) {
    const firstStep = snapshot.steps[0];
    const firstStopId = firstStep?.kind === 'delivery' ? firstStep.id : null;
    const firstEntry = firstStopId
        ? deliveryActionPendingEntryForStop(actionQueue, firstStopId)
        : undefined;
    return deliveryActionLocallyCompletesStop(firstEntry) &&
        snapshot.steps.length > 1
        ? 1
        : 0;
}

export function offlineDeliveryHandoffSelection(
    snapshot: OfflineRouteSnapshot,
    actionQueue: DeliveryActionQueueSnapshot,
) {
    const step =
        snapshot.steps[offlineRouteActiveStepIndex(snapshot, actionQueue)];
    if (!step || !hasDeliveryStopId(step)) return null;
    return {
        target: {
            targetStopId: step.id,
            retryAttempt: step.retryAttempt,
        },
        deliveries: offlineDeliveryItems(step),
    };
}

function offlineDeliveryStop(
    step: OfflineRouteDeliveryStep & { id: number },
    runId: string,
): DeliveryStopSummary & { id: number } {
    const firstItem = step.items[0];
    return {
        id: step.id,
        requestId: firstItem?.requestId ?? `stop-${step.id}`,
        sequence: step.itinerarySequence,
        stopState: step.stopState,
        requestState: firstItem?.requestState ?? 'in_delivery',
        statusLabel: step.statusLabel,
        isCurrent: true,
        contactName: firstItem?.contactName ?? 'Skupna dostava',
        phone: firstItem?.phone ?? null,
        address: step.address,
        addressLabel: null,
        requestNotes: firstItem?.requestNotes ?? null,
        deliveryNotes: null,
        slotStartAt: step.slotStartAt,
        slotEndAt: step.slotEndAt,
        estimatedArrivalAt: step.estimatedArrivalAt,
        estimatedTravelSeconds: step.estimatedTravelSeconds,
        estimatedDistanceMeters: step.estimatedDistanceMeters,
        reroutePending: false,
        arrivedAt: step.arrivedAt,
        deliveredAt: step.deliveredAt,
        harvest: {
            plantName: firstItem?.harvest.plantName ?? 'Urod za dostavu',
            operationName: null,
            raisedBedName: firstItem?.harvest.raisedBedName ?? null,
            fieldName: firstItem?.harvest.fieldName ?? null,
            tracePath: firstItem?.harvest.tracePath ?? null,
        },
        recovery: null,
        tracking: null,
        runId,
        deliveryCount: step.items.length,
        ...(step.recipientCount !== undefined
            ? { recipientCount: step.recipientCount }
            : {}),
        deliveries: offlineDeliveryItems(step),
        actionState: 'current',
        lockedReason: step.lockedReason,
    };
}

function offlinePickup(
    step: OfflineRoutePickupStep,
): DeliveryPickupStepSummary {
    return {
        id: step.id,
        pickupLocationId: null,
        sequence: step.itinerarySequence,
        itinerarySequence: step.itinerarySequence,
        name: step.name,
        address: step.address,
        estimatedArrivalAt: step.estimatedArrivalAt,
        estimatedTravelSeconds: step.estimatedTravelSeconds,
        estimatedDistanceMeters: step.estimatedDistanceMeters,
        serviceDurationSeconds: null,
        state: step.state,
        isCurrent: true,
        expectedCount: step.expectedCount,
        scannedCount: step.scannedCount,
        missingLabelCount: step.missingLabelCount,
        notReadyCount: step.notReadyCount,
        remainingCount: step.remainingCount,
        manifests: [],
    };
}

export function OfflineRoutePanel({
    snapshot,
    actionQueue,
    deliveryHandoff,
    routeContinuity,
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
    deliveryHandoff?: DeliveryHandoffCommandController | null;
    routeContinuity?: ReactNode;
    onArrive: (
        stopId: number,
        routeRevision: number,
    ) => unknown | Promise<unknown>;
    onDeliver: (
        stopId: number,
        routeRevision: number,
        notes?: string,
        completionOverride?: { reason: DeliveryRunCompletionOverrideReason },
    ) => unknown | Promise<unknown>;
    onException: (
        stopId: number,
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
    onVerificationScan: (
        stopId: number,
        tracePath: string,
    ) => unknown | Promise<unknown>;
    onRetry: (operationId: string) => unknown | Promise<unknown>;
    onRecoverConflict: (operationId: string) => unknown | Promise<unknown>;
    onReconcile: () => unknown | Promise<unknown>;
}) {
    const firstStep = snapshot.steps[0];
    const firstStopId = firstStep?.kind === 'delivery' ? firstStep.id : null;
    const firstEntry = firstStopId
        ? deliveryActionPendingEntryForStop(actionQueue, firstStopId)
        : undefined;
    const activeStepIndex = offlineRouteActiveStepIndex(snapshot, actionQueue);
    const currentStep = snapshot.steps[activeStepIndex];
    const currentStopId =
        currentStep?.kind === 'delivery' ? currentStep.id : null;
    const currentEntry = currentStopId
        ? deliveryActionPendingEntryForStop(actionQueue, currentStopId)
        : undefined;
    const deliveryQueued = deliveryActionLocallyCompletesStop(currentEntry);
    const routeBarrier =
        snapshot.source.reroutePending ||
        actionQueue.entries.some(
            (entry) =>
                !isDeliveryHandoffCommand(entry.command) &&
                ((entry.command.kind === 'exception' &&
                    entry.state !== 'synced') ||
                    entry.state === 'failed' ||
                    entry.state === 'conflicted' ||
                    deliveryActionAcknowledgementBlocksRoute(entry)),
        );
    const currentDeliveryStop =
        currentStep && hasDeliveryStopId(currentStep)
            ? offlineDeliveryStop(currentStep, snapshot.scope.runId)
            : null;
    const timelineItems = offlineTimelineItems(
        snapshot.steps,
        activeStepIndex,
    ).map((item) =>
        item.state === 'syncing'
            ? {
                  ...item,
                  statusMessage: deliveryActionCompletionMessage(
                      firstEntry,
                      !routeBarrier,
                  ),
              }
            : item,
    );
    return (
        <main className="min-h-[100dvh] bg-muted/30 p-4">
            <div className="mx-auto max-w-3xl space-y-4">
                {currentDeliveryStop && currentStep?.kind === 'delivery' ? (
                    <DriverCurrentStopCommandCenter
                        key={`${snapshot.scope.runId}:delivery:${currentDeliveryStop.id}:attempt:${currentStep.retryAttempt}`}
                        kind="delivery"
                        offline
                        focusOnMount={activeStepIndex > 0}
                        stop={currentDeliveryStop}
                        routeRevision={snapshot.source.routeRevision}
                        syncEntry={currentEntry}
                        handoff={deliveryHandoff ?? undefined}
                        verifiedTracePaths={deliveryActionVerifiedTracePaths(
                            actionQueue,
                            currentDeliveryStop.id,
                            currentStep.retryAttempt,
                        )}
                        routeSyncBlocked={routeBarrier}
                        onArrive={() =>
                            onArrive(
                                currentDeliveryStop.id,
                                snapshot.source.routeRevision,
                            )
                        }
                        onDeliver={(notes, completionOverride) =>
                            onDeliver(
                                currentDeliveryStop.id,
                                snapshot.source.routeRevision,
                                notes,
                                completionOverride,
                            )
                        }
                        onException={(mutation) =>
                            onException(currentDeliveryStop.id, mutation)
                        }
                        onVerificationScan={(tracePath) =>
                            onVerificationScan(
                                currentDeliveryStop.id,
                                tracePath,
                            )
                        }
                        onRetrySync={onRetry}
                        onDiscardSync={onRecoverConflict}
                        onReconcileSync={onReconcile}
                    />
                ) : currentStep?.kind === 'pickup' ? (
                    <DriverCurrentStopCommandCenter
                        key={`${snapshot.scope.runId}:pickup:${currentStep.id}`}
                        kind="pickup"
                        offline
                        focusOnMount={activeStepIndex > 0}
                        pickup={offlinePickup(currentStep)}
                        pendingAction={null}
                        routeSyncBlocked={routeBarrier}
                        sync={{
                            state: 'idle',
                            pendingCount: 0,
                            durability: actionQueue.durability,
                            coordination: actionQueue.coordination,
                            blockingOperationId: null,
                        }}
                    />
                ) : null}
                {routeContinuity}
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
                    currentStopId={currentStopId}
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
                <section
                    aria-labelledby="offline-route-timeline-heading"
                    className="space-y-3"
                >
                    <Typography
                        id="offline-route-timeline-heading"
                        level="h3"
                        semiBold
                    >
                        Tijek rute
                    </Typography>
                    <DriverRouteProgressTimeline
                        items={timelineItems}
                        label="Izvanmrežni tijek dostavne rute"
                        renderDetails={(item) => {
                            const index = snapshot.steps.findIndex(
                                (candidate) =>
                                    offlineStepIdentity(candidate) === item.id,
                            );
                            const step = snapshot.steps[index];
                            if (!step) return null;
                            const actionState =
                                index < activeStepIndex
                                    ? 'completed'
                                    : index === activeStepIndex
                                      ? 'current'
                                      : step.actionState;
                            return (
                                <div className="space-y-3">
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
                                        {step.estimatedDistanceMeters !==
                                        null ? (
                                            <Chip size="sm">
                                                {formatDistance(
                                                    step.estimatedDistanceMeters,
                                                )}
                                            </Chip>
                                        ) : null}
                                    </div>
                                    {index ===
                                    activeStepIndex ? null : routeBarrier ||
                                      actionState === 'locked' ||
                                      index < activeStepIndex ||
                                      (index > activeStepIndex &&
                                          !deliveryQueued) ? (
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
                                                <Typography
                                                    level="body3"
                                                    semiBold
                                                >
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
                                </div>
                            );
                        }}
                    />
                </section>
                <Typography level="body3" className="text-muted-foreground">
                    Kopija vrijedi najviše 24 sata i briše se završetkom rute,
                    promjenom korisnika ili odjavom.
                </Typography>
            </div>
        </main>
    );
}
