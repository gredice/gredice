'use client';

import type { DeliveryRunCompletionBypass } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import {
    type DeliveryHandoffManifestItemView,
    type DeliveryHandoffManifestView,
    type DeliveryHandoffMarkItemInput,
    DeliveryHarvestVerification,
} from '../components/DeliveryHarvestVerification';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import { normalizeHarvestTraceScanValue } from '../lib/harvestTraceScan';
import { bulkExceptionStop } from './deliveryRecoveryFixtures';

const [tomatoDelivery, basilDelivery, lettuceDelivery] =
    bulkExceptionStop.deliveries;
if (!tomatoDelivery || !basilDelivery || !lettuceDelivery) {
    throw new Error('The handoff story requires three bulk deliveries.');
}

const lettuceDeliveryWithoutPhone: DeliveryStopDeliverySummary = {
    ...lettuceDelivery,
    phone: null,
};

const pepperDelivery: DeliveryStopDeliverySummary = {
    ...lettuceDeliveryWithoutPhone,
    stopId: 104,
    requestId: 'request-pepper',
    contactName: `${lettuceDelivery.contactName} – ažurirano`,
    phone: '+385 (91) 333-3333',
    harvest: {
        ...lettuceDelivery.harvest,
        plantName: 'Paprika babura',
        raisedBedName: 'Gredica D',
        tracePath: '/trag/pepper-trace-00004',
    },
};

const deliveries = [
    tomatoDelivery,
    basilDelivery,
    lettuceDeliveryWithoutPhone,
    pepperDelivery,
];

function initialItems(): DeliveryHandoffManifestItemView[] {
    return deliveries.flatMap((delivery, index) =>
        delivery.stopId === null
            ? []
            : [
                  {
                      stopId: delivery.stopId,
                      deliveryRequestId: delivery.requestId,
                      retryAttempt: 0,
                      traceLinkId: index + 1,
                      qrAvailable: true,
                      state: 'unverified',
                      reason: null,
                      verifiedAt: null,
                      syncState: 'persisted',
                  },
              ],
    );
}

function countItems(
    items: DeliveryHandoffManifestItemView[],
    state: DeliveryHandoffManifestItemView['state'],
) {
    return items.filter((item) => item.state === state).length;
}

function manifestView(
    items: DeliveryHandoffManifestItemView[],
    syncState: DeliveryHandoffManifestView['syncState'],
): DeliveryHandoffManifestView {
    return {
        runId: 'run-handoff-component',
        targetStopId: 101,
        retryAttempt: 0,
        version: 1,
        items,
        expectedCount: items.length,
        scannedCount: countItems(items, 'scanned'),
        unverifiedCount: countItems(items, 'unverified'),
        noLabelCount: countItems(items, 'no-label'),
        missingCount: countItems(items, 'missing'),
        skippedCount: countItems(items, 'skipped'),
        syncState,
        pendingCount: items.filter(
            (item) =>
                item.syncState !== undefined && item.syncState !== 'persisted',
        ).length,
        error:
            syncState === 'failed'
                ? 'Sinkronizacija provjere nije uspjela.'
                : null,
    };
}

function deliveriesForTracePath(
    storyDeliveries: DeliveryStopDeliverySummary[],
    tracePath: string,
) {
    return storyDeliveries.filter((delivery) => {
        const deliveryTracePath = delivery.harvest.tracePath;
        return (
            deliveryTracePath !== null &&
            normalizeHarvestTraceScanValue(deliveryTracePath) === tracePath
        );
    });
}

export function DeliveryHandoffVerificationStory({
    handoffUnavailable = false,
    serverFeedback = false,
    sharedTrace = false,
    syncState = 'ready',
}: {
    handoffUnavailable?: boolean;
    serverFeedback?: boolean;
    sharedTrace?: boolean;
    syncState?: DeliveryHandoffManifestView['syncState'];
}) {
    const [items, setItems] = useState(initialItems);
    const [verificationKey, setVerificationKey] = useState(0);
    const [completionOpen, setCompletionOpen] = useState(false);
    const [events, setEvents] = useState<string[]>([]);
    const [completionResult, setCompletionResult] = useState('none');
    const [completionCalls, setCompletionCalls] = useState(0);
    const handoff = manifestView(items, syncState);
    const completionOverrideBypasses: DeliveryRunCompletionBypass[] = [];
    if (
        handoffUnavailable ||
        handoff.unverifiedCount > 0 ||
        handoff.pendingCount > 0 ||
        syncState === 'failed' ||
        syncState === 'loading'
    ) {
        completionOverrideBypasses.push('handoff-review');
    }
    const storyDeliveries = sharedTrace
        ? deliveries.map((delivery) =>
              delivery.requestId === basilDelivery.requestId
                  ? {
                        ...delivery,
                        harvest: {
                            ...delivery.harvest,
                            tracePath: tomatoDelivery.harvest.tracePath,
                        },
                    }
                  : delivery,
          )
        : deliveries;

    function recordEvent(event: string) {
        setEvents((current) => [...current, event]);
    }

    async function scan(value: string) {
        const tracePath = normalizeHarvestTraceScanValue(value);
        if (!tracePath) {
            recordEvent('invalid');
            return { status: 'verification-invalid' as const };
        }
        const matchedDeliveries = deliveriesForTracePath(
            storyDeliveries,
            tracePath,
        ).filter(
            (
                delivery,
            ): delivery is DeliveryStopDeliverySummary & {
                stopId: number;
            } => delivery.stopId !== null,
        );
        const delivery = matchedDeliveries[0];
        if (!delivery) {
            recordEvent('wrong-stop');
            return { status: 'not-at-stop' as const, tracePath };
        }
        const matchedStopIds = new Set(
            matchedDeliveries.map((candidate) => candidate.stopId),
        );
        if (
            matchedDeliveries.every((candidate) =>
                items.some(
                    (item) =>
                        item.stopId === candidate.stopId &&
                        item.state === 'scanned',
                ),
            )
        ) {
            recordEvent('duplicate');
            return {
                status: 'already-verified' as const,
                tracePath,
                plantName: delivery.harvest.plantName,
                contactName: delivery.contactName,
            };
        }

        setItems((current) =>
            current.map((candidate) =>
                matchedStopIds.has(candidate.stopId)
                    ? {
                          ...candidate,
                          state: 'scanned',
                          reason: null,
                          verifiedAt: '2026-07-16T08:00:00.000Z',
                          syncState: 'queued',
                      }
                    : candidate,
            ),
        );
        recordEvent(
            `scanned:${matchedDeliveries
                .map((candidate) => candidate.stopId)
                .join(',')}`,
        );
        return {
            status: 'verified' as const,
            tracePath,
            plantName: delivery.harvest.plantName,
            contactName: delivery.contactName,
            nextVerifiedTracePaths: [tracePath],
        };
    }

    async function markItem({
        itemStopId,
        outcome,
        reason,
    }: DeliveryHandoffMarkItemInput) {
        setItems((current) =>
            current.map((item) =>
                item.stopId === itemStopId
                    ? {
                          ...item,
                          state: outcome,
                          reason:
                              outcome === 'skipped' ? (reason ?? null) : null,
                          verifiedAt: '2026-07-16T08:05:00.000Z',
                          syncState: 'queued',
                      }
                    : item,
            ),
        );
        recordEvent(
            `mark:${itemStopId}:${outcome}${reason ? `:${reason}` : ''}`,
        );
    }

    async function markRemainingReviewed() {
        const remainingStopIds = items.flatMap((item) =>
            item.state === 'unverified' ? [item.stopId] : [],
        );
        setItems((current) =>
            current.map((item) =>
                item.state === 'unverified'
                    ? {
                          ...item,
                          state: 'skipped',
                          reason: 'manual-verification',
                          verifiedAt: '2026-07-16T08:10:00.000Z',
                          syncState: 'queued',
                      }
                    : item,
            ),
        );
        recordEvent(`manual:${remainingStopIds.join(',')}`);
    }

    return (
        <main className="mx-auto max-w-2xl space-y-4 p-4">
            <output data-testid="handoff-events">{events.join('|')}</output>
            <output data-testid="completion-result">{completionResult}</output>
            <output data-testid="completion-calls">{completionCalls}</output>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outlined"
                    onClick={() => setVerificationKey((current) => current + 1)}
                >
                    Simuliraj osvježavanje prikaza
                </Button>
                <Button
                    type="button"
                    color="success"
                    onClick={() => setCompletionOpen(true)}
                >
                    Dostavi 4 uroda · dalje
                </Button>
            </div>
            <DeliveryHarvestVerification
                key={verificationKey}
                deliveries={storyDeliveries}
                disabled={false}
                handoff={handoffUnavailable ? null : handoff}
                feedback={
                    serverFeedback
                        ? [
                              {
                                  operationId: 'server-feedback-1',
                                  kind: 'wrong-stop',
                                  message:
                                      'QR kod pripada drugoj stanici na ruti.',
                              },
                          ]
                        : []
                }
                onScan={scan}
                onMarkItem={markItem}
                onMarkRemainingReviewed={markRemainingReviewed}
                completionConfirmation={{
                    open: completionOpen,
                    arrived: true,
                    overrideBypasses: completionOverrideBypasses,
                    recipientCount: 3,
                    onOpenChange: setCompletionOpen,
                    onConfirm: () => {
                        setCompletionCalls((current) => current + 1);
                        setCompletionResult('delivered');
                    },
                }}
            />
        </main>
    );
}
