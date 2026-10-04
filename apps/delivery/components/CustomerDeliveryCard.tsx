import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Calendar,
    ExternalLink,
    Info,
    Leaf,
    Mail,
    MapPin,
    Timer,
    Truck,
    User,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { customerDeliveryRequestSupportHref } from '../lib/deliveryCustomerReceipt';
import type { CustomerDeliveryRequestSummary } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryDateTimeRange,
} from '../lib/deliveryFormatting';
import { CustomerDeliveryPromise } from './CustomerDeliveryPromise';
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
    emphasized = false,
    headingLevel = 'h3',
    announceArrival = true,
}: {
    delivery: CustomerDeliveryRequestSummary;
    emphasized?: boolean;
    headingLevel?: 'h3' | 'h4';
    announceArrival?: boolean;
}) {
    const showDeliveryPromise =
        delivery.status !== 'fulfilled' &&
        !delivery.receipt &&
        (!delivery.recovery || delivery.recovery.kind === 'retry-planned');
    const promisedWindow = formatDeliveryDateTimeRange(
        delivery.slotStartAt,
        delivery.slotEndAt,
    );
    const harvestDescription = [
        delivery.harvest.plantName,
        delivery.harvest.raisedBedName,
        delivery.harvest.fieldName,
    ]
        .filter(Boolean)
        .join(' · ');
    const supportHref = customerDeliveryRequestSupportHref({
        kind: 'support',
        delivery: {
            requestReference: delivery.requestId,
            harvest: delivery.harvest,
        },
    });

    return (
        <Card
            data-testid="customer-delivery-card"
            className={
                emphasized
                    ? 'min-w-0 border-primary/40 shadow-md ring-1 ring-primary/20'
                    : 'min-w-0'
            }
        >
            <CardContent noHeader className="min-w-0 space-y-4 p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Truck className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <Typography
                                component={headingLevel}
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

                <div className="flex items-start gap-2 text-sm">
                    <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    {promisedWindow ? (
                        <span>
                            Termin:{' '}
                            <time dateTime={promisedWindow.startAt}>
                                {promisedWindow.startLabel}
                            </time>{' '}
                            –{' '}
                            <time dateTime={promisedWindow.endAt}>
                                {promisedWindow.endLabel}
                            </time>
                        </span>
                    ) : (
                        <span>Termin još nije dostupan.</span>
                    )}
                </div>

                {showDeliveryPromise ? (
                    <CustomerDeliveryPromise
                        announceArrival={announceArrival}
                        eta={delivery.eta}
                        progress={delivery.progress}
                        promisedWindowStartAt={delivery.slotStartAt}
                    />
                ) : null}

                {delivery.recovery ? (
                    <DeliveryCustomerRecovery
                        recovery={delivery.recovery}
                        requestReference={delivery.requestId}
                        harvest={delivery.harvest}
                    />
                ) : null}

                <div className="space-y-3 rounded-lg bg-muted/70 p-3">
                    <div className="flex items-start gap-2 text-sm">
                        <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Primatelj
                            </Typography>
                            <Typography
                                level="body2"
                                semiBold
                                className="break-words"
                            >
                                {delivery.destination.recipientName}
                            </Typography>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Odredište
                            </Typography>
                            {delivery.destination.addressLabel ? (
                                <Typography
                                    level="body2"
                                    semiBold
                                    className="break-words"
                                >
                                    {delivery.destination.addressLabel}
                                </Typography>
                            ) : null}
                            <Typography level="body3" className="break-words">
                                {delivery.destination.address}
                            </Typography>
                        </div>
                    </div>
                    {delivery.requestNotes ? (
                        <div className="flex items-start gap-2 text-sm">
                            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Upute za dostavu
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="break-words"
                                >
                                    {delivery.requestNotes}
                                </Typography>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 text-sm">
                            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Upute za dostavu
                                </Typography>
                                <Typography level="body3">
                                    Nema posebnih uputa.
                                </Typography>
                            </div>
                        </div>
                    )}
                </div>

                {!delivery.receipt ? (
                    <div className="flex items-start gap-2 text-sm">
                        <Leaf className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">
                            {harvestDescription}
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

                {!delivery.receipt && !delivery.recovery ? (
                    <Button
                        aria-label={`Prijavi problem za dostavu: ${delivery.harvest.plantName}`}
                        href={supportHref}
                        size="sm"
                        variant="outlined"
                        className="min-h-11 min-w-0 justify-start whitespace-normal"
                        startDecorator={<Mail className="size-4" />}
                    >
                        Prijavi problem
                    </Button>
                ) : null}

                {delivery.receipt ? (
                    <DeliveryCustomerReceipt
                        receipt={delivery.receipt}
                        headingLevel={headingLevel === 'h4' ? 'h5' : 'h4'}
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
