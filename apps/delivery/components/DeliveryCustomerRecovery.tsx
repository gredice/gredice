import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Info, Mail, MapPin, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { customerDeliveryRequestSupportHref } from '../lib/deliveryCustomerReceipt';
import type {
    CustomerDeliveryRecoverySummary,
    DeliveryHarvestSummary,
} from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

export function DeliveryCustomerRecovery({
    recovery,
    requestReference,
    harvest,
}: {
    recovery: CustomerDeliveryRecoverySummary;
    requestReference: string;
    harvest: DeliveryHarvestSummary;
}) {
    const supportHref = customerDeliveryRequestSupportHref({
        kind: 'support',
        delivery: { requestReference, harvest },
    });
    if (recovery.kind === 'retry-planned') {
        return (
            <Alert
                color="warning"
                startDecorator={<Reset className="size-5" />}
            >
                <div className="space-y-3">
                    <div>
                        <Typography level="body2" semiBold>
                            Ponovni pokušaj je planiran
                        </Typography>
                        <Typography level="body3" className="mt-1">
                            Vozač nastavlja rutu i vratit će se kasnije. Novo
                            vrijeme dolaska prikazat će se čim ruta bude
                            ažurirana.
                        </Typography>
                    </div>
                    <Button
                        aria-label={`Prijavi problem za dostavu: ${harvest.plantName}`}
                        href={supportHref}
                        size="sm"
                        className="min-h-11"
                        variant="outlined"
                        startDecorator={<Mail className="size-4" />}
                    >
                        Prijavi problem
                    </Button>
                </div>
            </Alert>
        );
    }

    if (recovery.kind === 'hq-pickup') {
        const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(recovery.pickupAddress)}`;
        return (
            <Alert color="info" startDecorator={<Info className="size-5" />}>
                <div className="space-y-3">
                    <div>
                        <Typography level="body2" semiBold>
                            Osobno preuzimanje u HQ-u
                        </Typography>
                        <Typography level="body3" className="mt-1">
                            Urod možeš preuzeti na lokaciji Gredice HQ
                            najkasnije{' '}
                            <strong>
                                {formatDeliveryDateTime(
                                    recovery.pickupDeadlineAt,
                                )}
                            </strong>{' '}
                            (rok od {recovery.pickupWindowHours} sata).
                        </Typography>
                        <Typography level="body3" className="mt-1">
                            Prije dolaska potvrdi s podrškom da je urod vraćen
                            na lokaciju.
                        </Typography>
                        <Typography
                            level="body3"
                            className="mt-1 text-muted-foreground"
                        >
                            {recovery.pickupAddress}
                        </Typography>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            aria-label={`Potvrdi preuzimanje za dostavu: ${harvest.plantName}`}
                            href={supportHref}
                            size="sm"
                            className="min-h-11"
                            variant="outlined"
                            startDecorator={<Mail className="size-4" />}
                        >
                            Potvrdi preuzimanje
                        </Button>
                        <Button
                            aria-label={`Otvori lokaciju HQ za dostavu: ${harvest.plantName}`}
                            href={navigationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            className="min-h-11"
                            variant="outlined"
                            startDecorator={<MapPin className="size-4" />}
                        >
                            Otvori lokaciju HQ
                        </Button>
                    </div>
                </div>
            </Alert>
        );
    }

    if (recovery.kind === 'hq-pickup-expired') {
        return (
            <Alert
                color="warning"
                startDecorator={<Warning className="size-5" />}
            >
                <div className="space-y-3">
                    <div>
                        <Typography level="body2" semiBold>
                            Rok za osobno preuzimanje je istekao
                        </Typography>
                        <Typography level="body3" className="mt-1">
                            Rok od 72 sata za preuzimanje u HQ-u više nije
                            aktivan. Javi nam se kako bismo provjerili status
                            uroda i sljedeći korak.
                        </Typography>
                    </div>
                    <Button
                        aria-label={`Kontaktiraj podršku za dostavu: ${harvest.plantName}`}
                        href={supportHref}
                        size="sm"
                        className="min-h-11"
                        variant="outlined"
                        startDecorator={<Mail className="size-4" />}
                    >
                        Kontaktiraj podršku
                    </Button>
                </div>
            </Alert>
        );
    }

    const cancelled = recovery.kind === 'cancelled';
    return (
        <Alert
            color={cancelled ? 'warning' : 'danger'}
            startDecorator={<Warning className="size-5" />}
        >
            <div className="space-y-3">
                <div>
                    <Typography level="body2" semiBold>
                        {cancelled
                            ? 'Dostava je otkazana'
                            : 'Podrška će dogovoriti sljedeći korak'}
                    </Typography>
                    <Typography level="body3" className="mt-1">
                        {cancelled
                            ? 'Ako otkazivanje nisi očekivao/la, javi nam se kako bismo provjerili dostavu.'
                            : 'Ovaj urod nije moguće odmah preuzeti na HQ-u. Javi nam se za provjeru i dogovor.'}
                    </Typography>
                </div>
                <Button
                    aria-label={`Kontaktiraj podršku za dostavu: ${harvest.plantName}`}
                    href={supportHref}
                    size="sm"
                    className="min-h-11"
                    variant="outlined"
                    startDecorator={<Mail className="size-4" />}
                >
                    Kontaktiraj podršku
                </Button>
            </div>
        </Alert>
    );
}
