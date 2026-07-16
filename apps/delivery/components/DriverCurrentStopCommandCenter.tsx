'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    Calendar,
    MapPin,
    Mobile,
    MyLocation,
    Navigate,
    Reset,
    Timer,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import {
    type ComponentProps,
    type CSSProperties,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import {
    deliveryActionLocallyCompletesStop,
    deliveryActionPermanentFailureMessage,
} from '../lib/deliveryActionPresentation';
import type { DeliveryActionQueueEntry } from '../lib/deliveryActionQueue';
import {
    deliveryCurrentStopCommandDeliveries,
    deliveryCurrentStopContacts,
    deliveryCurrentStopCriticalNotes,
} from '../lib/deliveryCurrentStopPresentation';
import type {
    DeliveryPickupManifestSummary,
    DeliveryPickupStepSummary,
    DeliveryStopSummary,
} from '../lib/deliveryDashboardTypes';
import {
    actionableDeliveryExceptionItems,
    type DeliveryExceptionMutation,
    type DeliveryExceptionSubmitResult,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import type { PickupManifestScanResult } from '../lib/deliveryPickupScan';
import { isDriverCommandResult } from '../lib/driverCommandResult';
import { DeliveryExceptionSheet } from './DeliveryExceptionSheet';
import {
    type DeliveryHandoffFeedbackView,
    type DeliveryHandoffManifestView,
    type DeliveryHandoffMarkItemInput,
    DeliveryHarvestVerification,
} from './DeliveryHarvestVerification';
import type { PickupManifestSyncSummary } from './DeliveryPickupCard';
import { HarvestTraceScanner } from './HarvestTraceScanner';

export type DeliveryHandoffCommandController = {
    view: DeliveryHandoffManifestView | null;
    feedback: readonly DeliveryHandoffFeedbackView[];
    scan: NonNullable<
        ComponentProps<typeof DeliveryHarvestVerification>['onScan']
    >;
    markItem: (
        input: DeliveryHandoffMarkItemInput,
    ) => unknown | Promise<unknown>;
    markRemainingReviewed: () => unknown | Promise<unknown>;
};

type DeliveryCommandCenterProps = {
    kind: 'delivery';
    stop: DeliveryStopSummary;
    routeRevision: number;
    pendingAction?: 'retry' | 'arrive' | 'deliver' | 'exception' | null;
    syncEntry?: DeliveryActionQueueEntry | null;
    handoff?: DeliveryHandoffCommandController;
    verifiedTracePaths?: string[];
    routeSyncBlocked?: boolean;
    checkpointPending?: boolean;
    offline?: boolean;
    focusOnMount?: boolean;
    onRetry?: () => unknown | Promise<unknown>;
    onArrive?: () => unknown | Promise<unknown>;
    onDeliver?: (notes?: string) => unknown | Promise<unknown>;
    onException?: (
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
    onVerificationScan?: (tracePath: string) => unknown | Promise<unknown>;
    onRetrySync?: (operationId: string) => unknown | Promise<unknown>;
    onDiscardSync?: (operationId: string) => unknown | Promise<unknown>;
    onReconcileSync?: () => unknown | Promise<unknown>;
};

type PickupCommandCenterProps = {
    kind: 'pickup';
    pickup: DeliveryPickupStepSummary;
    sync: PickupManifestSyncSummary;
    pendingAction: string | null;
    offline?: boolean;
    routeSyncBlocked?: boolean;
    checkpointPending?: boolean;
    focusOnMount?: boolean;
    onScan?: (
        value: string,
    ) => PickupManifestScanResult | Promise<PickupManifestScanResult>;
    onSetItemState?: (
        pickupNodeId: string,
        manifestId: string,
        stopId: number,
        state: 'missing-label' | 'not-ready' | 'ready',
    ) => unknown | Promise<unknown>;
    onResolveRemaining?: (
        pickupNodeId: string,
        manifest: DeliveryPickupManifestSummary,
    ) => unknown | Promise<unknown>;
    onConfirmManifest?: (
        pickupNodeId: string,
        manifestId: string,
    ) => unknown | Promise<unknown>;
    onRetrySync?: (operationId: string) => unknown | Promise<unknown>;
    onDiscardSync?: (operationId: string) => unknown | Promise<unknown>;
};

export type DriverCurrentStopCommandCenterProps =
    | DeliveryCommandCenterProps
    | PickupCommandCenterProps;

const stickyHeadingStyle: CSSProperties = {
    position: 'sticky',
    top: 'calc(env(safe-area-inset-top) + 4rem)',
    scrollMarginTop: 'calc(env(safe-area-inset-top) + 4rem)',
};
function focusCurrentHeading(heading: HTMLElement | null) {
    if (!heading) return;
    heading.scrollIntoView({ block: 'start' });
    heading.focus({ preventScroll: true });
}

function useElementHeight<Element extends HTMLElement>(
    ref: { current: Element | null },
    fallback: number,
) {
    const [height, setHeight] = useState(fallback);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const updateHeight = () =>
            setHeight(Math.ceil(element.getBoundingClientRect().height));
        updateHeight();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(updateHeight);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return height;
}

function useCommandStatusVisibility(identity: string | null) {
    const statusRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!identity) return;
        statusRef.current?.scrollIntoView({ block: 'nearest' });
    }, [identity]);
    return statusRef;
}

function commandErrorMessage(error: unknown) {
    return error instanceof Error
        ? error.message
        : 'Radnju nije moguće sigurno spremiti. Pokušaj ponovno.';
}

function syncEntryMessage(entry: DeliveryActionQueueEntry) {
    if (entry.state === 'conflicted') {
        return deliveryActionPermanentFailureMessage(entry.errorCode, 'stop');
    }
    if (entry.state === 'failed') {
        return 'Radnja je spremljena na uređaju, ali slanje nije uspjelo.';
    }
    if (entry.state === 'reconciling') {
        return 'Problem je potvrđen, ali novi plan rute još nije učitan.';
    }
    if (entry.state === 'sending') {
        return 'Radnja se šalje i još nije potvrđena.';
    }
    if (entry.state === 'synced') {
        return 'Poslužitelj je potvrdio radnju. Čeka se osvježeno stanje rute.';
    }
    return 'Radnja je spremljena na uređaju i čeka potvrdu.';
}

function syncCommandLabel(entry: DeliveryActionQueueEntry) {
    switch (entry.command.kind) {
        case 'arrive':
            return 'Dolazak';
        case 'deliver':
            return 'Dostava';
        case 'exception':
            return 'Prijava problema';
        case 'verification-scan':
            return 'QR provjera';
    }
}

function DeliveryCurrentStopCommandCenter({
    stop,
    routeRevision,
    pendingAction = null,
    syncEntry,
    handoff,
    verifiedTracePaths = [],
    routeSyncBlocked = false,
    checkpointPending = false,
    offline = false,
    focusOnMount = false,
    onRetry,
    onArrive,
    onDeliver,
    onException,
    onVerificationScan,
    onRetrySync,
    onDiscardSync,
    onReconcileSync,
}: DeliveryCommandCenterProps) {
    const headingId = useId();
    const syncStatusId = useId();
    const headingRef = useRef<HTMLElement>(null);
    const actionRef = useRef<HTMLFieldSetElement>(null);
    const [notes, setNotes] = useState('');
    const [localPendingAction, setLocalPendingAction] = useState<
        'retry' | 'arrive' | 'deliver' | null
    >(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [deliveryConfirmationOpen, setDeliveryConfirmationOpen] =
        useState(false);
    const [syncRecoveryPending, setSyncRecoveryPending] = useState(false);
    const stickyHeadingHeight = useElementHeight(headingRef, 96);
    const stickyActionHeight = useElementHeight(actionRef, 48);
    const commandStatusRef = useCommandStatusVisibility(
        localError
            ? `local:${localError}`
            : syncEntry?.state === 'failed' || syncEntry?.state === 'conflicted'
              ? `${syncEntry.command.operationId}:${syncEntry.state}`
              : null,
    );
    const stickyActionStyle: CSSProperties = {
        position: 'sticky',
        top: `calc(env(safe-area-inset-top) + 4rem + ${stickyHeadingHeight + 8}px)`,
    };
    const textareaScrollStyle: CSSProperties = {
        scrollMarginTop: `calc(env(safe-area-inset-top) + 4rem + ${stickyHeadingHeight + stickyActionHeight + 24}px)`,
    };
    const commandDeliveries = deliveryCurrentStopCommandDeliveries(stop);
    const actionableDeliveries =
        actionableDeliveryExceptionItems(commandDeliveries);
    const commandStop = { ...stop, deliveries: commandDeliveries };
    const primaryCommandDelivery = commandDeliveries[0];
    const recipientNames = Array.from(
        new Set(
            commandDeliveries
                .map((delivery) => delivery.contactName.trim())
                .filter(Boolean),
        ),
    );
    const contacts = deliveryCurrentStopContacts(commandStop);
    const criticalNotes = deliveryCurrentStopCriticalNotes(commandStop);
    const groupedDelivery = commandDeliveries.length > 1;
    const acknowledgedArrival =
        syncEntry?.command.kind === 'arrive' && syncEntry.state === 'synced';
    const pendingArrival =
        syncEntry?.command.kind === 'arrive' &&
        syncEntry.state !== 'conflicted' &&
        syncEntry.state !== 'synced';
    const deliveryQueued = deliveryActionLocallyCompletesStop(
        syncEntry ?? undefined,
    );
    const offlineConflict = syncEntry?.state === 'conflicted';
    const pendingCompletion =
        syncEntry?.command.kind === 'deliver' ||
        syncEntry?.command.kind === 'exception';
    const routeCommandBlocked =
        routeSyncBlocked ||
        checkpointPending ||
        Boolean(pendingCompletion) ||
        offlineConflict;
    const arrived =
        stop.stopState === 'arrived' || pendingArrival || acknowledgedArrival;
    const deferred = stop.stopState === 'deferred';
    const estimatedOutsideWindow = Boolean(
        stop.estimatedArrivalAt &&
            stop.slotEndAt &&
            new Date(stop.estimatedArrivalAt) > new Date(stop.slotEndAt),
    );
    const effectivePendingAction = localPendingAction ?? pendingAction;
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
    const runCommand = async (
        kind: 'retry' | 'arrive' | 'deliver',
        action: (() => unknown | Promise<unknown>) | undefined,
    ) => {
        if (!action || localPendingAction) return;
        setLocalError(null);
        setLocalPendingAction(kind);
        try {
            const result = await action();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setLocalError(result.message);
            }
            return result;
        } catch (error) {
            const message = commandErrorMessage(error);
            setLocalError(message);
            return { status: 'failed' as const, message };
        } finally {
            setLocalPendingAction(null);
        }
    };
    const runSyncRecovery = async (
        action: (() => unknown | Promise<unknown>) | undefined,
    ) => {
        if (!action || syncRecoveryPending) return;
        setLocalError(null);
        setSyncRecoveryPending(true);
        try {
            const result = await action();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setLocalError(result.message);
            }
        } catch (error) {
            setLocalError(commandErrorMessage(error));
        } finally {
            setSyncRecoveryPending(false);
        }
    };

    useEffect(() => {
        if (!focusOnMount) return;
        focusCurrentHeading(headingRef.current);
    }, [focusOnMount]);

    const commandStatus =
        localError || syncEntry ? (
            <div
                ref={commandStatusRef}
                className="space-y-2"
                data-testid="current-command-status"
            >
                {syncEntry ? (
                    <Alert
                        id={syncStatusId}
                        aria-label={`Status radnje: ${syncCommandLabel(syncEntry)}`}
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
                                {syncCommandLabel(syncEntry)}:{' '}
                                {syncEntryMessage(syncEntry)}
                            </Typography>
                            {syncEntry.state === 'failed' ? (
                                <Button
                                    size="sm"
                                    color="warning"
                                    loading={syncRecoveryPending}
                                    disabled={
                                        syncRecoveryPending || !onRetrySync
                                    }
                                    onClick={() =>
                                        void runSyncRecovery(
                                            onRetrySync
                                                ? () =>
                                                      onRetrySync(
                                                          syncEntry.command
                                                              .operationId,
                                                      )
                                                : undefined,
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
                                    disabled={
                                        syncRecoveryPending || !onDiscardSync
                                    }
                                    onClick={() =>
                                        void runSyncRecovery(
                                            onDiscardSync
                                                ? () =>
                                                      onDiscardSync(
                                                          syncEntry.command
                                                              .operationId,
                                                      )
                                                : undefined,
                                        )
                                    }
                                >
                                    Učitaj stanje poslužitelja
                                </Button>
                            ) : null}
                            {syncEntry.state === 'reconciling' ||
                            syncEntry.acknowledgement?.reroutePending ||
                            syncEntry.acknowledgement?.runCompleted ? (
                                <Button
                                    size="sm"
                                    color="warning"
                                    variant="outlined"
                                    loading={syncRecoveryPending}
                                    disabled={
                                        syncRecoveryPending || !onReconcileSync
                                    }
                                    onClick={() =>
                                        void runSyncRecovery(onReconcileSync)
                                    }
                                >
                                    Osvježi novi plan
                                </Button>
                            ) : null}
                        </div>
                    </Alert>
                ) : null}
                {localError ? (
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {localError}
                    </Alert>
                ) : null}
            </div>
        ) : null;

    const navigationActions = (
        <div className="grid min-w-0 grid-cols-2 gap-2 max-[340px]:grid-cols-1">
            {routeSyncBlocked || stop.reroutePending || deferred ? (
                <Button
                    aria-label={
                        offline
                            ? 'Navigacija do trenutačne stanice čeka novi plan'
                            : 'Navigacija čeka novi plan'
                    }
                    className="min-w-0"
                    disabled
                    variant="outlined"
                    startDecorator={<Navigate className="size-4" />}
                >
                    Navigacija čeka novi plan
                </Button>
            ) : (
                <Button
                    aria-label="Navigacija do trenutačne stanice"
                    className="min-w-0"
                    href={navigationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    startDecorator={<Navigate className="size-4" />}
                >
                    Navigacija
                </Button>
            )}
            {contacts.map((contact) => (
                <Button
                    key={contact.phone}
                    aria-label={`Nazovi ${contact.label}`}
                    className="min-w-0"
                    href={`tel:${contact.phone}`}
                    variant="outlined"
                    startDecorator={<Mobile className="size-4" />}
                >
                    Nazovi {contact.label}
                </Button>
            ))}
        </div>
    );
    const secondaryStopDetails =
        (stop.slotStartAt && stop.slotEndAt) ||
        (groupedDelivery && recipientNames.length) ? (
            <div className="space-y-1 text-sm">
                {stop.slotStartAt && stop.slotEndAt ? (
                    <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                            {formatDeliveryDateTime(stop.slotStartAt)} –{' '}
                            {formatDeliveryTime(stop.slotEndAt)}
                        </span>
                    </div>
                ) : null}
                {groupedDelivery && recipientNames.length ? (
                    <div className="flex items-start gap-2">
                        <Mobile className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>Primatelji: {recipientNames.join(', ')}</span>
                    </div>
                ) : null}
            </div>
        ) : null;

    return (
        <section
            aria-labelledby={headingId}
            className="relative -mx-2 min-w-0 space-y-2.5 rounded-xl border border-primary/30 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:mx-0 sm:space-y-3 sm:p-4"
        >
            <section
                aria-label="Sažetak trenutačne stanice"
                className="z-10 -mx-3 -mt-3 flex min-w-0 items-start justify-between gap-2 rounded-t-xl border-b bg-background/95 p-3 outline-none backdrop-blur sm:-mx-4 sm:-mt-4 sm:p-4"
                style={stickyHeadingStyle}
                ref={headingRef}
                tabIndex={-1}
            >
                <div className="min-w-0 space-y-0.5">
                    <Typography level="body3" className="text-primary">
                        {offline
                            ? 'Trenutačna stanica · offline'
                            : 'Trenutačna stanica'}
                    </Typography>
                    <Typography
                        id={headingId}
                        level="h3"
                        component="h2"
                        semiBold
                    >
                        {groupedDelivery
                            ? `${commandDeliveries.length} ${commandDeliveries.length === 1 ? 'urod' : 'uroda'} · skupna dostava`
                            : (primaryCommandDelivery?.contactName ??
                              stop.contactName)}
                    </Typography>
                    <Typography
                        level="body3"
                        className="truncate text-muted-foreground"
                        title={stop.address}
                    >
                        {stop.address}
                    </Typography>
                </div>
                <Chip color={arrived ? 'info' : 'warning'} size="sm">
                    {arrived ? 'Na lokaciji' : 'Na redu'}
                </Chip>
            </section>
            <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-label="Promjena trenutačne stanice"
            >
                {focusOnMount
                    ? `Trenutačna stanica je ${groupedDelivery ? stop.address : (primaryCommandDelivery?.contactName ?? stop.contactName)}.`
                    : ''}
            </span>

            {deferred ? (
                <fieldset
                    aria-label="Radnje trenutačne stanice"
                    className="m-0 min-w-0 space-y-2 border-0 p-0"
                >
                    <Button
                        className="w-full"
                        color="warning"
                        loading={effectivePendingAction === 'retry'}
                        disabled={
                            Boolean(effectivePendingAction) ||
                            routeSyncBlocked ||
                            !onRetry
                        }
                        onClick={() => void runCommand('retry', onRetry)}
                        startDecorator={<Reset className="size-4" />}
                    >
                        {onRetry
                            ? checkpointPending
                                ? 'Ponovni pokušaj čeka potvrdu rute'
                                : 'Pokreni ponovni pokušaj'
                            : checkpointPending
                              ? 'Ponovni pokušaj čeka potvrdu rute'
                              : 'Ponovni pokušaj nakon povratka veze'}
                    </Button>
                    {commandStatus}
                </fieldset>
            ) : (
                <fieldset
                    ref={actionRef}
                    aria-label="Radnje trenutačne stanice"
                    className="z-10 -mx-2 min-w-0 space-y-2 border-x-0 border-y bg-background/95 px-2 py-1.5 backdrop-blur sm:mx-0 sm:p-2"
                    style={stickyActionStyle}
                >
                    <div className="grid min-w-0 grid-cols-2 gap-2">
                        {stop.runId && onException ? (
                            <DeliveryExceptionSheet
                                runId={stop.runId}
                                routeRevision={routeRevision}
                                stop={stop}
                                disabled={
                                    Boolean(effectivePendingAction) ||
                                    routeCommandBlocked
                                }
                                onSubmit={onException}
                            />
                        ) : null}
                        {arrived && (pendingArrival || acknowledgedArrival) ? (
                            <Button
                                variant="outlined"
                                disabled
                                aria-describedby={
                                    syncEntry?.command.kind === 'arrive'
                                        ? syncStatusId
                                        : undefined
                                }
                                startDecorator={
                                    <MyLocation className="size-4" />
                                }
                            >
                                {pendingArrival
                                    ? 'Dolazak čeka potvrdu'
                                    : 'Dolazak potvrđen'}
                            </Button>
                        ) : null}
                        {arrived ? (
                            <Button
                                className={
                                    pendingArrival || acknowledgedArrival
                                        ? 'col-span-2'
                                        : undefined
                                }
                                color="success"
                                loading={effectivePendingAction === 'deliver'}
                                disabled={
                                    Boolean(effectivePendingAction) ||
                                    routeCommandBlocked ||
                                    deliveryQueued ||
                                    actionableDeliveries.length === 0 ||
                                    !onDeliver
                                }
                                aria-describedby={
                                    syncEntry?.command.kind === 'deliver'
                                        ? syncStatusId
                                        : undefined
                                }
                                onClick={() =>
                                    !handoff
                                        ? void runCommand('deliver', () =>
                                              onDeliver?.(notes || undefined),
                                          )
                                        : setDeliveryConfirmationOpen(true)
                                }
                                startDecorator={<Approved className="size-4" />}
                            >
                                {syncEntry?.command.kind === 'deliver'
                                    ? syncEntry.state === 'synced'
                                        ? 'Dostava potvrđena'
                                        : 'Dostava čeka potvrdu'
                                    : groupedDelivery
                                      ? `Dostavi ${actionableDeliveries.length} · dalje`
                                      : 'Dostavljeno · dalje'}
                            </Button>
                        ) : (
                            <Button
                                variant="outlined"
                                loading={effectivePendingAction === 'arrive'}
                                disabled={
                                    Boolean(effectivePendingAction) ||
                                    routeCommandBlocked ||
                                    !onArrive
                                }
                                aria-describedby={
                                    syncEntry?.command.kind === 'arrive'
                                        ? syncStatusId
                                        : undefined
                                }
                                onClick={() =>
                                    void runCommand('arrive', onArrive)
                                }
                                startDecorator={
                                    <MyLocation className="size-4" />
                                }
                            >
                                {pendingArrival
                                    ? 'Dolazak čeka potvrdu'
                                    : 'Stigao sam'}
                            </Button>
                        )}
                    </div>
                    {commandStatus}
                </fieldset>
            )}

            <section
                aria-label="Procjene trenutačne stanice"
                className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-2 text-center sm:gap-2 sm:p-3"
            >
                <div className="min-w-0">
                    <Typography level="body3" className="text-muted-foreground">
                        Dolazak
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatDeliveryTime(stop.estimatedArrivalAt)}
                    </Typography>
                </div>
                <div className="min-w-0 border-x px-1">
                    <Typography level="body3" className="text-muted-foreground">
                        Vožnja
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatTravelDuration(stop.estimatedTravelSeconds)}
                    </Typography>
                </div>
                <div className="min-w-0">
                    <Typography level="body3" className="text-muted-foreground">
                        Udaljenost
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatDistance(stop.estimatedDistanceMeters)}
                    </Typography>
                </div>
            </section>

            {estimatedOutsideWindow && !stop.deliveredAt ? (
                <Alert
                    color="warning"
                    startDecorator={<Warning className="size-5" />}
                >
                    Trenutačna procjena dolaska je nakon završetka termina.
                    Obavijesti korisnika o kašnjenju.
                </Alert>
            ) : null}

            {criticalNotes.length ? (
                <section
                    aria-label="Važne napomene za trenutačnu stanicu"
                    className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
                >
                    {criticalNotes.map((note) => (
                        <p key={note.id} className="text-sm">
                            <strong>
                                {note.label}
                                {note.context ? ` · ${note.context}` : ''}:
                            </strong>{' '}
                            {note.text}
                        </p>
                    ))}
                </section>
            ) : null}

            {deferred ? (
                <>
                    {secondaryStopDetails}
                    {navigationActions}
                </>
            ) : (
                <>
                    {arrived ? (
                        <DeliveryHarvestVerification
                            compact
                            deliveries={actionableDeliveries}
                            disabled={
                                Boolean(effectivePendingAction) ||
                                routeCommandBlocked
                            }
                            handoff={handoff?.view}
                            feedback={handoff?.feedback}
                            onScan={handoff?.scan}
                            onMarkItem={handoff?.markItem}
                            onMarkRemainingReviewed={
                                handoff?.markRemainingReviewed
                            }
                            completionConfirmation={
                                !handoff
                                    ? undefined
                                    : {
                                          open: deliveryConfirmationOpen,
                                          pending:
                                              effectivePendingAction ===
                                              'deliver',
                                          disabled:
                                              routeCommandBlocked ||
                                              deliveryQueued ||
                                              actionableDeliveries.length ===
                                                  0 ||
                                              !onDeliver,
                                          onOpenChange:
                                              setDeliveryConfirmationOpen,
                                          onConfirm: () =>
                                              runCommand('deliver', () =>
                                                  onDeliver?.(
                                                      notes || undefined,
                                                  ),
                                              ),
                                      }
                            }
                            verifiedTracePaths={verifiedTracePaths}
                            onVerifiedTrace={onVerificationScan}
                        />
                    ) : (
                        <Typography
                            level="body3"
                            className="rounded-md bg-muted/70 p-2 text-muted-foreground"
                        >
                            QR provjera otključat će se nakon potvrde dolaska.
                        </Typography>
                    )}

                    {secondaryStopDetails}
                    {navigationActions}

                    <label className="block min-w-0 text-sm font-medium">
                        Napomena o predaji
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={1}
                            maxLength={1_000}
                            placeholder="Npr. predano članu kućanstva"
                            disabled={routeCommandBlocked}
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                            style={textareaScrollStyle}
                        />
                    </label>
                </>
            )}
        </section>
    );
}

function pickupSyncMessage(sync: PickupManifestSyncSummary) {
    if (sync.state === 'conflicted') {
        return (
            sync.message ?? 'Stanje preuzimanja promijenilo se na poslužitelju.'
        );
    }
    if (sync.state === 'failed') {
        return (
            sync.message ??
            'Preuzimanje je spremljeno, ali slanje nije uspjelo.'
        );
    }
    if (sync.state === 'sending')
        return sync.message ?? 'Promjene preuzimanja se šalju.';
    if (sync.state === 'queued')
        return sync.message ?? 'Preuzimanje čeka potvrdu poslužitelja.';
    return null;
}

function PickupCurrentStopCommandCenter({
    pickup,
    sync,
    pendingAction,
    offline = false,
    routeSyncBlocked = false,
    checkpointPending = false,
    focusOnMount = false,
    onScan,
    onSetItemState,
    onResolveRemaining,
    onConfirmManifest,
    onRetrySync,
    onDiscardSync,
}: PickupCommandCenterProps) {
    const headingId = useId();
    const headingRef = useRef<HTMLElement>(null);
    const [recoveryPending, setRecoveryPending] = useState(false);
    const [localPendingAction, setLocalPendingAction] = useState<string | null>(
        null,
    );
    const [localError, setLocalError] = useState<string | null>(null);
    const stickyHeadingHeight = useElementHeight(headingRef, 96);
    const commandStatusRef = useCommandStatusVisibility(
        localError
            ? `local:${localError}`
            : sync.state === 'failed' || sync.state === 'conflicted'
              ? `${sync.blockingOperationId ?? 'pickup'}:${sync.state}`
              : null,
    );
    const collectedCount = pickup.scannedCount + pickup.missingLabelCount;
    const scannableTraceCount = new Set(
        pickup.manifests.flatMap((manifest) =>
            manifest.items.flatMap((item) =>
                item.tracePath ? [item.tracePath] : [],
            ),
        ),
    ).size;
    const syncMessage = pickupSyncMessage(sync);
    const currentManifest = pickup.manifests.find(
        (manifest) => manifest.state === 'pending',
    );
    const unresolvedReady =
        currentManifest?.items.filter((item) => item.state === 'ready') ?? [];
    const manuallyResolvableItems =
        currentManifest?.items.filter(
            (item) => item.state === 'ready' || item.state === 'not-ready',
        ) ?? [];
    const manifestConfirmable = Boolean(
        currentManifest &&
            currentManifest.remainingCount === 0 &&
            currentManifest.notReadyCount === 0,
    );
    const effectivePendingAction = localPendingAction ?? pendingAction;
    const mutationsDisabled =
        Boolean(effectivePendingAction) ||
        sync.state === 'conflicted' ||
        sync.blocksCurrentPickup === true ||
        offline ||
        routeSyncBlocked ||
        checkpointPending;
    const runPickupCommand = async (
        key: string,
        action: (() => unknown | Promise<unknown>) | undefined,
    ) => {
        if (!action || effectivePendingAction) return;
        setLocalError(null);
        setLocalPendingAction(key);
        try {
            const result = await action();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setLocalError(result.message);
            }
        } catch (error) {
            setLocalError(commandErrorMessage(error));
        } finally {
            setLocalPendingAction(null);
        }
    };
    const runRecovery = async (
        action: (() => unknown | Promise<unknown>) | undefined,
    ) => {
        if (!action || recoveryPending) return;
        setLocalError(null);
        setRecoveryPending(true);
        try {
            const result = await action();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setLocalError(result.message);
            }
        } catch (error) {
            setLocalError(commandErrorMessage(error));
        } finally {
            setRecoveryPending(false);
        }
    };

    useEffect(() => {
        if (!focusOnMount) return;
        focusCurrentHeading(headingRef.current);
    }, [focusOnMount]);

    const commandStatus =
        localError || syncMessage ? (
            <div
                ref={commandStatusRef}
                className="space-y-2"
                data-testid="current-command-status"
                style={{
                    scrollMarginTop: `calc(env(safe-area-inset-top) + 4rem + ${stickyHeadingHeight + 8}px)`,
                }}
            >
                {syncMessage ? (
                    <Alert
                        aria-label="Status radnje: preuzimanje"
                        color={
                            sync.state === 'conflicted'
                                ? 'danger'
                                : sync.state === 'failed'
                                  ? 'warning'
                                  : 'info'
                        }
                        startDecorator={<Reset className="size-5" />}
                    >
                        <div className="space-y-2">
                            <Typography level="body3" semiBold>
                                Preuzimanje: {syncMessage}
                            </Typography>
                            {sync.blockingOperationId ? (
                                <div className="flex flex-wrap gap-2">
                                    {sync.state === 'failed' ? (
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            loading={recoveryPending}
                                            disabled={
                                                recoveryPending || !onRetrySync
                                            }
                                            onClick={() =>
                                                void runRecovery(
                                                    onRetrySync
                                                        ? () =>
                                                              onRetrySync(
                                                                  sync.blockingOperationId ??
                                                                      '',
                                                              )
                                                        : undefined,
                                                )
                                            }
                                        >
                                            Pokušaj ponovno
                                        </Button>
                                    ) : null}
                                    {sync.state === 'conflicted' ? (
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            loading={recoveryPending}
                                            disabled={
                                                recoveryPending ||
                                                !onDiscardSync
                                            }
                                            onClick={() =>
                                                void runRecovery(
                                                    onDiscardSync
                                                        ? () =>
                                                              onDiscardSync(
                                                                  sync.blockingOperationId ??
                                                                      '',
                                                              )
                                                        : undefined,
                                                )
                                            }
                                        >
                                            Odbaci promjenu i osvježi
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </Alert>
                ) : null}
                {localError ? (
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {localError}
                    </Alert>
                ) : null}
            </div>
        ) : null;

    return (
        <section
            aria-labelledby={headingId}
            className="relative -mx-2 min-w-0 space-y-3 rounded-xl border border-amber-400/60 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:mx-0 sm:p-4"
        >
            <section
                aria-label="Sažetak trenutačne stanice"
                className="z-10 -mx-3 -mt-3 flex min-w-0 items-start justify-between gap-2 rounded-t-xl border-b bg-background/95 p-3 outline-none backdrop-blur sm:-mx-4 sm:-mt-4 sm:p-4"
                style={stickyHeadingStyle}
                ref={headingRef}
                tabIndex={-1}
            >
                <div className="min-w-0">
                    <Typography
                        level="body3"
                        className="text-amber-700 dark:text-amber-300"
                    >
                        {offline
                            ? 'Trenutačno preuzimanje · offline'
                            : 'Trenutačno preuzimanje'}
                    </Typography>
                    <Typography
                        id={headingId}
                        level="h3"
                        component="h2"
                        semiBold
                    >
                        {pickup.name}
                    </Typography>
                </div>
                <Chip color="warning" size="sm">
                    {collectedCount}/{pickup.expectedCount}
                </Chip>
            </section>
            <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-label="Promjena trenutačne stanice"
            >
                {focusOnMount
                    ? currentManifest
                        ? `Trenutačno preuzimanje je ${pickup.name} za termin ${formatDeliveryDateTime(currentManifest.startAt)}.`
                        : `Trenutačno preuzimanje je ${pickup.name}.`
                    : ''}
            </span>

            {commandStatus}

            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-2 text-center sm:gap-2 sm:p-3">
                <div className="min-w-0">
                    <Typography level="body3" className="text-muted-foreground">
                        Dolazak
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatDeliveryTime(pickup.estimatedArrivalAt)}
                    </Typography>
                </div>
                <div className="min-w-0 border-x px-1">
                    <Typography level="body3" className="text-muted-foreground">
                        Vožnja
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatTravelDuration(pickup.estimatedTravelSeconds)}
                    </Typography>
                </div>
                <div className="min-w-0">
                    <Typography level="body3" className="text-muted-foreground">
                        Udaljenost
                    </Typography>
                    <Typography level="body2" semiBold className="truncate">
                        {formatDistance(pickup.estimatedDistanceMeters)}
                    </Typography>
                </div>
            </div>

            <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{pickup.address}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-[340px]:grid-cols-1">
                {routeSyncBlocked ? (
                    <Button
                        aria-label="Navigacija do trenutačne stanice preuzimanja čeka novi plan"
                        disabled
                        variant="outlined"
                        startDecorator={<Navigate className="size-4" />}
                    >
                        Navigacija čeka novi plan
                    </Button>
                ) : (
                    <Button
                        aria-label="Navigacija do trenutačne stanice preuzimanja"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outlined"
                        startDecorator={<Navigate className="size-4" />}
                    >
                        Navigacija
                    </Button>
                )}
                {!offline && scannableTraceCount > 0 && onScan ? (
                    <HarvestTraceScanner
                        variant="manifest"
                        availableTraceCount={pickup.expectedCount}
                        completedTraceCount={collectedCount}
                        disabled={mutationsDisabled}
                        onScan={onScan}
                    />
                ) : (
                    <Button
                        disabled
                        startDecorator={<Timer className="size-4" />}
                    >
                        Skeniranje nije dostupno
                    </Button>
                )}
            </div>

            {checkpointPending && !offline ? (
                <Alert color="warning">
                    Prethodna radnja još čeka potvrdu rute. Preuzimanje će se
                    otključati čim poslužitelj potvrdi ovu lokaciju.
                </Alert>
            ) : null}

            {routeSyncBlocked && !checkpointPending && !offline ? (
                <Alert color="warning">
                    Novi plan rute još nije potvrđen. Preuzimanje ostaje
                    zaključano do sigurnog osvježavanja.
                </Alert>
            ) : null}

            {!offline && currentManifest ? (
                <section
                    className="space-y-3 rounded-lg border p-3"
                    aria-label={`Trenutačni manifest ${formatDeliveryDateTime(currentManifest.startAt)}`}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <Typography level="body2" semiBold>
                                Sljedeća radnja preuzimanja
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {formatDeliveryDateTime(
                                    currentManifest.startAt,
                                )}{' '}
                                – {formatDeliveryTime(currentManifest.endAt)}
                            </Typography>
                        </div>
                        <Chip size="sm">
                            {currentManifest.scannedCount +
                                currentManifest.missingLabelCount}
                            /{currentManifest.expectedCount}
                        </Chip>
                    </div>

                    {manuallyResolvableItems.length ? (
                        <ul
                            className="space-y-2"
                            aria-label="Urodi koji čekaju preuzimanje"
                        >
                            {manuallyResolvableItems.map((item) => (
                                <li
                                    key={item.id}
                                    className="space-y-2 rounded-md bg-muted/70 p-2"
                                >
                                    <Typography level="body3" semiBold>
                                        {item.harvest.plantName}
                                    </Typography>
                                    {item.state === 'ready' ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <Button
                                                size="sm"
                                                variant="outlined"
                                                loading={
                                                    effectivePendingAction ===
                                                    `missing:${item.stopId}`
                                                }
                                                disabled={
                                                    mutationsDisabled ||
                                                    !onSetItemState
                                                }
                                                onClick={() =>
                                                    void runPickupCommand(
                                                        `missing:${item.stopId}`,
                                                        () =>
                                                            onSetItemState?.(
                                                                pickup.id,
                                                                currentManifest.id,
                                                                item.stopId,
                                                                'missing-label',
                                                            ),
                                                    )
                                                }
                                            >
                                                Preuzeto bez QR etikete
                                            </Button>
                                            <Button
                                                size="sm"
                                                color="warning"
                                                variant="outlined"
                                                loading={
                                                    effectivePendingAction ===
                                                    `not-ready:${item.stopId}`
                                                }
                                                disabled={
                                                    mutationsDisabled ||
                                                    !onSetItemState
                                                }
                                                onClick={() =>
                                                    void runPickupCommand(
                                                        `not-ready:${item.stopId}`,
                                                        () =>
                                                            onSetItemState?.(
                                                                pickup.id,
                                                                currentManifest.id,
                                                                item.stopId,
                                                                'not-ready',
                                                            ),
                                                    )
                                                }
                                            >
                                                Nije spremno
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            loading={
                                                effectivePendingAction ===
                                                `ready:${item.stopId}`
                                            }
                                            disabled={
                                                mutationsDisabled ||
                                                !onSetItemState
                                            }
                                            onClick={() =>
                                                void runPickupCommand(
                                                    `ready:${item.stopId}`,
                                                    () =>
                                                        onSetItemState?.(
                                                            pickup.id,
                                                            currentManifest.id,
                                                            item.stopId,
                                                            'ready',
                                                        ),
                                                )
                                            }
                                        >
                                            Ponovno spremno
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {unresolvedReady.length > 1 ? (
                        <Button
                            variant="outlined"
                            loading={
                                effectivePendingAction === 'resolve-remaining'
                            }
                            disabled={mutationsDisabled || !onResolveRemaining}
                            onClick={() =>
                                void runPickupCommand('resolve-remaining', () =>
                                    onResolveRemaining?.(
                                        pickup.id,
                                        currentManifest,
                                    ),
                                )
                            }
                        >
                            Preuzmi preostalih {unresolvedReady.length} bez
                            etikete
                        </Button>
                    ) : null}

                    {currentManifest.notReadyCount > 0 ? (
                        <Alert color="warning">
                            Jedan ili više uroda nisu preuzeti. Njihove dostave
                            ostaju zaključane.
                        </Alert>
                    ) : null}

                    <Button
                        className="w-full"
                        color="success"
                        loading={effectivePendingAction === 'confirm-manifest'}
                        disabled={
                            !manifestConfirmable ||
                            mutationsDisabled ||
                            sync.pendingCount > 0 ||
                            !onConfirmManifest
                        }
                        onClick={() =>
                            void runPickupCommand('confirm-manifest', () =>
                                onConfirmManifest?.(
                                    pickup.id,
                                    currentManifest.id,
                                ),
                            )
                        }
                        startDecorator={<Approved className="size-4" />}
                    >
                        Potvrdi preuzimanje i nastavi
                    </Button>
                    {currentManifest.remainingCount > 0 ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prije potvrde skeniraj urode ili označi one bez QR
                            etikete.
                        </Typography>
                    ) : null}
                </section>
            ) : null}

            {offline ? (
                <Alert color="warning">
                    Skeniranje i potvrda preuzimanja nastavljaju se nakon
                    povratka veze.
                </Alert>
            ) : null}

            {sync.durability === 'memory' ? (
                <Alert color="warning">
                    Preglednik ne dopušta trajnu lokalnu pohranu. Ostani na ovoj
                    stranici dok se promjene ne sinkroniziraju.
                </Alert>
            ) : null}

            {sync.coordination === 'best-effort' ? (
                <Alert color="info">
                    Ovaj preglednik ne može sigurno uskladiti istodobni rad u
                    više kartica. Za ovu rutu koristi samo ovu karticu.
                </Alert>
            ) : null}
        </section>
    );
}

export function DriverCurrentStopCommandCenter(
    props: DriverCurrentStopCommandCenterProps,
) {
    return props.kind === 'delivery' ? (
        <DeliveryCurrentStopCommandCenter {...props} />
    ) : (
        <PickupCurrentStopCommandCenter {...props} />
    );
}
