'use client';

import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

type ErrorFallbackProps = {
    correlationId: string;
    onRetry: () => void;
    variant?: 'page' | 'global';
};

export function ErrorFallback({
    correlationId,
    onRetry,
    variant = 'page',
}: ErrorFallbackProps) {
    const title =
        variant === 'global'
            ? 'Dogodila se kritična greška'
            : 'Dogodila se greška';

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="flex max-w-3xl gap-8 md:flex-row flex-col items-center text-center md:text-left">
                {/* biome-ignore lint/performance/noImgElement: error fallback must not depend on next/image remotePatterns config, otherwise a misconfig can crash the boundary itself */}
                <img
                    src="https://cdn.gredice.com/sunflower-sad-500x500.png"
                    alt="Greška aplikacije"
                    className="rounded-xl bg-card shadow-xl"
                    width={200}
                    height={200}
                />
                <Stack spacing={2}>
                    <Typography level="h1">{title}</Typography>
                    <Typography level="body1">
                        Oprosti, nešto je pošlo po krivu. Možeš pokušati ponovno
                        ili se vratiti na početnu stranicu.
                    </Typography>
                    <Typography level="body3" className="break-all">
                        Referenca greške: {correlationId}
                    </Typography>
                    <Row
                        className="justify-center md:justify-start"
                        spacing={1}
                    >
                        <Button type="button" onClick={onRetry}>
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
