'use client';

import { Button } from '@gredice/ui/Button';
import { Close, Sprout } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';

const highlightDurationMs = 9000;

export function GardenVisitSummaryHighlightHud() {
    const highlight = useGameState(
        (state) => state.gardenVisitSummaryHighlight,
    );
    const clearHighlight = useGameState(
        (state) => state.clearGardenVisitSummaryHighlight,
    );
    const { data: currentGarden } = useCurrentGarden();
    const currentGardenId = currentGarden?.id ?? null;

    useEffect(() => {
        if (!highlight) {
            return;
        }

        const timeout = window.setTimeout(clearHighlight, highlightDurationMs);

        return () => window.clearTimeout(timeout);
    }, [clearHighlight, highlight]);

    useEffect(() => {
        if (
            highlight?.gardenId != null &&
            currentGardenId != null &&
            highlight.gardenId !== currentGardenId
        ) {
            clearHighlight();
        }
    }, [clearHighlight, currentGardenId, highlight]);

    if (!highlight) {
        return null;
    }

    const locationLabel =
        highlight.raisedBedName && highlight.raisedBedName !== highlight.label
            ? `${highlight.raisedBedName} · ${highlight.label}`
            : highlight.label;

    return (
        <div className="pointer-events-none absolute top-[calc(var(--game-safe-area-top,0px)+4rem)] left-[var(--game-safe-area-left,0px)] right-[var(--game-safe-area-right,0px)] z-20 flex justify-center px-2">
            <Row
                alignItems="center"
                className="pointer-events-auto w-full max-w-[26rem] rounded-lg border border-tertiary/50 bg-background/95 p-2 pr-1 shadow-lg backdrop-blur"
                spacing={2}
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-tertiary-foreground">
                    <Sprout aria-hidden className="size-4" />
                </span>
                <Stack className="min-w-0 flex-1" spacing={0}>
                    <Typography level="body3" secondary>
                        Prikaz u vrtu
                    </Typography>
                    <Typography className="truncate" level="body2" semiBold>
                        {locationLabel}
                    </Typography>
                    <Typography className="truncate" level="body3" secondary>
                        {highlight.message}
                    </Typography>
                </Stack>
                <Button
                    aria-label="Sakrij oznaku"
                    className="size-8 shrink-0 px-0"
                    onClick={clearHighlight}
                    size="sm"
                    variant="plain"
                >
                    <Close aria-hidden className="size-4" />
                </Button>
            </Row>
        </div>
    );
}
