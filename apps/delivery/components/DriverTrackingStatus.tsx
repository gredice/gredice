'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { MyLocation, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

function lastConfirmationLabel(lastAcceptedAt: string | null) {
    return lastAcceptedAt
        ? ` Posljednja potvrda: ${formatDeliveryDateTime(lastAcceptedAt)}.`
        : '';
}

type TrackingStatusContent = {
    color: 'info' | 'success' | 'warning';
    message: string;
    action: 'retry' | 'permission' | 'refresh' | null;
};

function trackingStatusContent(
    tracking: DriverTrackingState,
): TrackingStatusContent | null {
    const lastConfirmation = lastConfirmationLabel(tracking.lastAcceptedAt);
    switch (tracking.status) {
        case 'requesting':
            return {
                color: 'info',
                message:
                    'Čeka se GPS lokacija i dopuštenje preglednika. Praćenje još nije potvrđeno.',
                action: null,
            };
        case 'sending':
            return {
                color: 'info',
                message: tracking.lastAcceptedAt
                    ? `Šalje se nova lokacija. Status će se osvježiti nakon potvrde poslužitelja.${lastConfirmation}`
                    : 'Lokacija se šalje. Praćenje još nije potvrđeno.',
                action: null,
            };
        case 'active':
            return {
                color: 'success',
                message: `GPS praćenje je aktivno. Lokaciju vidi samo korisnik trenutačne dostavne stanice kada je ona na redu.${lastConfirmation}`,
                action: null,
            };
        case 'delayed':
            return {
                color: 'warning',
                message: `Posljednja potvrda lokacije kasni. Slanje se nastavlja dok je stranica vidljiva i aktivna; preglednik ga može pauzirati kada je skriven ili je zaslon zaključan.${lastConfirmation}`,
                action: 'retry',
            };
        case 'retrying':
            return {
                color: 'warning',
                message:
                    tracking.reason === 'offline'
                        ? tracking.sampleQueued
                            ? `Nema internetske veze. Najnovija lokacija čeka slanje i uklonit će se ako zastari.${lastConfirmation}`
                            : `Nema internetske veze. Slanje će se nastaviti nakon povratka veze i nove GPS lokacije.${lastConfirmation}`
                        : `Slanje lokacije nije potvrđeno. Aplikacija će pokušati ponovno u sigurnim razmacima.${lastConfirmation}`,
                action: tracking.reason === 'offline' ? null : 'retry',
            };
        case 'denied':
            return {
                color: 'warning',
                message: `Pristup lokaciji je odbijen. Dopusti lokaciju u postavkama preglednika pa ponovno provjeri dopuštenje.${lastConfirmation}`,
                action: 'permission',
            };
        case 'unavailable':
            return {
                color: 'warning',
                message:
                    tracking.reason === 'tracking-unsupported'
                        ? `Ovaj uređaj ili preglednik ne podržava GPS praćenje.${lastConfirmation}`
                        : tracking.reason === 'server-rejected'
                          ? `Aktivna ruta ili prijava više ne prihvaća GPS lokaciju. Osvježi dostave i provjeri trenutačnu rutu.${lastConfirmation}`
                          : tracking.reason === 'sample-expired'
                            ? `Lokacija je istekla prije potvrde. Čeka se nova GPS lokacija.${lastConfirmation}`
                            : tracking.reason === 'upload-rejected'
                              ? `Poslužitelj nije prihvatio GPS zapis. Čeka se nova lokacija prije sljedećeg pokušaja.${lastConfirmation}`
                              : `GPS lokacija trenutačno nije dostupna. Provjeri GPS postavke i pokušaj ponovno.${lastConfirmation}`,
                action:
                    tracking.reason === 'tracking-unsupported'
                        ? null
                        : tracking.reason === 'server-rejected'
                          ? 'refresh'
                          : 'retry',
            };
        case 'inactive':
            return null;
    }
}

export function DriverTrackingStatus({
    tracking,
}: {
    tracking: DriverTrackingState;
}) {
    const content = trackingStatusContent(tracking);
    if (!content) return null;
    const announcement =
        tracking.status === 'active'
            ? 'GPS praćenje je potvrđeno i aktivno.'
            : tracking.status === 'sending'
              ? 'GPS lokacija se šalje i čeka potvrdu.'
              : tracking.status === 'retrying'
                ? 'Slanje GPS lokacije nije potvrđeno. Pokušaj će se ponoviti.'
                : tracking.status === 'delayed'
                  ? 'Potvrda GPS lokacije kasni.'
                  : tracking.status === 'denied'
                    ? 'Pristup GPS lokaciji je odbijen.'
                    : tracking.status === 'unavailable'
                      ? 'GPS praćenje trenutačno nije dostupno.'
                      : 'Čeka se GPS lokacija.';

    return (
        <div>
            <span className="sr-only" aria-live="polite" role="status">
                {announcement}
            </span>
            <Alert
                aria-label="Status GPS praćenja"
                color={content.color}
                role="group"
                startDecorator={
                    tracking.status === 'active' ? (
                        <MyLocation className="size-5" />
                    ) : (
                        <Warning className="size-5" />
                    )
                }
            >
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <Typography level="body2">{content.message}</Typography>
                    {content.action ? (
                        <Button
                            color={content.color}
                            size="sm"
                            startDecorator={<Reset className="size-4" />}
                            variant="soft"
                            onClick={
                                content.action === 'permission'
                                    ? tracking.recheckPermission
                                    : tracking.retryNow
                            }
                        >
                            {content.action === 'permission'
                                ? 'Ponovno provjeri dopuštenje'
                                : content.action === 'refresh'
                                  ? 'Osvježi dostave'
                                  : 'Pokušaj sada'}
                        </Button>
                    ) : null}
                </div>
            </Alert>
        </div>
    );
}
