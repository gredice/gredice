'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    Calendar,
    Check,
    Leaf,
    MapPin,
    Navigate,
    Reset,
    Timer,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import type {
    DeliveryPickupManifestItemState,
    DeliveryPickupManifestSummary,
    DeliveryPickupStepSummary,
} from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import {
    HarvestTraceScanner,
    type PickupManifestScanResult,
} from './HarvestTraceScanner';

export type PickupManifestSyncSummary = {
    state: 'idle' | 'queued' | 'sending' | 'failed' | 'conflicted';
    pendingCount: number;
    durability: 'durable' | 'memory';
    coordination: 'coordinated' | 'best-effort';
    blockingOperationId: string | null;
    message?: string | null;
};

function itemStateLabel(state: DeliveryPickupManifestItemState) {
    switch (state) {
        case 'scanned':
            return 'Skenirano';
        case 'missing-label':
            return 'Bez etikete';
        case 'not-ready':
            return 'Nije spremno';
        case 'ready':
            return 'Spremno';
    }
}

function itemStateColor(
    state: DeliveryPickupManifestItemState,
): 'success' | 'warning' | 'neutral' {
    if (state === 'scanned' || state === 'missing-label') return 'success';
    if (state === 'not-ready') return 'warning';
    return 'neutral';
}

function syncAlert(sync: PickupManifestSyncSummary) {
    switch (sync.state) {
        case 'queued':
            return {
                color: 'info' as const,
                message: `Spremljeno na uređaju · ${sync.pendingCount} ${sync.pendingCount === 1 ? 'promjena čeka' : 'promjene čekaju'} sinkronizaciju.`,
            };
        case 'sending':
            return {
                color: 'info' as const,
                message: `Sinkronizacija ${sync.pendingCount} ${sync.pendingCount === 1 ? 'promjene' : 'promjena'}…`,
            };
        case 'failed':
            return {
                color: 'warning' as const,
                message:
                    sync.message ??
                    'Promjena je spremljena na uređaju i pokušat će se ponovno poslati.',
            };
        case 'conflicted':
            return {
                color: 'danger' as const,
                message:
                    sync.message ??
                    'Stanje preuzimanja promijenilo se na poslužitelju. Osvježi popis i provjeri označene urode.',
            };
        case 'idle':
            return null;
    }
}

export function DeliveryPickupCard({
    pickup,
    actionState,
    pendingAction,
    sync,
    onScan,
    onSetItemState,
    onResolveRemaining,
    onConfirmManifest,
    onRetrySync,
    onDiscardSync,
}: {
    pickup: DeliveryPickupStepSummary;
    actionState: 'locked' | 'current' | 'completed';
    pendingAction: string | null;
    sync: PickupManifestSyncSummary;
    onScan: (value: string) => PickupManifestScanResult;
    onSetItemState: (
        pickupNodeId: string,
        manifestId: string,
        stopId: number,
        state: 'missing-label' | 'not-ready' | 'ready',
    ) => void;
    onResolveRemaining: (
        pickupNodeId: string,
        manifest: DeliveryPickupManifestSummary,
    ) => void;
    onConfirmManifest: (
        pickupNodeId: string,
        manifestId: string,
    ) => void | Promise<void>;
    onRetrySync: (operationId: string) => void | Promise<void>;
    onDiscardSync: (operationId: string) => void | Promise<void>;
}) {
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address)}`;
    const current = actionState === 'current';
    const completed = actionState === 'completed';
    const syncMessage = syncAlert(sync);
    const collectedCount = pickup.scannedCount + pickup.missingLabelCount;
    const scannableTraceCount = new Set(
        pickup.manifests.flatMap((manifest) =>
            manifest.items.flatMap((item) =>
                item.tracePath ? [item.tracePath] : [],
            ),
        ),
    ).size;
    const pickupMutationsDisabled =
        Boolean(pendingAction) || sync.state === 'conflicted';
    const confirmingManifestIdsRef = useRef(new Set<string>());
    const [confirmingManifestIds, setConfirmingManifestIds] = useState(
        () => new Set<string>(),
    );

    async function confirmManifest(manifestId: string) {
        if (
            pickupMutationsDisabled ||
            sync.pendingCount > 0 ||
            confirmingManifestIdsRef.current.has(manifestId)
        ) {
            return;
        }

        confirmingManifestIdsRef.current.add(manifestId);
        setConfirmingManifestIds((current) => new Set(current).add(manifestId));
        try {
            await onConfirmManifest(pickup.id, manifestId);
        } finally {
            confirmingManifestIdsRef.current.delete(manifestId);
            setConfirmingManifestIds((current) => {
                const next = new Set(current);
                next.delete(manifestId);
                return next;
            });
        }
    }

    return (
        <Card
            className={
                current
                    ? 'border-primary shadow-md ring-1 ring-primary/20'
                    : undefined
            }
        >
            <CardContent noHeader className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                            P{pickup.sequence}
                        </div>
                        <div className="min-w-0">
                            <Typography
                                level="body1"
                                semiBold
                                className="truncate"
                            >
                                {current ? 'Sljedeće preuzimanje' : pickup.name}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-0.5 text-muted-foreground"
                            >
                                {current ? pickup.name : 'Lokacija preuzimanja'}
                            </Typography>
                        </div>
                    </div>
                    <Chip
                        color={
                            completed
                                ? 'success'
                                : current
                                  ? 'warning'
                                  : 'neutral'
                        }
                        size="sm"
                    >
                        {completed
                            ? 'Preuzeto'
                            : current
                              ? 'Na redu'
                              : 'Zaključano'}
                    </Chip>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/70 p-3 text-center">
                    <div>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Dolazak
                        </Typography>
                        <Typography level="body2" semiBold>
                            {formatDeliveryTime(pickup.estimatedArrivalAt)}
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
                                pickup.estimatedTravelSeconds,
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
                            {formatDistance(pickup.estimatedDistanceMeters)}
                        </Typography>
                    </div>
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>{pickup.address}</span>
                    </div>
                    {pickup.serviceDurationSeconds ? (
                        <div className="flex items-start gap-2">
                            <Timer className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span>
                                Planirano preuzimanje:{' '}
                                {formatTravelDuration(
                                    pickup.serviceDurationSeconds,
                                )}
                            </span>
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                    <Chip color="success" size="sm">
                        Skenirano {pickup.scannedCount}
                    </Chip>
                    <Chip color="info" size="sm">
                        Bez etikete {pickup.missingLabelCount}
                    </Chip>
                    <Chip
                        color={pickup.notReadyCount ? 'warning' : 'neutral'}
                        size="sm"
                    >
                        Nije spremno {pickup.notReadyCount}
                    </Chip>
                    <Chip color="neutral" size="sm">
                        Preostalo {pickup.remainingCount}
                    </Chip>
                </div>

                {syncMessage ? (
                    <Alert
                        color={syncMessage.color}
                        startDecorator={<Reset className="size-5" />}
                    >
                        <div className="space-y-2">
                            <span className="block">{syncMessage.message}</span>
                            {(sync.state === 'failed' ||
                                sync.state === 'conflicted') &&
                            sync.blockingOperationId ? (
                                <div className="flex flex-wrap gap-2">
                                    {sync.state === 'failed' ? (
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            onClick={() =>
                                                void onRetrySync(
                                                    sync.blockingOperationId ??
                                                        '',
                                                )
                                            }
                                        >
                                            Pokušaj ponovno
                                        </Button>
                                    ) : null}
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        onClick={() =>
                                            void onDiscardSync(
                                                sync.blockingOperationId ?? '',
                                            )
                                        }
                                    >
                                        Odbaci promjenu i osvježi
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </Alert>
                ) : null}

                {sync.durability === 'memory' && current ? (
                    <Alert
                        color="warning"
                        startDecorator={<Warning className="size-5" />}
                    >
                        Preglednik ne dopušta trajnu lokalnu pohranu. Ostani na
                        ovoj stranici dok se promjene ne sinkroniziraju.
                    </Alert>
                ) : null}

                {sync.coordination === 'best-effort' && current ? (
                    <Alert
                        color="info"
                        startDecorator={<Warning className="size-5" />}
                    >
                        Promjene su spremljene na uređaju, ali ovaj preglednik
                        ne može sigurno uskladiti istodobni rad u više kartica.
                        Za ovu rutu koristi samo ovu karticu.
                    </Alert>
                ) : null}

                {current ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            href={navigationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outlined"
                            startDecorator={<Navigate className="size-4" />}
                        >
                            Navigacija
                        </Button>
                        {scannableTraceCount > 0 ? (
                            <HarvestTraceScanner
                                variant="manifest"
                                availableTraceCount={pickup.expectedCount}
                                completedTraceCount={collectedCount}
                                disabled={pickupMutationsDisabled}
                                onScan={onScan}
                            />
                        ) : null}
                    </div>
                ) : null}

                <div className="space-y-3">
                    {pickup.manifests.map((manifest) => {
                        const unresolvedReady = manifest.items.filter(
                            (item) => item.state === 'ready',
                        );
                        const confirmable =
                            manifest.state === 'pending' &&
                            manifest.remainingCount === 0 &&
                            manifest.notReadyCount === 0;

                        return (
                            <section
                                key={manifest.id}
                                className="space-y-3 rounded-lg border p-3"
                                aria-label={`Manifest ${formatDeliveryDateTime(manifest.startAt)}`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <Typography level="body2" semiBold>
                                            Manifest termina
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="mt-0.5 flex items-center gap-1 text-muted-foreground"
                                        >
                                            <Calendar className="size-4" />
                                            {formatDeliveryDateTime(
                                                manifest.startAt,
                                            )}{' '}
                                            –{' '}
                                            {formatDeliveryTime(manifest.endAt)}
                                        </Typography>
                                    </div>
                                    <Chip
                                        color={
                                            manifest.state === 'confirmed'
                                                ? 'success'
                                                : 'neutral'
                                        }
                                        size="sm"
                                    >
                                        {manifest.state === 'confirmed'
                                            ? 'Potvrđen'
                                            : `${manifest.scannedCount + manifest.missingLabelCount}/${manifest.expectedCount}`}
                                    </Chip>
                                </div>

                                <ul
                                    className="space-y-2"
                                    aria-label="Urodi u manifestu"
                                >
                                    {manifest.items.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex flex-col gap-2 rounded-md bg-muted/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <Typography
                                                    level="body3"
                                                    semiBold
                                                    className="flex items-center gap-2 truncate"
                                                >
                                                    <Leaf className="size-4 shrink-0" />
                                                    {item.harvest.plantName}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="truncate text-muted-foreground"
                                                >
                                                    {[
                                                        item.harvest
                                                            .raisedBedName,
                                                        item.harvest.fieldName,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                        'Urod za dostavu'}
                                                </Typography>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Chip
                                                    color={itemStateColor(
                                                        item.state,
                                                    )}
                                                    size="sm"
                                                >
                                                    {itemStateLabel(item.state)}
                                                </Chip>
                                                {current &&
                                                manifest.state === 'pending' &&
                                                item.state === 'ready' ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="plain"
                                                            disabled={
                                                                pickupMutationsDisabled
                                                            }
                                                            onClick={() =>
                                                                onSetItemState(
                                                                    pickup.id,
                                                                    manifest.id,
                                                                    item.stopId,
                                                                    'missing-label',
                                                                )
                                                            }
                                                        >
                                                            Preuzeto bez QR
                                                            etikete
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            color="warning"
                                                            variant="plain"
                                                            disabled={
                                                                pickupMutationsDisabled
                                                            }
                                                            onClick={() =>
                                                                onSetItemState(
                                                                    pickup.id,
                                                                    manifest.id,
                                                                    item.stopId,
                                                                    'not-ready',
                                                                )
                                                            }
                                                        >
                                                            Nije spremno
                                                        </Button>
                                                    </>
                                                ) : null}
                                                {current &&
                                                manifest.state === 'pending' &&
                                                item.state === 'not-ready' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="plain"
                                                        disabled={
                                                            pickupMutationsDisabled
                                                        }
                                                        onClick={() =>
                                                            onSetItemState(
                                                                pickup.id,
                                                                manifest.id,
                                                                item.stopId,
                                                                'ready',
                                                            )
                                                        }
                                                    >
                                                        Ponovno spremno
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                {current && manifest.state === 'pending' ? (
                                    <div className="space-y-2 border-t pt-3">
                                        {unresolvedReady.length > 0 ? (
                                            <Button
                                                variant="outlined"
                                                disabled={
                                                    pickupMutationsDisabled
                                                }
                                                onClick={() =>
                                                    onResolveRemaining(
                                                        pickup.id,
                                                        manifest,
                                                    )
                                                }
                                            >
                                                Preuzmi preostalih{' '}
                                                {unresolvedReady.length} bez
                                                etikete
                                            </Button>
                                        ) : null}
                                        {manifest.notReadyCount > 0 ? (
                                            <Alert
                                                color="warning"
                                                startDecorator={
                                                    <Warning className="size-5" />
                                                }
                                            >
                                                Jedan ili više uroda nisu
                                                preuzeti. Njihove dostave ostaju
                                                zaključane.
                                            </Alert>
                                        ) : null}
                                        <Button
                                            color="success"
                                            loading={confirmingManifestIds.has(
                                                manifest.id,
                                            )}
                                            disabled={
                                                !confirmable ||
                                                pickupMutationsDisabled ||
                                                sync.pendingCount > 0 ||
                                                confirmingManifestIds.has(
                                                    manifest.id,
                                                )
                                            }
                                            onClick={() =>
                                                void confirmManifest(
                                                    manifest.id,
                                                )
                                            }
                                            startDecorator={
                                                <Approved className="size-4" />
                                            }
                                        >
                                            Potvrdi preuzimanje i nastavi
                                        </Button>
                                        {manifest.remainingCount > 0 ? (
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Prije potvrde skeniraj urode ili
                                                označi one bez QR etikete.
                                            </Typography>
                                        ) : null}
                                    </div>
                                ) : null}

                                {manifest.confirmedAt ? (
                                    <Typography
                                        level="body3"
                                        className="flex items-center gap-2 text-muted-foreground"
                                    >
                                        <Check className="size-4" /> Potvrđeno{' '}
                                        {formatDeliveryDateTime(
                                            manifest.confirmedAt,
                                        )}
                                    </Typography>
                                ) : null}
                            </section>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
