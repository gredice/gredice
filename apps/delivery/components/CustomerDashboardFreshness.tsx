'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { LoaderSpinner, Reset, Success, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useRef, useState } from 'react';
import type { CustomerDashboardFreshnessFailure } from '../lib/customerDashboardFreshness';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

export type { CustomerDashboardFreshnessFailure } from '../lib/customerDashboardFreshness';

export function CustomerDashboardFreshness({
    failure,
    refreshedAt,
    onRetry,
}: {
    failure: CustomerDashboardFreshnessFailure;
    refreshedAt: string;
    onRetry: () => Promise<boolean>;
}) {
    const stale = failure !== null;
    const previousStaleRef = useRef(stale);
    const manualRetryRef = useRef(false);
    const recoveredRef = useRef<HTMLDivElement>(null);
    const [retrying, setRetrying] = useState(false);
    const [retryFailed, setRetryFailed] = useState(false);
    const [showRecovered, setShowRecovered] = useState(false);

    useEffect(() => {
        const wasStale = previousStaleRef.current;
        previousStaleRef.current = stale;
        if (stale) {
            setShowRecovered(false);
            return;
        }
        if (!wasStale) return;

        setRetryFailed(false);
        setShowRecovered(true);
        const focusRecovery = manualRetryRef.current;
        manualRetryRef.current = false;
        if (focusRecovery) {
            window.requestAnimationFrame(() => recoveredRef.current?.focus());
        }
    }, [stale]);

    const retry = async () => {
        if (retrying) return;
        manualRetryRef.current = true;
        setRetryFailed(false);
        setRetrying(true);
        let recovered = false;
        try {
            recovered = await onRetry();
        } catch {
            recovered = false;
        } finally {
            setRetrying(false);
            if (!recovered) {
                manualRetryRef.current = false;
                setRetryFailed(true);
            }
        }
    };

    if (stale) {
        return (
            <div className="space-y-2">
                <Alert
                    aria-atomic="true"
                    color="warning"
                    role="alert"
                    startDecorator={<Warning className="size-5" />}
                >
                    <div>
                        <Typography level="body2" semiBold>
                            Podaci nisu ažurni
                        </Typography>
                        <Typography level="body3" className="mt-1">
                            {failure === 'offline'
                                ? 'Uređaj je izvan mreže. Prikazujemo zadnje potvrđene podatke.'
                                : 'Osvježavanje nije uspjelo. Prikazujemo zadnje potvrđene podatke.'}
                        </Typography>
                        <Typography
                            level="body3"
                            className="mt-1 text-muted-foreground"
                        >
                            Zadnje uspješno osvježavanje:{' '}
                            <time dateTime={refreshedAt}>
                                {formatDeliveryDateTime(refreshedAt)}
                            </time>
                        </Typography>
                    </div>
                </Alert>
                <Button
                    aria-busy={retrying}
                    aria-label="Osvježi podatke"
                    className="min-h-11"
                    disabled={retrying}
                    size="sm"
                    startDecorator={
                        retrying ? (
                            <LoaderSpinner className="size-4 animate-spin" />
                        ) : (
                            <Reset className="size-4" />
                        )
                    }
                    variant="outlined"
                    onClick={() => void retry()}
                >
                    {retrying ? 'Osvježavanje…' : 'Osvježi podatke'}
                </Button>
                {retryFailed ? (
                    <div
                        aria-atomic="true"
                        aria-label="Osvježavanje nije uspjelo"
                        aria-live="polite"
                        className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
                        role="status"
                    >
                        Osvježavanje nije uspjelo. Spremljeni podaci ostaju
                        prikazani; pokušaj ponovno kad veza bude dostupna.
                    </div>
                ) : null}
            </div>
        );
    }

    if (!showRecovered) return null;

    return (
        <div
            ref={recoveredRef}
            aria-atomic="true"
            aria-label="Podaci su ponovno ažurni"
            aria-live="polite"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="status"
            tabIndex={-1}
        >
            <Alert
                color="success"
                role="group"
                startDecorator={<Success className="size-5" />}
            >
                Veza je obnovljena. Prikazani podaci ponovno su ažurni.
            </Alert>
        </div>
    );
}
