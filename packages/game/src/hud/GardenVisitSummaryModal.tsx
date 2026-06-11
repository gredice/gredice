'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    Droplet,
    Fence,
    Leaf,
    Sprout,
    Timer,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ComponentType, useCallback, useEffect, useState } from 'react';
import type {
    GardenVisitSummaryDisplayItem,
    GardenVisitSummaryFact,
} from '../hooks/gardenVisitSummary';
import {
    useGardenVisitSummary,
    useMarkGardenVisitSummarySeen,
} from '../hooks/useGardenVisitSummary';

type GardenVisitSummaryModalProps = {
    enabled: boolean;
    onClosed?: () => void;
};

type GardenVisitSummaryModalContentProps = {
    displayItems: GardenVisitSummaryDisplayItem[];
    isClosing?: boolean;
    onClose: () => void;
    open: boolean;
};

type SummaryIcon = ComponentType<{
    'aria-hidden'?: boolean;
    className?: string;
}>;

const summaryTypeMeta = {
    plantGrowth: {
        chip: 'Rast',
        color: 'success',
        icon: Sprout,
    },
    operationCompleted: {
        chip: 'Radnja',
        color: 'info',
        icon: Approved,
    },
    drySoil: {
        chip: 'Tlo',
        color: 'warning',
        icon: Droplet,
    },
    weed: {
        chip: 'Korov',
        color: 'neutral',
        icon: Leaf,
    },
    supportNeeded: {
        chip: 'Potpora',
        color: 'info',
        icon: Fence,
    },
    harvestWindow: {
        chip: 'Berba',
        color: 'success',
        icon: Timer,
    },
} satisfies Record<
    GardenVisitSummaryFact['type'],
    {
        chip: string;
        color: 'info' | 'neutral' | 'success' | 'warning';
        icon: SummaryIcon;
    }
>;

function targetLabel(targets: NonNullable<GardenVisitSummaryFact['target']>[]) {
    if (targets.length === 0) {
        return null;
    }

    if (targets.length > 1) {
        return targets.some((target) => target.fieldId != null)
            ? `${targets.length.toString()} polja`
            : `${targets.length.toString()} gredice`;
    }

    const target = targets[0];
    if (target.positionIndex != null) {
        return `Polje ${(target.positionIndex + 1).toString()}`;
    }

    return target.raisedBedName || 'Gredica';
}

export function GardenVisitSummaryModal({
    enabled,
    onClosed,
}: GardenVisitSummaryModalProps) {
    const summary = useGardenVisitSummary({ enabled });
    const markSeen = useMarkGardenVisitSummarySeen();
    const [dismissedFactsHash, setDismissedFactsHash] = useState<string | null>(
        null,
    );
    const currentFactsHash = summary.factsHash ?? null;
    const hasCurrentDismissal =
        currentFactsHash !== null && dismissedFactsHash === currentFactsHash;
    const open =
        enabled &&
        summary.hasDisplayItems &&
        summary.isSuccess &&
        !hasCurrentDismissal;

    const completeFlow = useCallback(() => {
        onClosed?.();
    }, [onClosed]);

    useEffect(() => {
        if (!enabled) {
            setDismissedFactsHash(null);
            return;
        }

        if (!summary.gardenReady) {
            return;
        }

        if (!summary.canLoadSummary) {
            completeFlow();
            return;
        }

        if (summary.isPending || summary.isFetching) {
            return;
        }

        if (summary.isError || !summary.hasDisplayItems) {
            completeFlow();
        }
    }, [
        completeFlow,
        enabled,
        summary.canLoadSummary,
        summary.gardenReady,
        summary.hasDisplayItems,
        summary.isError,
        summary.isFetching,
        summary.isPending,
    ]);

    const handleClose = () => {
        setDismissedFactsHash(currentFactsHash);
        markSeen.mutate(
            { factsHash: currentFactsHash },
            {
                onError: (error) => {
                    console.error(
                        'Failed to mark garden visit summary seen',
                        error,
                    );
                },
                onSettled: () => {
                    completeFlow();
                },
            },
        );
    };

    return (
        <GardenVisitSummaryModalContent
            displayItems={summary.displayItems}
            isClosing={markSeen.isPending}
            onClose={handleClose}
            open={open}
        />
    );
}

export function GardenVisitSummaryModalContent({
    displayItems,
    isClosing = false,
    onClose,
    open,
}: GardenVisitSummaryModalContentProps) {
    return (
        <Modal
            title="Od zadnjeg posjeta"
            open={open}
            className="max-w-xl overflow-hidden border-tertiary border-b-4 p-0"
            dismissible={false}
        >
            <div className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col">
                <Row
                    className="shrink-0 border-b px-4 py-3 pr-4"
                    justifyContent="space-between"
                    spacing={3}
                >
                    <Stack spacing={0.5}>
                        <Typography level="body3" secondary>
                            Pregled vrta
                        </Typography>
                        <Typography level="h4" component="h2">
                            Od zadnjeg posjeta
                        </Typography>
                    </Stack>
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-tertiary/60 bg-card text-tertiary-foreground">
                        <Sprout aria-hidden className="size-5" />
                    </div>
                </Row>
                <div className="min-h-0 overflow-y-auto p-3 md:p-4">
                    <Stack spacing={2}>
                        {displayItems.map((item) => {
                            const meta = summaryTypeMeta[item.type];
                            const Icon = meta.icon;
                            const label = targetLabel(item.targets);

                            return (
                                <Row
                                    alignItems="start"
                                    className="min-w-0 rounded-lg border border-border/70 bg-card/70 p-3"
                                    key={item.id}
                                    spacing={3}
                                >
                                    <span
                                        className={cx(
                                            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border',
                                            item.type === 'drySoil'
                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                                                : 'bg-muted text-foreground',
                                        )}
                                    >
                                        <Icon aria-hidden className="size-4" />
                                    </span>
                                    <Stack
                                        className="min-w-0 flex-1"
                                        spacing={1}
                                    >
                                        <Typography
                                            className="min-w-0"
                                            level="body2"
                                            semiBold
                                        >
                                            {item.message}
                                        </Typography>
                                        <Row className="flex-wrap" spacing={1}>
                                            <Chip
                                                color={meta.color}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {meta.chip}
                                            </Chip>
                                            {label ? (
                                                <Chip
                                                    color="neutral"
                                                    size="sm"
                                                    variant="outlined"
                                                >
                                                    {label}
                                                </Chip>
                                            ) : null}
                                        </Row>
                                    </Stack>
                                </Row>
                            );
                        })}
                    </Stack>
                </div>
                <Row
                    className="shrink-0 border-t p-3 md:p-4"
                    justifyContent="end"
                >
                    <Button
                        disabled={isClosing}
                        loading={isClosing}
                        onClick={onClose}
                    >
                        Kreni u obilazak
                    </Button>
                </Row>
            </div>
        </Modal>
    );
}
