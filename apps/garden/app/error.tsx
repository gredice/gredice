'use client';

import { usePostHog } from '@posthog/next';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useEffect, useMemo } from 'react';

type ErrorPageProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

function generateCorrelationId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    const posthog = usePostHog();
    const correlationId = useMemo(() => generateCorrelationId(), []);

    useEffect(() => {
        posthog?.capture('ui_runtime_error', {
            correlation_id: correlationId,
            digest: error.digest,
            message: error.message,
            name: error.name,
            stack: error.stack,
            pathname:
                typeof window !== 'undefined'
                    ? window.location.pathname
                    : undefined,
        });

        console.error('[ui_runtime_error]', {
            correlationId,
            digest: error.digest,
            error,
        });
    }, [correlationId, error, posthog]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="flex max-w-3xl gap-8 md:flex-row flex-col items-center text-center md:text-left">
                <Image
                    src="https://cdn.gredice.com/sunflower-sad-500x500.png"
                    alt="Greška aplikacije"
                    className="rounded-xl bg-card shadow-xl"
                    width={200}
                    height={200}
                    priority
                />
                <Stack spacing={2}>
                    <Typography level="h1">Dogodila se greška</Typography>
                    <Typography level="body1">
                        Oprosti, nešto je pošlo po krivu. Možeš pokušati ponovno
                        ili se vratiti na početnu stranicu.
                    </Typography>
                    <Typography
                        level="body2"
                        className="break-all text-muted-foreground"
                    >
                        Referenca greške: {correlationId}
                    </Typography>
                    <Row
                        className="justify-center md:justify-start"
                        spacing={1}
                    >
                        <Button type="button" onClick={reset}>
                            Pokušaj ponovno
                        </Button>
                        <NavigatingButton href="/">
                            Idi na početnu
                        </NavigatingButton>
                    </Row>
                </Stack>
            </div>
        </div>
    );
}
