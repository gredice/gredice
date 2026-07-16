'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeliveryHandoffManifestView } from '../components/DeliveryHarvestVerification';
import {
    type DeliveryHandoffCommandController,
    DriverCurrentStopCommandCenter,
} from '../components/DriverCurrentStopCommandCenter';
import { HarvestTraceScanner } from '../components/HarvestTraceScanner';
import type { DeliveryActionQueueEntry } from '../lib/deliveryActionQueue';
import type {
    DeliveryPickupStepSummary,
    DeliveryStopSummary,
} from '../lib/deliveryDashboardTypes';
import {
    bulkExceptionStop,
    deferredRetryStop,
} from './deliveryRecoveryFixtures';

const occurredAt = '2026-07-15T08:31:00.000Z';
const terminalDeliveryFixture = bulkExceptionStop.deliveries[0];
if (!terminalDeliveryFixture) {
    throw new Error('Bulk delivery fixture requires one delivery.');
}

const currentStop: DeliveryStopSummary = {
    ...bulkExceptionStop,
    stopState: 'pending',
    statusLabel: 'U dostavi',
    arrivedAt: null,
    recipientCount: 3,
    addressLabel: 'Ulaz iz dvorišta',
    requestNotes: null,
    deliveries: [
        ...bulkExceptionStop.deliveries.map((delivery, index) => ({
            ...delivery,
            stopState: 'pending' as const,
            phone:
                index === 0
                    ? '+385 91 111 1111'
                    : index === 1
                      ? '+385 92 222 2222'
                      : '+385 91 111 1111',
            addressLabel:
                index === 0
                    ? 'Ulaz iz dvorišta'
                    : index === 1
                      ? 'Treći kat bez lifta'
                      : null,
            requestNotes:
                index === 0
                    ? 'Pozvoni dva puta.'
                    : index === 1
                      ? 'Sanduk ostavi u hladu.'
                      : null,
        })),
        {
            ...terminalDeliveryFixture,
            requestId: 'request-terminal-history',
            stopId: 99,
            stopState: 'failed',
            requestState: 'failed',
            contactName: 'Zara Završena',
            phone: '+385 99 999 9999',
            requestNotes: 'Ne zovi ovaj završeni kontakt.',
        },
    ],
};

const arrivedStop: DeliveryStopSummary = {
    ...currentStop,
    stopState: 'arrived',
    statusLabel: 'Vozač je stigao',
    arrivedAt: occurredAt,
    deliveries: currentStop.deliveries.map((delivery) => ({
        ...delivery,
        stopState:
            delivery.requestId === 'request-terminal-history'
                ? 'failed'
                : 'arrived',
    })),
};

const singleArrivedDelivery = arrivedStop.deliveries[0];
if (!singleArrivedDelivery) {
    throw new Error('Current-stop story requires one actionable delivery.');
}

const singleArrivedStop: DeliveryStopSummary = {
    ...arrivedStop,
    requestId: singleArrivedDelivery.requestId,
    contactName: singleArrivedDelivery.contactName,
    phone: singleArrivedDelivery.phone,
    harvest: singleArrivedDelivery.harvest,
    deliveryCount: 1,
    deliveries: [singleArrivedDelivery],
};

function handoffController(): DeliveryHandoffCommandController {
    const items = arrivedStop.deliveries.flatMap((delivery, index) =>
        delivery.stopId === null
            ? []
            : [
                  {
                      stopId: delivery.stopId,
                      deliveryRequestId: delivery.requestId,
                      retryAttempt: 0,
                      traceLinkId: delivery.harvest.tracePath
                          ? index + 1
                          : null,
                      qrAvailable: Boolean(delivery.harvest.tracePath),
                      state:
                          index === 0
                              ? ('scanned' as const)
                              : index === 1
                                ? ('unverified' as const)
                                : index === 2
                                  ? ('no-label' as const)
                                  : ('unverified' as const),
                      reason: null,
                      verifiedAt:
                          index === 0 ? '2026-07-15T08:32:00.000Z' : null,
                      syncState: 'persisted' as const,
                  },
              ],
    );
    const view: DeliveryHandoffManifestView = {
        runId: 'run-component-4127',
        targetStopId: arrivedStop.id ?? 41,
        version: 1,
        retryAttempt: 0,
        items,
        expectedCount: items.length,
        scannedCount: items.filter((item) => item.state === 'scanned').length,
        unverifiedCount: items.filter((item) => item.state === 'unverified')
            .length,
        noLabelCount: items.filter((item) => item.state === 'no-label').length,
        missingCount: 0,
        skippedCount: 0,
        syncState: 'ready',
        pendingCount: 0,
        error: null,
    };
    return {
        view,
        feedback: [],
        scan: () => ({ status: 'verification-invalid' }),
        markItem: () => undefined,
        markRemainingReviewed: () => undefined,
    };
}

function singleHandoffController(
    state: 'scanned' | 'unverified',
): DeliveryHandoffCommandController {
    const stopId = singleArrivedDelivery.stopId;
    if (stopId === null) {
        throw new Error('Single delivery story requires a persisted stop.');
    }
    const item = {
        stopId,
        deliveryRequestId: singleArrivedDelivery.requestId,
        retryAttempt: 0,
        traceLinkId: 1,
        qrAvailable: true,
        state,
        reason: null,
        verifiedAt: state === 'scanned' ? '2026-07-15T08:32:00.000Z' : null,
        syncState: 'persisted' as const,
    };
    return {
        view: {
            runId: 'run-component-4127',
            targetStopId: stopId,
            version: 1,
            retryAttempt: 0,
            items: [item],
            expectedCount: 1,
            scannedCount: state === 'scanned' ? 1 : 0,
            unverifiedCount: state === 'unverified' ? 1 : 0,
            noLabelCount: 0,
            missingCount: 0,
            skippedCount: 0,
            syncState: 'ready',
            pendingCount: 0,
            error: null,
        },
        feedback: [],
        scan: () => ({ status: 'verification-invalid' }),
        markItem: () => undefined,
        markRemainingReviewed: () => undefined,
    };
}

function actionEntry(
    kind: 'arrive' | 'deliver',
    state: DeliveryActionQueueEntry['state'],
): DeliveryActionQueueEntry {
    return {
        sequence: 0,
        command: {
            kind,
            operationId: `${kind}-current-stop`,
            runId: 'run-component-4127',
            stopId: currentStop.id ?? 41,
            expectedRouteRevision: 12,
            occurredAt,
        },
        state,
        attemptCount: state === 'queued' ? 0 : 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        ...(state === 'failed' ? { errorCode: 'offline' } : {}),
        ...(state === 'conflicted'
            ? { errorCode: 'route-revision-conflict' }
            : {}),
    };
}

export function DriverCurrentDeliveryCommandStory({
    arrived = false,
    syncState,
    syncKind = 'arrive',
    throwOnArrive = false,
    late = false,
    withHandoff = false,
}: {
    arrived?: boolean;
    syncState?: DeliveryActionQueueEntry['state'];
    syncKind?: 'arrive' | 'deliver';
    throwOnArrive?: boolean;
    late?: boolean;
    withHandoff?: boolean;
}) {
    const [result, setResult] = useState('none');
    const selectedStop = arrived ? arrivedStop : currentStop;
    const stop = late
        ? {
              ...selectedStop,
              estimatedArrivalAt: '2026-07-15T12:30:00.000Z',
          }
        : selectedStop;
    return (
        <div className="min-h-[150dvh] bg-muted/30">
            <div className="sticky top-0 z-20 h-16 border-b bg-background" />
            <main className="space-y-4 px-4 py-5">
                <output className="sr-only" data-testid="current-stop-result">
                    {result}
                </output>
                <DriverCurrentStopCommandCenter
                    kind="delivery"
                    stop={stop}
                    routeRevision={12}
                    handoff={withHandoff ? handoffController() : undefined}
                    syncEntry={
                        syncState ? actionEntry(syncKind, syncState) : undefined
                    }
                    onArrive={async () => {
                        if (throwOnArrive) {
                            throw new Error(
                                'Dolazak nije spremljen na uređaj.',
                            );
                        }
                        setResult('arrived');
                    }}
                    onDeliver={(notes, completionOverride) =>
                        setResult(
                            `delivered:${notes ?? ''}${
                                completionOverride
                                    ? `:${completionOverride.reason}`
                                    : ''
                            }`,
                        )
                    }
                    onException={async () => ({ status: 'saved' })}
                    onVerificationScan={(tracePath) =>
                        setResult(`verified:${tracePath}`)
                    }
                    onRetrySync={() => setResult('retried')}
                    onDiscardSync={() => setResult('discarded')}
                    onReconcileSync={() => setResult('reconciled')}
                />
                <div className="h-96" aria-hidden="true" />
            </main>
        </div>
    );
}

export function DriverSingleDeliveryCommandStory({
    pendingDelivery = false,
    unverified = false,
}: {
    pendingDelivery?: boolean;
    unverified?: boolean;
}) {
    const [deliveryCalls, setDeliveryCalls] = useState(0);
    const [overrideReason, setOverrideReason] = useState('none');
    return (
        <main className="min-h-[100dvh] bg-muted/30 p-4">
            <output data-testid="single-delivery-calls">{deliveryCalls}</output>
            <output data-testid="single-override-reason">
                {overrideReason}
            </output>
            <DriverCurrentStopCommandCenter
                kind="delivery"
                stop={singleArrivedStop}
                routeRevision={12}
                handoff={singleHandoffController(
                    unverified ? 'unverified' : 'scanned',
                )}
                onArrive={() => undefined}
                onDeliver={async (_notes, completionOverride) => {
                    setDeliveryCalls((current) => current + 1);
                    setOverrideReason(completionOverride?.reason ?? 'none');
                    if (pendingDelivery) {
                        await new Promise<void>(() => undefined);
                    }
                }}
                onException={async () => ({ status: 'saved' })}
            />
        </main>
    );
}

export function DriverCurrentDeferredCommandStory({
    offline = false,
    retryAvailable = true,
}: {
    offline?: boolean;
    retryAvailable?: boolean;
}) {
    const [result, setResult] = useState('none');
    return (
        <div className="min-h-[150dvh] p-4">
            <output data-testid="current-stop-result">{result}</output>
            <DriverCurrentStopCommandCenter
                kind="delivery"
                stop={deferredRetryStop}
                routeRevision={13}
                offline={offline}
                onRetry={
                    retryAvailable ? () => setResult('retried') : undefined
                }
                onException={async () => ({ status: 'saved' })}
            />
        </div>
    );
}

const pickup: DeliveryPickupStepSummary = {
    id: 'pickup-current',
    pickupLocationId: 1,
    sequence: 1,
    itinerarySequence: 1,
    name: 'Gredice HQ',
    address: 'HQ ulica 1, Zagreb',
    estimatedArrivalAt: '2026-07-15T08:20:00.000Z',
    estimatedTravelSeconds: 480,
    estimatedDistanceMeters: 2_100,
    serviceDurationSeconds: 600,
    state: 'partial',
    isCurrent: true,
    expectedCount: 2,
    scannedCount: 1,
    missingLabelCount: 0,
    notReadyCount: 0,
    remainingCount: 1,
    manifests: [
        {
            id: 'manifest-current',
            timeSlotId: 1,
            startAt: '2026-07-15T08:00:00.000Z',
            endAt: '2026-07-15T09:00:00.000Z',
            state: 'pending',
            confirmedAt: null,
            expectedCount: 2,
            scannedCount: 1,
            missingLabelCount: 0,
            notReadyCount: 0,
            remainingCount: 1,
            items: [
                {
                    id: 'pickup-item-current',
                    stopId: 91,
                    requestId: 'pickup-request-current',
                    stopKey: 'pickup-stop-current',
                    state: 'ready',
                    resolvedAt: null,
                    tracePath: '/trag/pickup-current-0001',
                    harvest: {
                        plantName: 'Rajčica',
                        operationName: null,
                        raisedBedName: 'Gredica A',
                        fieldName: null,
                        tracePath: '/trag/pickup-current-0001',
                    },
                },
            ],
        },
    ],
};

export const currentPickupFixture = pickup;

export function DriverCurrentPickupCommandStory({
    offline = false,
    readyToConfirm = false,
    routeSyncBlocked = false,
    syncState = 'idle',
    failRecovery = false,
    failScan = false,
}: {
    offline?: boolean;
    readyToConfirm?: boolean;
    routeSyncBlocked?: boolean;
    syncState?: 'idle' | 'failed' | 'conflicted';
    failRecovery?: boolean;
    failScan?: boolean;
}) {
    const [result, setResult] = useState('none');
    const [scanAttempts, setScanAttempts] = useState(0);
    const displayedPickup: DeliveryPickupStepSummary = readyToConfirm
        ? {
              ...pickup,
              scannedCount: 2,
              remainingCount: 0,
              manifests: pickup.manifests.map((manifest) => ({
                  ...manifest,
                  scannedCount: 2,
                  remainingCount: 0,
                  items: manifest.items.map((item) => ({
                      ...item,
                      state: 'scanned',
                  })),
              })),
          }
        : pickup;
    return (
        <div className="min-h-[150dvh] bg-muted/30">
            <div className="sticky top-0 z-20 h-16 border-b bg-background" />
            <main className="space-y-4 px-4 py-5">
                <output className="sr-only" data-testid="current-stop-result">
                    {result}
                </output>
                <output className="sr-only" data-testid="scan-attempts">
                    {scanAttempts}
                </output>
                <DriverCurrentStopCommandCenter
                    kind="pickup"
                    pickup={displayedPickup}
                    pendingAction={null}
                    offline={offline}
                    routeSyncBlocked={routeSyncBlocked}
                    sync={{
                        state: syncState,
                        pendingCount: syncState === 'idle' ? 0 : 1,
                        durability: 'durable',
                        coordination: 'coordinated',
                        blockingOperationId:
                            syncState === 'idle' ? null : 'pickup-operation',
                    }}
                    onScan={() => {
                        setScanAttempts((count) => count + 1);
                        if (failScan) {
                            return {
                                status: 'pickup-failed',
                                tracePath: '/trag/pickup-current-0001',
                                plantName: 'Rajčica',
                                message:
                                    'Očitavanje nije sigurno spremljeno. Skeniraj QR kod ponovno.',
                            };
                        }
                        setResult('scanned');
                        return { status: 'pickup-invalid' };
                    }}
                    onSetItemState={(_pickupId, _manifestId, _stopId, state) =>
                        setResult(`item:${state}`)
                    }
                    onResolveRemaining={() => setResult('resolved')}
                    onConfirmManifest={() => setResult('confirmed')}
                    onRetrySync={() =>
                        failRecovery
                            ? {
                                  status: 'failed' as const,
                                  message: 'Pokušaj preuzimanja nije uspio.',
                              }
                            : setResult('retried')
                    }
                    onDiscardSync={() => setResult('discarded')}
                />
                <div className="h-96" aria-hidden="true" />
            </main>
        </div>
    );
}

function scannerSessionResult(tracePath: string, plantName: string) {
    return {
        status: 'pickup-queued' as const,
        tracePath,
        plantName,
        matchedCount: 1,
    };
}

type ScannerSessionResult = ReturnType<typeof scannerSessionResult>;

export function HarvestTraceScannerSessionStory({
    releaseFirstScan = false,
}: {
    releaseFirstScan?: boolean;
}) {
    const scanNumberRef = useRef(0);
    const firstScanPromiseRef = useRef<Promise<ScannerSessionResult> | null>(
        null,
    );
    const resolveFirstScanRef = useRef<
        ((result: ScannerSessionResult) => void) | null
    >(null);

    useEffect(() => {
        if (!releaseFirstScan) return;
        resolveFirstScanRef.current?.(
            scannerSessionResult('/trag/stari-urod', 'Stari urod'),
        );
        resolveFirstScanRef.current = null;
    }, [releaseFirstScan]);

    return (
        <main className="p-4">
            <HarvestTraceScanner
                variant="manifest"
                availableTraceCount={2}
                completedTraceCount={0}
                disabled={false}
                onScan={(value) => {
                    scanNumberRef.current += 1;
                    if (scanNumberRef.current === 1) {
                        const firstScanPromise =
                            new Promise<ScannerSessionResult>((resolve) => {
                                resolveFirstScanRef.current = resolve;
                            });
                        firstScanPromiseRef.current = firstScanPromise;
                        return firstScanPromise;
                    }

                    const result = scannerSessionResult(value, 'Novi urod');
                    return firstScanPromiseRef.current
                        ? firstScanPromiseRef.current.then(() => result)
                        : result;
                }}
            />
        </main>
    );
}
