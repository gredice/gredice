import { Alert } from '@gredice/ui/Alert';
import { Chip } from '@gredice/ui/Chip';
import { Hourglass, Tally3, Timer, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { croatianCountLabel } from '../lib/croatianCount';
import type {
    CustomerDeliveryEtaSummary,
    CustomerDeliveryProgressSummary,
} from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryDateTimeRange,
    formatDeliveryDurationRange,
} from '../lib/deliveryFormatting';

function etaSourceLabel(eta: CustomerDeliveryEtaSummary) {
    if (eta.confidence === 'high' && eta.freshness === 'fresh') {
        return 'Ažurna procjena prema prometu';
    }
    switch (eta.source) {
        case 'route-plan':
            return 'Okvirna procjena rute';
        case 'promised-window':
            return 'Prema odabranom terminu';
        case 'traffic-route':
            return eta.freshness === 'stale'
                ? 'Posljednja procjena rute'
                : 'Okvirna procjena prema prometu';
    }
}

function progressMessage(progress: CustomerDeliveryProgressSummary) {
    switch (progress.phase) {
        case 'scheduled':
            return 'Ruta za ovu dostavu još nije započela.';
        case 'next':
            return 'Tvoja dostava je sljedeća.';
        case 'arrived':
            return 'Vozač je stigao na lokaciju dostave.';
        case 'on-route':
            return progress.stopsAhead === null
                ? 'Dostava je na ruti.'
                : `${croatianCountLabel(
                      progress.stopsAhead,
                      'zaustavljanje',
                      'zaustavljanja',
                      'zaustavljanja',
                  )} prije tvoje dostave.`;
        case 'unavailable':
            return 'Napredak rute trenutačno nije dostupan.';
    }
}

function deliveryPromiseAnnouncement(
    eta: CustomerDeliveryEtaSummary,
    progress: CustomerDeliveryProgressSummary,
    range: ReturnType<typeof formatDeliveryDateTimeRange>,
) {
    const expiredPromise = progress.delayed && !range;
    return [
        range
            ? `Procijenjeni dolazak od ${range.startLabel} do ${range.endLabel}.`
            : expiredPromise
              ? 'Odabrani termin je prošao, a nova procjena dolaska trenutačno nije dostupna.'
              : 'Procjena dolaska trenutačno nije dostupna.',
        range ? `${etaSourceLabel(eta)}.` : null,
        eta.freshness === 'stale'
            ? 'Procjena rute nije ažurna; prikazujemo odabrani termin.'
            : null,
        progress.delayed && range
            ? 'Procjena dolaska je nakon završetka odabranog termina.'
            : null,
    ]
        .filter(Boolean)
        .join(' ');
}

export function CustomerDeliveryPromise({
    eta,
    progress,
    promisedWindowStartAt,
    announceArrival = true,
}: {
    eta: CustomerDeliveryEtaSummary;
    progress: CustomerDeliveryProgressSummary;
    promisedWindowStartAt: string | null;
    announceArrival?: boolean;
}) {
    const range = formatDeliveryDateTimeRange(
        eta.rangeStartAt,
        eta.rangeEndAt,
        promisedWindowStartAt,
    );
    const hasRange = range !== null;
    const remaining = formatDeliveryDurationRange(
        eta.remainingMinSeconds,
        eta.remainingMaxSeconds,
    );
    const routineAnnouncement = deliveryPromiseAnnouncement(
        eta,
        progress,
        range,
    );
    const arrived = progress.phase === 'arrived';

    return (
        <div data-testid="customer-delivery-promise" className="space-y-3">
            {hasRange ? (
                <div className="rounded-lg bg-muted/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Procijenjeni dolazak
                            </Typography>
                            <Typography level="body1" semiBold>
                                <time dateTime={range.startAt}>
                                    {range.startLabel}
                                </time>{' '}
                                –{' '}
                                <time dateTime={range.endAt}>
                                    {range.endLabel}
                                </time>
                            </Typography>
                        </div>
                        <Chip
                            color={
                                eta.confidence === 'high'
                                    ? 'success'
                                    : 'neutral'
                            }
                            size="sm"
                        >
                            {etaSourceLabel(eta)}
                        </Chip>
                    </div>
                    {remaining ? (
                        <Typography
                            level="body3"
                            className="mt-2 flex items-center gap-1.5 text-muted-foreground"
                        >
                            <Timer className="size-4" />{' '}
                            {remaining === 'uskoro'
                                ? 'Dolazak se očekuje uskoro.'
                                : `Preostalo: ${remaining}`}
                        </Typography>
                    ) : null}
                    {eta.freshness === 'stale' ? (
                        <Typography
                            level="body3"
                            className="mt-2 text-amber-800 dark:text-amber-200"
                        >
                            Procjena rute nije ažurna; prikazujemo odabrani
                            termin.
                        </Typography>
                    ) : null}
                    {eta.calculatedAt ? (
                        <Typography
                            level="body3"
                            className="mt-1 text-muted-foreground"
                        >
                            {eta.freshness === 'stale'
                                ? 'Zadnja procjena rute:'
                                : 'Procjena izračunata:'}{' '}
                            <time dateTime={eta.calculatedAt}>
                                {formatDeliveryDateTime(eta.calculatedAt)}
                            </time>
                        </Typography>
                    ) : null}
                </div>
            ) : (
                <Alert
                    aria-label={
                        progress.delayed
                            ? 'Istek odabranog termina'
                            : 'Dostupnost procjene dolaska'
                    }
                    color={progress.delayed ? 'warning' : 'info'}
                    role="group"
                    startDecorator={
                        progress.delayed ? (
                            <Warning className="size-5" />
                        ) : (
                            <Hourglass className="size-5" />
                        )
                    }
                >
                    {progress.delayed
                        ? 'Odabrani termin je prošao, a nova procjena dolaska trenutačno nije dostupna.'
                        : 'Procjena dolaska trenutačno nije dostupna. Odabrani termin ostaje prikazan iznad.'}
                </Alert>
            )}

            <div
                aria-atomic="true"
                aria-live={
                    arrived
                        ? announceArrival
                            ? 'assertive'
                            : undefined
                        : 'polite'
                }
                className="flex items-start gap-2 text-sm"
                role={
                    arrived ? (announceArrival ? 'alert' : undefined) : 'status'
                }
            >
                <Tally3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{progressMessage(progress)}</span>
                {!arrived && routineAnnouncement ? (
                    <span className="sr-only">
                        Ažuriranje statusa: {routineAnnouncement}
                    </span>
                ) : null}
            </div>

            {progress.delayed && hasRange ? (
                <Alert
                    aria-label="Kašnjenje procjene dolaska"
                    color="warning"
                    role="group"
                    startDecorator={<Warning className="size-5" />}
                >
                    Procjena dolaska je nakon završetka odabranog termina.
                </Alert>
            ) : null}
        </div>
    );
}
