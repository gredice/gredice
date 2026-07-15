'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Device, Reset, Sun, Warning } from '@gredice/ui/icons';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import type { DriverRouteWakeLockState } from '../hooks/useDriverRouteWakeLock';

function continuityMessage(
    state: DriverRouteWakeLockState,
    trackingAvailable: boolean,
) {
    if (!trackingAvailable) {
        const screenMessage =
            state.status === 'unsupported'
                ? 'Ovaj preglednik ne može spriječiti automatsko gašenje zaslona. Drži izvanmrežnu rutu otvorenom i zaslon uključenim ručno.'
                : state.status === 'requesting'
                  ? 'Preglednik obrađuje zahtjev da zaslon ostane uključen za rad s izvanmrežnom rutom.'
                  : state.status === 'active'
                    ? 'Zaslon ostaje uključen za rad s izvanmrežnom rutom.'
                    : state.status === 'paused'
                      ? 'Održavanje zaslona uključenim je pauzirano jer izvanmrežna ruta nije vidljiva.'
                      : state.status === 'error'
                        ? 'Preglednik nije zadržao zaslon uključenim. Drži izvanmrežnu rutu vidljivom i pokušaj ponovno.'
                        : state.status === 'off'
                          ? 'Po želji zadrži zaslon uključenim za rad s izvanmrežnom rutom.'
                          : '';
        return screenMessage
            ? `${screenMessage} GPS praćenje nije aktivno dok se ne učita stanje poslužitelja.`
            : '';
    }
    switch (state.status) {
        case 'unsupported':
            return 'Ovaj preglednik ne može spriječiti automatsko gašenje zaslona. Drži rutu otvorenom i zaslon uključenim ručno.';
        case 'off':
            return 'GPS se može pauzirati kada je ruta skrivena ili je zaslon zaključan. Po želji zadrži zaslon uključenim za ovu rutu.';
        case 'requesting':
            return 'Preglednik obrađuje zahtjev da zaslon ostane uključen.';
        case 'active':
            return 'Zaslon ostaje uključen dok je ova ruta vidljiva. Prelazak u drugu aplikaciju i dalje može pauzirati GPS.';
        case 'paused':
            return 'Održavanje zaslona uključenim je pauzirano jer ruta nije vidljiva. Ponovno će se zatražiti nakon povratka.';
        case 'error':
            return 'Preglednik nije zadržao zaslon uključenim. Drži rutu vidljivom i pokušaj ponovno.';
        case 'inactive':
            return '';
    }
}

export function DriverRouteContinuity({
    state,
    trackingAvailable = true,
}: {
    state: DriverRouteWakeLockState;
    trackingAvailable?: boolean;
}) {
    if (state.status === 'inactive') return null;
    const active = state.status === 'active';
    const unavailable = state.status === 'unsupported';
    const failed = state.status === 'error';
    const color =
        active && trackingAvailable
            ? 'success'
            : failed || unavailable
              ? 'warning'
              : 'info';
    const announcement = active
        ? trackingAvailable
            ? 'Zaslon ostaje uključen za ovu aktivnu rutu.'
            : 'Zaslon ostaje uključen za izvanmrežnu rutu. GPS praćenje nije aktivno.'
        : failed
          ? 'Zaslon nije zadržan uključenim.'
          : unavailable
            ? 'Preglednik ne podržava održavanje zaslona uključenim.'
            : state.status === 'paused'
              ? 'Održavanje zaslona uključenim je pauzirano.'
              : null;

    return (
        <Alert
            aria-label="Vidljivost rute i zaslona"
            color={color}
            data-wake-lock-status={state.status}
            role="group"
            startDecorator={
                active ? (
                    <Sun className="size-5" />
                ) : failed || unavailable ? (
                    <Warning className="size-5" />
                ) : (
                    <Device className="size-5" />
                )
            }
        >
            <span className="sr-only" aria-live="polite" role="status">
                {announcement ?? ''}
            </span>
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                    <Typography level="body2" semiBold>
                        Vidljivost rute
                    </Typography>
                    <Typography className="mt-1" level="body2">
                        {continuityMessage(state, trackingAvailable)}
                    </Typography>
                </div>
                <div className="grid min-w-0 gap-2 sm:w-80">
                    <div className="min-w-0">
                        <Switch
                            checked={state.consented}
                            description="Vrijedi samo za ovu aktivnu rutu i može povećati potrošnju baterije. Ne omogućuje GPS praćenje u pozadini."
                            disabled={unavailable}
                            label="Drži zaslon uključenim"
                            size="md"
                            onCheckedChange={(checked) =>
                                checked ? state.enable() : state.disable()
                            }
                        />
                    </div>
                    {failed ? (
                        <Button
                            className="justify-self-start"
                            color="warning"
                            size="sm"
                            startDecorator={<Reset className="size-4" />}
                            variant="soft"
                            onClick={state.retry}
                        >
                            Pokušaj ponovno
                        </Button>
                    ) : null}
                </div>
            </div>
        </Alert>
    );
}
