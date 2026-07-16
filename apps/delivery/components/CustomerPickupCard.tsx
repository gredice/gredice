import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Calendar,
    ExternalLink,
    Info,
    Leaf,
    MapPin,
    ShoppingCart,
    Timer,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { CustomerPickupRequestSummary } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
} from '../lib/deliveryFormatting';

function statusColor(
    status: string,
): 'success' | 'info' | 'error' | 'warning' | 'neutral' {
    if (status === 'fulfilled' || status === 'ready') return 'success';
    if (status === 'failed' || status === 'cancelled') return 'error';
    if (status === 'deferred') return 'warning';
    if (status === 'confirmed' || status === 'preparing') return 'info';
    return 'neutral';
}

export function CustomerPickupCard({
    pickup,
}: {
    pickup: CustomerPickupRequestSummary;
}) {
    const harvestDescription = [
        pickup.harvest.plantName,
        pickup.harvest.raisedBedName,
        pickup.harvest.fieldName,
    ]
        .filter(Boolean)
        .join(' · ');
    const navigationUrl = pickup.location
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.location.address)}`
        : null;

    return (
        <Card data-testid="customer-pickup-card" className="min-w-0">
            <CardContent noHeader className="min-w-0 space-y-4 p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <ShoppingCart className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <Typography
                                component="h3"
                                level="body1"
                                semiBold
                                className="break-words"
                            >
                                {pickup.harvest.plantName}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-0.5 text-muted-foreground"
                            >
                                Osobno preuzimanje
                            </Typography>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Chip color="neutral" size="sm">
                            Preuzimanje
                        </Chip>
                        <Chip color={statusColor(pickup.status)} size="sm">
                            {pickup.statusLabel}
                        </Chip>
                    </div>
                </div>

                {pickup.slotStartAt && pickup.slotEndAt ? (
                    <div className="flex items-start gap-2 text-sm">
                        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                            Termin:{' '}
                            <time dateTime={pickup.slotStartAt}>
                                {formatDeliveryDateTime(pickup.slotStartAt)}
                            </time>{' '}
                            –{' '}
                            <time dateTime={pickup.slotEndAt}>
                                {formatDeliveryTime(pickup.slotEndAt)}
                            </time>
                        </span>
                    </div>
                ) : null}

                {pickup.location ? (
                    <div className="space-y-3 rounded-lg bg-muted/70 p-3">
                        <div className="flex items-start gap-2 text-sm">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <Typography level="body2" semiBold>
                                    {pickup.location.name}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="mt-0.5 break-words text-muted-foreground"
                                >
                                    {pickup.location.address}
                                </Typography>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span>{pickup.location.instructions}</span>
                        </div>
                        {navigationUrl ? (
                            <Button
                                aria-label={`Otvori lokaciju preuzimanja: ${pickup.location.name}`}
                                href={navigationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="sm"
                                variant="outlined"
                                className="min-h-11 whitespace-normal"
                                startDecorator={<MapPin className="size-4" />}
                            >
                                Otvori lokaciju
                            </Button>
                        ) : null}
                    </div>
                ) : (
                    <Alert color="warning">
                        Lokacija preuzimanja još nije dostupna. Pričekaj potvrdu
                        prije dolaska.
                    </Alert>
                )}

                <div className="flex items-start gap-2 text-sm">
                    <Leaf className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words">{harvestDescription}</span>
                </div>

                {pickup.requestNotes ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <strong>Napomena:</strong> {pickup.requestNotes}
                    </div>
                ) : null}

                {pickup.harvest.tracePath ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            aria-label={`Otvori trag uroda: ${pickup.harvest.plantName}`}
                            href={`https://www.gredice.com${pickup.harvest.tracePath}`}
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

                {pickup.pickedUpAt ? (
                    <Typography
                        level="body3"
                        className="flex items-center gap-2 text-muted-foreground"
                    >
                        <Timer className="size-4" /> Preuzeto{' '}
                        <time dateTime={pickup.pickedUpAt}>
                            {formatDeliveryDateTime(pickup.pickedUpAt)}
                        </time>
                    </Typography>
                ) : null}
            </CardContent>
        </Card>
    );
}
