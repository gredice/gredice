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
    Timer,
    User,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import type { DeliveryStopSummary } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import { DeliveryHarvestVerification } from './DeliveryHarvestVerification';

function statusColor(
    status: string,
): 'success' | 'info' | 'error' | 'warning' | 'neutral' {
    if (status === 'Dostavljeno') return 'success';
    if (status === 'Vozač je stigao') return 'info';
    if (status === 'Otkazano') return 'error';
    if (status === 'Vozač stiže' || status === 'U dostavi') {
        return 'warning';
    }
    return 'neutral';
}

export function DeliveryStopCard({
    stop,
    mode,
    pendingAction,
    onArrive,
    onDeliver,
}: {
    stop: DeliveryStopSummary;
    mode: 'driver' | 'customer';
    pendingAction?: 'arrive' | 'deliver' | null;
    onArrive?: () => void;
    onDeliver?: (notes?: string) => void;
}) {
    const [notes, setNotes] = useState('');
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
    const driverMode = mode === 'driver';
    const delivered = stop.statusLabel === 'Dostavljeno';
    const driverActionState =
        stop.actionState ??
        (delivered ? 'completed' : stop.isCurrent ? 'current' : 'upcoming');
    const customerActionAvailable = driverActionState === 'current';
    const estimatedOutsideWindow = Boolean(
        stop.estimatedArrivalAt &&
            stop.slotEndAt &&
            new Date(stop.estimatedArrivalAt) > new Date(stop.slotEndAt),
    );

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
                                    ? stop.deliveryCount > 1
                                        ? `${stop.deliveryCount} uroda · skupna dostava`
                                        : stop.contactName
                                    : stop.harvest.plantName}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-0.5 text-muted-foreground"
                            >
                                {driverMode
                                    ? stop.deliveryCount > 1
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

                {stop.estimatedArrivalAt || stop.estimatedTravelSeconds ? (
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

                {driverMode ? (
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
                        {estimatedOutsideWindow && !delivered ? (
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

                {driverMode && customerActionAvailable && !delivered ? (
                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <Button
                            href={navigationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outlined"
                            startDecorator={<Navigate className="size-4" />}
                        >
                            Navigacija
                        </Button>
                        {stop.stopState === 'arrived' ? (
                            <DeliveryHarvestVerification
                                deliveries={stop.deliveries}
                                disabled={Boolean(pendingAction)}
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
                            {stop.deliveryCount > 1
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
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                                variant="outlined"
                                loading={pendingAction === 'arrive'}
                                disabled={
                                    Boolean(pendingAction) ||
                                    stop.stopState === 'arrived'
                                }
                                onClick={onArrive}
                                startDecorator={
                                    <MyLocation className="size-4" />
                                }
                            >
                                {stop.stopState === 'arrived'
                                    ? 'Dolazak potvrđen'
                                    : 'Stigao sam'}
                            </Button>
                            <Button
                                color="success"
                                loading={pendingAction === 'deliver'}
                                disabled={Boolean(pendingAction)}
                                onClick={() => onDeliver?.(notes || undefined)}
                                startDecorator={<Approved className="size-4" />}
                            >
                                {stop.deliveryCount > 1
                                    ? `Dostavi ${stop.deliveryCount} uroda · dalje`
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
                                    {delivery.phone ? (
                                        <a
                                            href={`tel:${delivery.phone}`}
                                            className="flex items-center gap-2 text-primary hover:underline"
                                        >
                                            <Mobile className="size-4" />
                                            {delivery.phone}
                                        </a>
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
                                    {delivery.requestNotes ? (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                            <strong>Napomena:</strong>{' '}
                                            {delivery.requestNotes}
                                        </div>
                                    ) : null}
                                    {delivery.accountContacts.length > 0 ? (
                                        <div className="border-t pt-2">
                                            <Typography
                                                level="body3"
                                                semiBold
                                                className="mb-1"
                                            >
                                                Korisnici računa
                                            </Typography>
                                            {delivery.accountContacts.map(
                                                (contact) => (
                                                    <div
                                                        key={contact.id}
                                                        className="text-sm"
                                                    >
                                                        {contact.displayName} ·{' '}
                                                        <a
                                                            href={`mailto:${contact.email}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {contact.email}
                                                        </a>
                                                    </div>
                                                ),
                                            )}
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
                    {!driverMode && estimatedOutsideWindow && !delivered ? (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            <Warning className="mt-0.5 size-4 shrink-0" />
                            <span>
                                Trenutačna procjena dolaska je nakon završetka
                                termina. Obavijesti korisnika o kašnjenju.
                            </span>
                        </div>
                    ) : null}
                </div>

                {!driverMode && stop.harvest.tracePath ? (
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

                {stop.deliveredAt ? (
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
