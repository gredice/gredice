import { Chip } from '@gredice/ui/Chip';
import { ExternalLink, Leaf, MapPin, User, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryRouteStepSummary } from '../lib/deliveryDashboardTypes';
import {
    deliveryExceptionOutcomeLabel,
    deliveryExceptionReasonLabel,
} from '../lib/deliveryExceptionPresentation';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
} from '../lib/deliveryFormatting';

function harvestLabel({
    plantName,
    raisedBedName,
    fieldName,
}: {
    plantName: string;
    raisedBedName: string | null;
    fieldName: string | null;
}) {
    return [plantName, raisedBedName, fieldName].filter(Boolean).join(' · ');
}

function pickupItemStateLabel(
    state: Extract<
        DeliveryRouteStepSummary,
        { kind: 'pickup' }
    >['pickup']['manifests'][number]['items'][number]['state'],
) {
    switch (state) {
        case 'ready':
            return 'Spremno';
        case 'scanned':
            return 'Skenirano';
        case 'missing-label':
            return 'Preuzeto bez etikete';
        case 'not-ready':
            return 'Nije preuzeto';
    }
}

function TraceLink({ tracePath }: { tracePath: string }) {
    return (
        <a
            href={`https://www.gredice.com${tracePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            Trag uroda
            <ExternalLink aria-hidden className="size-4" />
        </a>
    );
}

function PickupDetails({
    step,
}: {
    step: Extract<DeliveryRouteStepSummary, { kind: 'pickup' }>;
}) {
    const pickup = step.pickup;
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <Chip size="sm">Očekivano {pickup.expectedCount}</Chip>
                <Chip color="success" size="sm">
                    Skenirano {pickup.scannedCount}
                </Chip>
                {pickup.missingLabelCount > 0 ? (
                    <Chip color="warning" size="sm">
                        Bez etikete {pickup.missingLabelCount}
                    </Chip>
                ) : null}
                {pickup.notReadyCount > 0 ? (
                    <Chip color="error" size="sm">
                        Nije preuzeto {pickup.notReadyCount}
                    </Chip>
                ) : null}
                <Chip color="neutral" size="sm">
                    Preostalo {pickup.remainingCount}
                </Chip>
            </div>
            {pickup.manifests.length > 0 ? (
                <div className="space-y-3">
                    {pickup.manifests.map((manifest) => (
                        <section
                            key={manifest.id}
                            aria-label={`Termin preuzimanja ${formatDeliveryTime(manifest.startAt)}–${formatDeliveryTime(manifest.endAt)}`}
                            className="rounded-md border bg-muted/20 p-3"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Typography level="body2" semiBold>
                                    Termin{' '}
                                    {formatDeliveryTime(manifest.startAt)}–
                                    {formatDeliveryTime(manifest.endAt)}
                                </Typography>
                                <Chip
                                    color={
                                        manifest.state === 'confirmed'
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    size="sm"
                                >
                                    {manifest.state === 'confirmed'
                                        ? 'Potvrđeno'
                                        : 'Čeka potvrdu'}
                                </Chip>
                            </div>
                            <ul className="mt-3 space-y-2">
                                {manifest.items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="rounded-md bg-background p-3"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <Typography level="body3" semiBold>
                                                {harvestLabel(item.harvest)}
                                            </Typography>
                                            <Chip
                                                color={
                                                    item.state === 'scanned'
                                                        ? 'success'
                                                        : item.state ===
                                                            'not-ready'
                                                          ? 'error'
                                                          : item.state ===
                                                              'missing-label'
                                                            ? 'warning'
                                                            : 'neutral'
                                                }
                                                size="sm"
                                            >
                                                {pickupItemStateLabel(
                                                    item.state,
                                                )}
                                            </Chip>
                                        </div>
                                        {item.tracePath ? (
                                            <TraceLink
                                                tracePath={item.tracePath}
                                            />
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : (
                <Typography level="body3" className="text-muted-foreground">
                    Detalji manifesta nisu dostupni u ovoj kopiji rute.
                </Typography>
            )}
        </div>
    );
}

function DeliveryDetails({
    step,
}: {
    step: Extract<DeliveryRouteStepSummary, { kind: 'delivery' }>;
}) {
    const stop = step.stop;
    return (
        <div className="space-y-3">
            {stop.addressLabel ? (
                <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
                    <MapPin
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div>
                        <Typography level="body3" semiBold>
                            Uputa za adresu
                        </Typography>
                        <Typography level="body3">
                            {stop.addressLabel}
                        </Typography>
                    </div>
                </div>
            ) : null}
            <ul className="space-y-3">
                {stop.deliveries.map((delivery) => (
                    <li
                        key={delivery.requestId}
                        className="rounded-md border bg-muted/20 p-3"
                    >
                        <div className="flex items-start gap-2">
                            <User
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0">
                                <Typography level="body2" semiBold>
                                    {delivery.contactName}
                                </Typography>
                                {delivery.phone ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        Telefon: {delivery.phone}
                                    </Typography>
                                ) : null}
                            </div>
                        </div>
                        <div className="mt-3 flex items-start gap-2">
                            <Leaf
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <Typography level="body3">
                                {harvestLabel(delivery.harvest)}
                            </Typography>
                        </div>
                        {delivery.exception ? (
                            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                                <div className="flex items-start gap-2">
                                    <Warning
                                        aria-hidden
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                    <div>
                                        <Typography level="body3" semiBold>
                                            {deliveryExceptionOutcomeLabel(
                                                delivery.exception.outcome,
                                            )}
                                        </Typography>
                                        <Typography level="body3">
                                            {deliveryExceptionReasonLabel(
                                                delivery.exception.reason,
                                            )}
                                        </Typography>
                                        {delivery.exception.note ? (
                                            <Typography level="body3">
                                                {delivery.exception.note}
                                            </Typography>
                                        ) : null}
                                        <Typography
                                            level="body3"
                                            className="text-current/70"
                                        >
                                            {formatDeliveryDateTime(
                                                delivery.exception.occurredAt,
                                            )}
                                        </Typography>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {delivery.requestNotes ? (
                            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                <strong>Napomena korisnika:</strong>{' '}
                                {delivery.requestNotes}
                            </div>
                        ) : null}
                        {delivery.deliveryNotes ? (
                            <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                                <strong>Napomena dostave:</strong>{' '}
                                {delivery.deliveryNotes}
                            </div>
                        ) : null}
                        {delivery.harvest.tracePath ? (
                            <TraceLink tracePath={delivery.harvest.tracePath} />
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function DriverRouteStepDetails({
    step,
}: {
    step: DeliveryRouteStepSummary;
}) {
    return step.kind === 'pickup' ? (
        <PickupDetails step={step} />
    ) : (
        <DeliveryDetails step={step} />
    );
}
