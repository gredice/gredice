'use client';

import type {
    DeliveryRunHandoffItemSnapshot,
    DeliveryRunHandoffItemState,
    DeliveryRunHandoffManifest,
    DeliveryRunHandoffSkipReason,
} from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Check, Info, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useId, useState } from 'react';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import { isDriverCommandResult } from '../lib/driverCommandResult';
import {
    type HarvestTraceVerificationResult,
    normalizeHarvestTraceScanValue,
    verifyDeliveryStopHarvestTrace,
} from '../lib/harvestTraceScan';
import { DeliveryHandoffCompletionDialog } from './DeliveryHandoffCompletionDialog';
import { DeliveryHandoffVerificationItem } from './DeliveryHandoffVerificationItem';
import {
    type HarvestTraceScanFailureResult,
    HarvestTraceScanner,
} from './HarvestTraceScanner';

export type { DeliveryRunHandoffItemState, DeliveryRunHandoffSkipReason };

export type DeliveryHandoffItemSyncState =
    | 'persisted'
    | 'queued'
    | 'sending'
    | 'failed';

export type DeliveryHandoffManifestItemView = DeliveryRunHandoffItemSnapshot & {
    syncState?: DeliveryHandoffItemSyncState;
};

export type DeliveryHandoffManifestView = Omit<
    DeliveryRunHandoffManifest,
    'items'
> & {
    items: DeliveryHandoffManifestItemView[];
    syncState: 'loading' | 'ready' | 'offline' | 'syncing' | 'failed';
    pendingCount: number;
    error: string | null;
};

export type DeliveryHandoffMarkItemInput = {
    itemStopId: number;
    outcome: 'no-label' | 'missing' | 'skipped';
    reason?: DeliveryRunHandoffSkipReason;
};

export type DeliveryHandoffFeedbackView = {
    operationId: string;
    kind:
        | 'stale'
        | 'invalid'
        | 'wrong-stop'
        | 'item-not-found'
        | 'sync-failed'
        | 'conflict';
    message: string;
};

export type DeliveryHandoffCompletionConfirmation = {
    open: boolean;
    pending?: boolean;
    disabled?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => unknown | Promise<unknown>;
};

export type DeliveryHandoffSummary = {
    expectedCount: number;
    scannedCount: number;
    unverifiedCount: number;
    noLabelCount: number;
    missingCount: number;
    skippedCount: number;
    pendingCount: number;
};

export type DeliveryHarvestVerificationProps = {
    deliveries: DeliveryStopDeliverySummary[];
    disabled: boolean;
    compact?: boolean;
    /**
     * `undefined` temporarily selects the legacy controlled trace-path adapter.
     * `null` means the retry-scoped manifest is still being loaded.
     */
    handoff?: DeliveryHandoffManifestView | null;
    feedback?: readonly DeliveryHandoffFeedbackView[];
    onScan?: (
        value: string,
    ) =>
        | HarvestTraceVerificationResult
        | HarvestTraceScanFailureResult
        | Promise<
              HarvestTraceVerificationResult | HarvestTraceScanFailureResult
          >;
    onMarkItem?: (
        input: DeliveryHandoffMarkItemInput,
    ) => unknown | Promise<unknown>;
    onMarkRemainingReviewed?: () => unknown | Promise<unknown>;
    completionConfirmation?: DeliveryHandoffCompletionConfirmation;
    /** @deprecated Use the retry-scoped `handoff` model. */
    verifiedTracePaths?: string[];
    /** @deprecated Use `onScan`. */
    onVerifiedTrace?: (tracePath: string) => unknown | Promise<unknown>;
};

function handoffItemCount(
    items: DeliveryHandoffManifestItemView[],
    state: DeliveryRunHandoffItemState,
) {
    return items.filter((item) => item.state === state).length;
}

function handoffSummaryFromItems(
    items: DeliveryHandoffManifestItemView[],
    pendingCount: number,
): DeliveryHandoffSummary {
    return {
        expectedCount: items.length,
        scannedCount: handoffItemCount(items, 'scanned'),
        unverifiedCount: handoffItemCount(items, 'unverified'),
        noLabelCount: handoffItemCount(items, 'no-label'),
        missingCount: handoffItemCount(items, 'missing'),
        skippedCount: handoffItemCount(items, 'skipped'),
        pendingCount,
    };
}

export function deliveryHandoffSummary(
    handoff: DeliveryHandoffManifestView | null,
): DeliveryHandoffSummary {
    return handoffSummaryFromItems(
        handoff?.items ?? [],
        handoff?.pendingCount ?? 0,
    );
}

function matchingDelivery(
    deliveries: DeliveryStopDeliverySummary[],
    item: DeliveryHandoffManifestItemView,
) {
    return (
        deliveries.find(
            (delivery) => delivery.requestId === item.deliveryRequestId,
        ) ?? deliveries.find((delivery) => delivery.stopId === item.stopId)
    );
}

function normalizedItemTracePath(
    deliveries: DeliveryStopDeliverySummary[],
    item: DeliveryHandoffManifestItemView,
) {
    const tracePath = matchingDelivery(deliveries, item)?.harvest.tracePath;
    return tracePath ? normalizeHarvestTraceScanValue(tracePath) : null;
}

function legacyHandoffItems(
    deliveries: DeliveryStopDeliverySummary[],
    verifiedTracePaths: string[],
): DeliveryHandoffManifestItemView[] {
    const verifiedTracePathSet = new Set(
        verifiedTracePaths.flatMap((tracePath) => {
            const normalized = normalizeHarvestTraceScanValue(tracePath);
            return normalized ? [normalized] : [];
        }),
    );
    return deliveries.flatMap((delivery) => {
        if (delivery.stopId === null) return [];
        const tracePath = delivery.harvest.tracePath
            ? normalizeHarvestTraceScanValue(delivery.harvest.tracePath)
            : null;
        const qrAvailable = Boolean(tracePath);
        const state: DeliveryRunHandoffItemState = !qrAvailable
            ? 'no-label'
            : tracePath && verifiedTracePathSet.has(tracePath)
              ? 'scanned'
              : 'unverified';
        return [
            {
                stopId: delivery.stopId,
                deliveryRequestId: delivery.requestId,
                retryAttempt: 0,
                traceLinkId: null,
                qrAvailable,
                state,
                reason: null,
                verifiedAt: null,
                syncState: 'persisted',
            },
        ];
    });
}

export function DeliveryHarvestVerification({
    deliveries,
    disabled,
    compact = false,
    handoff,
    feedback = [],
    onScan,
    onMarkItem,
    onMarkRemainingReviewed,
    completionConfirmation,
    verifiedTracePaths = [],
    onVerifiedTrace,
}: DeliveryHarvestVerificationProps) {
    const headingId = useId();
    const controlledHandoff = handoff !== undefined;
    const items = controlledHandoff
        ? (handoff?.items ?? [])
        : legacyHandoffItems(deliveries, verifiedTracePaths);
    const summary = controlledHandoff
        ? deliveryHandoffSummary(handoff ?? null)
        : handoffSummaryFromItems(
              items.filter((item) => item.qrAvailable),
              0,
          );
    const availableTracePaths = new Set(
        items.flatMap((item) => {
            if (!item.qrAvailable) return [];
            const tracePath = normalizedItemTracePath(deliveries, item);
            return tracePath ? [tracePath] : [];
        }),
    );
    const completedTracePaths = new Set(
        items.flatMap((item) => {
            if (!item.qrAvailable || item.state !== 'scanned') return [];
            const tracePath = normalizedItemTracePath(deliveries, item);
            return tracePath ? [tracePath] : [];
        }),
    );
    const availableTraceCount = availableTracePaths.size;
    const completedTraceCount = completedTracePaths.size;
    const fullyScanned =
        summary.expectedCount > 0 &&
        summary.scannedCount === summary.expectedCount;
    const fullyReviewed =
        summary.expectedCount > 0 && summary.unverifiedCount === 0;
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    async function verifyTrace(
        value: string,
    ): Promise<HarvestTraceVerificationResult | HarvestTraceScanFailureResult> {
        if (controlledHandoff) {
            if (!onScan) {
                return {
                    status: 'scan-failed',
                    message:
                        'Provjeru trenutačno nije moguće sigurno spremiti.',
                };
            }
            return await onScan(value);
        }

        const result = verifyDeliveryStopHarvestTrace({
            deliveries,
            verifiedTracePaths,
            scanValue: value,
        });
        if (result.status !== 'verified') return result;

        const persistenceResult = await onVerifiedTrace?.(result.tracePath);
        if (
            isDriverCommandResult(persistenceResult) &&
            persistenceResult.status === 'failed'
        ) {
            return {
                status: 'scan-failed',
                message: persistenceResult.message,
            };
        }
        return result;
    }

    async function runItemAction(
        key: string,
        action: () => unknown | Promise<unknown>,
    ) {
        setPendingAction(key);
        setActionError(null);
        try {
            const result = await action();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setActionError(result.message);
                return false;
            }
            return true;
        } catch {
            setActionError(
                'Promjenu nije moguće sigurno spremiti. Pokušaj ponovno ili potvrdi dostavu bez QR provjere.',
            );
            return false;
        } finally {
            setPendingAction(null);
        }
    }

    const verificationLoading =
        controlledHandoff &&
        (handoff === null || handoff.syncState === 'loading');
    const verificationDisabled =
        disabled || verificationLoading || (controlledHandoff && !onScan);

    return (
        <section
            className={compact ? 'space-y-2' : 'space-y-3'}
            aria-labelledby={headingId}
        >
            <div>
                <Typography id={headingId} level="body2" semiBold>
                    QR provjera predaje
                </Typography>
                <Typography
                    level="body3"
                    className={
                        compact ? 'sr-only' : 'mt-0.5 text-muted-foreground'
                    }
                >
                    Provjeri urode dok ih predaješ korisniku kako ništa ne bi
                    ostalo u vozilu.
                </Typography>
            </div>

            {verificationLoading ? (
                <Alert
                    color="info"
                    startDecorator={<Info className="size-5" />}
                >
                    Učitavanje popisa uroda za ovu predaju…
                </Alert>
            ) : (
                <Alert
                    color={fullyScanned ? 'success' : 'info'}
                    startDecorator={
                        fullyScanned ? (
                            <Check className="size-5" />
                        ) : (
                            <Info className="size-5" />
                        )
                    }
                >
                    {!controlledHandoff && summary.expectedCount === 0
                        ? 'Za ovu stanicu nema dostupnih QR kodova. Nastavi ručnom provjerom.'
                        : !controlledHandoff && fullyScanned
                          ? 'Svi urodi s dostupnim QR kodom provjereni su za ovu stanicu.'
                          : !controlledHandoff
                            ? `Provjereno ${summary.scannedCount} od ${availableTraceCount}. Skeniraj preostale etikete ako su dostupne.`
                            : summary.expectedCount === 0
                              ? 'Za ovu predaju nema uroda u manifestu.'
                              : fullyScanned
                                ? 'Svi urodi provjereni su QR kodom za ovu predaju.'
                                : fullyReviewed
                                  ? 'Svi urodi imaju zabilježen ishod provjere.'
                                  : `Provjereno ${summary.scannedCount} od ${summary.expectedCount}. Preostalo ${summary.unverifiedCount} bez zabilježene provjere.`}
                </Alert>
            )}

            {controlledHandoff && handoff && !verificationLoading ? (
                <fieldset
                    className="flex flex-wrap gap-2"
                    aria-label="Sažetak provjere predaje"
                >
                    <Chip color="neutral" size="sm">
                        {summary.expectedCount} ukupno
                    </Chip>
                    <Chip color="success" size="sm">
                        {summary.scannedCount} provjereno
                    </Chip>
                    <Chip color="warning" size="sm">
                        {summary.noLabelCount} bez etikete
                    </Chip>
                    <Chip color="error" size="sm">
                        {summary.missingCount} nedostaje
                    </Chip>
                    <Chip color="warning" size="sm">
                        {summary.skippedCount} preskočeno
                    </Chip>
                    {summary.pendingCount > 0 ? (
                        <Chip color="info" size="sm">
                            {summary.pendingCount} čeka potvrdu
                        </Chip>
                    ) : null}
                </fieldset>
            ) : null}

            {handoff?.syncState === 'offline' ? (
                <Alert
                    color="warning"
                    startDecorator={<Warning className="size-5" />}
                >
                    Nema internetske veze. Zabilježene promjene ostaju vidljive
                    i čekaju slanje nakon povratka veze.
                </Alert>
            ) : handoff?.syncState === 'failed' ? (
                <Alert
                    color="warning"
                    startDecorator={<Warning className="size-5" />}
                >
                    {handoff.error ??
                        'Neke provjere još nisu potvrđene na poslužitelju.'}{' '}
                    To ne blokira potvrdu dostave.
                </Alert>
            ) : handoff?.syncState === 'syncing' || summary.pendingCount > 0 ? (
                <Alert
                    color="info"
                    startDecorator={<Info className="size-5" />}
                >
                    {summary.pendingCount > 0
                        ? `${summary.pendingCount} ${summary.pendingCount === 1 ? 'promjena čeka' : 'promjene čekaju'} potvrdu poslužitelja.`
                        : 'Provjere se usklađuju s poslužiteljem.'}
                </Alert>
            ) : null}

            {controlledHandoff && feedback.length > 0 ? (
                <Alert
                    color="warning"
                    role="status"
                    aria-live="polite"
                    aria-label="Povratne informacije provjere predaje"
                    startDecorator={<Warning className="size-5" />}
                >
                    <ul className="space-y-1">
                        {feedback.slice(-3).map((item) => (
                            <li key={item.operationId}>{item.message}</li>
                        ))}
                    </ul>
                </Alert>
            ) : null}

            {availableTraceCount > 0 ? (
                <HarvestTraceScanner
                    variant="verification"
                    availableTraceCount={availableTraceCount}
                    completedTraceCount={completedTraceCount}
                    disabled={verificationDisabled}
                    onScan={verifyTrace}
                />
            ) : null}

            {!verificationLoading ? (
                <ul
                    className={
                        compact && !controlledHandoff ? 'sr-only' : 'space-y-2'
                    }
                    aria-label="Urodi na ovoj stanici"
                >
                    {items.map((item) => (
                        <DeliveryHandoffVerificationItem
                            key={item.stopId}
                            compact={compact}
                            delivery={matchingDelivery(deliveries, item)}
                            disabled={disabled}
                            item={item}
                            pendingAction={pendingAction}
                            onMarkItem={
                                controlledHandoff ? onMarkItem : undefined
                            }
                            onRunAction={runItemAction}
                        />
                    ))}
                </ul>
            ) : null}

            {controlledHandoff &&
            !verificationLoading &&
            summary.unverifiedCount > 0 &&
            onMarkRemainingReviewed ? (
                <div className="space-y-1 rounded-md border border-dashed p-3">
                    <Button
                        type="button"
                        size="sm"
                        variant="outlined"
                        loading={pendingAction === 'manual-review'}
                        disabled={disabled || Boolean(pendingAction)}
                        onClick={() =>
                            void runItemAction(
                                'manual-review',
                                onMarkRemainingReviewed,
                            )
                        }
                    >
                        Označi preostalo kao ručno provjereno
                    </Button>
                    <Typography level="body3" className="text-muted-foreground">
                        Zabilježit će se ručna provjera svih preostalih uroda.
                        Dostavu možeš potvrditi i bez toga.
                    </Typography>
                </div>
            ) : null}

            {actionError ? (
                <Alert
                    color="warning"
                    role="alert"
                    aria-live="assertive"
                    startDecorator={<Warning className="size-5" />}
                >
                    {actionError}
                </Alert>
            ) : null}

            <Typography level="body3" className="text-muted-foreground">
                {compact
                    ? 'Provjera nije obavezna i ne blokira potvrdu dostave.'
                    : 'Ova provjera nije obavezna. Dostavu možeš potvrditi i ako etiketa nedostaje ili skeniranje nije moguće.'}
            </Typography>

            {completionConfirmation ? (
                <DeliveryHandoffCompletionDialog
                    confirmation={completionConfirmation}
                    deliveries={deliveries}
                    handoffSyncState={
                        controlledHandoff
                            ? (handoff?.syncState ?? 'loading')
                            : 'ready'
                    }
                    items={items}
                    summary={summary}
                />
            ) : null}
        </section>
    );
}
