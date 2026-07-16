import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Calendar,
    ExternalLink,
    Leaf,
    Timer,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { CustomerDeliveryRequestSummary } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import { DeliveryCustomerReceipt } from './DeliveryCustomerReceipt';
import { DeliveryCustomerRecovery } from './DeliveryCustomerRecovery';

function statusColor(
    delivery: CustomerDeliveryRequestSummary,
): 'success' | 'info' | 'error' | 'warning' | 'neutral' {
    if (delivery.statusLabel === 'Dostavljeno') return 'success';
    if (
        delivery.statusLabel === 'Otkazano' ||
        delivery.statusLabel === 'Dostava je otkazana' ||
        delivery.statusLabel === 'Dostava nije uspjela'
    ) {
        return 'error';
    }
    if (
        delivery.statusLabel === 'Dostava je odgođena' ||
        delivery.statusLabel === 'Vozač stiže' ||
        delivery.statusLabel === 'U dostavi'
    ) {
        return 'warning';
    }
    if (delivery.statusLabel === 'Vozač je stigao') return 'info';
    return 'neutral';
}

export function CustomerDeliveryCard({
    delivery,
}: {
    delivery: CustomerDeliveryRequestSummary;
}) {
    const showRouteEstimates =
        Boolean(
            delivery.estimatedArrivalAt || delivery.estimatedTravelSeconds,
        ) &&
        (!delivery.recovery || delivery.recovery.kind === 'retry-planned');
    const estimatedOutsideWindow = Boolean(
        delivery.estimatedArrivalAt &&
            delivery.slotEndAt &&
            new Date(delivery.estimatedArrivalAt) >
                new Date(delivery.slotEndAt),
    );
    const harvestDescription = [
        delivery.harvest.plantName,
        delivery.harvest.raisedBedName,
        delivery.harvest.fieldName,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Card data-testid="customer-delivery-card" className="min-w-0">
            <CardContent noHeader className="min-w-0 space-y-4 p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Truck className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <Typography
                                component="h3"
                                level="body1"
                                semiBold
                                className="break-words"
                            >
                                {delivery.harvest.plantName}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-0.5 text-muted-foreground"
                            >
                                Dostava uroda
                            </Typography>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Chip color="neutral" size="sm">
                            Dostava
                        </Chip>
                        <Chip color={statusColor(delivery)} size="sm">
                            {delivery.statusLabel}
                        </Chip>
                    </div>
                </div>

                {delivery.slotStartAt && delivery.slotEndAt ? (
                    <div className="flex items-start gap-2 text-sm">
                        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                            Termin:{' '}
                            <time dateTime={delivery.slotStartAt}>
                                {formatDeliveryDateTime(delivery.slotStartAt)}
                            </time>{' '}
                            –{' '}
                            <time dateTime={delivery.slotEndAt}>
                                {formatDeliveryTime(delivery.slotEndAt)}
                            </time>
                        </span>
                    </div>
                ) : null}

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
                                {formatDeliveryTime(
                                    delivery.estimatedArrivalAt,
                                )}
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
                                    delivery.estimatedTravelSeconds,
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
                                {formatDistance(
                                    delivery.estimatedDistanceMeters,
                                )}
                            </Typography>
                        </div>
                    </div>
                ) : delivery.reroutePending ? (
                    <Alert color="info">
                        Procjena dolaska ažurira se nakon promjene rute.
                    </Alert>
                ) : null}

                {delivery.recovery ? (
                    <DeliveryCustomerRecovery recovery={delivery.recovery} />
                ) : null}

                {!delivery.receipt ? (
                    <div className="flex items-start gap-2 text-sm">
                        <Leaf className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">
                            {harvestDescription}
                        </span>
                    </div>
                ) : null}

                {delivery.requestNotes ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <strong>Napomena:</strong> {delivery.requestNotes}
                    </div>
                ) : null}

                {showRouteEstimates &&
                estimatedOutsideWindow &&
                delivery.status !== 'fulfilled' ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <Warning className="mt-0.5 size-4 shrink-0" />
                        <span>
                            Trenutačna procjena dolaska je nakon završetka
                            termina. Prikaz će se ažurirati kada vozač nastavi
                            rutu.
                        </span>
                    </div>
                ) : null}

                {!delivery.receipt && delivery.harvest.tracePath ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            aria-label={`Otvori trag uroda: ${delivery.harvest.plantName}`}
                            href={`https://www.gredice.com${delivery.harvest.tracePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="plain"
                            className="min-h-11"
                            startDecorator={<ExternalLink className="size-4" />}
                        >
                            Trag uroda
                        </Button>
                    </div>
                ) : null}

                {delivery.receipt ? (
                    <DeliveryCustomerReceipt
                        receipt={delivery.receipt}
                        headingLevel="h4"
                    />
                ) : null}

                {delivery.deliveredAt && !delivery.receipt ? (
                    <Typography
                        level="body3"
                        className="flex items-center gap-2 text-muted-foreground"
                    >
                        <Timer className="size-4" /> Dostavljeno{' '}
                        <time dateTime={delivery.deliveredAt}>
                            {formatDeliveryDateTime(delivery.deliveredAt)}
                        </time>
                    </Typography>
                ) : null}
            </CardContent>
        </Card>
    );
}
