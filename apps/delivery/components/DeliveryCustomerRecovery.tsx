import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Info, Mail, MapPin, Reset, Warning } from '@gredice/ui/icons';
import { PublicPagePaths, publicChromeHref } from '@gredice/ui/PublicChrome';
import { Typography } from '@gredice/ui/Typography';
import type { CustomerDeliveryRecoverySummary } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

export function DeliveryCustomerRecovery({
    recovery,
}: {
    recovery: CustomerDeliveryRecoverySummary;
}) {
    const supportHref = publicChromeHref(PublicPagePaths.Contact, 'www-origin');
    if (recovery.kind === 'retry-planned') {
        return (
            <Alert
                color="warning"
                startDecorator={<Reset className="size-5" />}
            >
                <Typography level="body2" semiBold>
                    Ponovni pokušaj je planiran
                </Typography>
                <Typography level="body3" className="mt-1">
                    Vozač nastavlja rutu i vratit će se kasnije. Novo vrijeme
                    dolaska prikazat će se čim ruta bude ažurirana.
                </Typography>
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
                            href={supportHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            variant="outlined"
                            startDecorator={<Mail className="size-4" />}
                        >
                            Potvrdi preuzimanje
                        </Button>
                        <Button
                            href={navigationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
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
                        href={supportHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
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
                    href={supportHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outlined"
                    startDecorator={<Mail className="size-4" />}
                >
                    Kontaktiraj podršku
                </Button>
            </div>
        </Alert>
    );
}
