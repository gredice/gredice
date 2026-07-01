'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Approved,
    Droplet,
    Fence,
    Leaf,
    Navigate,
    Sprout,
    Timer,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type ComponentType,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import type {
    GardenVisitSummaryDisplayItem,
    GardenVisitSummaryFact,
    GardenVisitSummaryTarget,
} from '../hooks/gardenVisitSummary';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    useGardenVisitSummary,
    useMarkGardenVisitSummarySeen,
} from '../hooks/useGardenVisitSummary';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState } from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';

type GardenVisitSummaryModalProps = {
    enabled: boolean;
    onClosed?: () => void;
};

type GardenVisitSummaryModalContentProps = {
    displayItems: GardenVisitSummaryDisplayItem[];
    isClosing?: boolean;
    onClose: () => void;
    onInspect?: (item: GardenVisitSummaryDisplayItem) => void;
    open: boolean;
};

type SummaryIcon = ComponentType<{
    'aria-hidden'?: boolean;
    className?: string;
}>;

type InspectableSummaryTarget = {
    fieldId?: number | null;
    label: string;
    positionIndex?: number | null;
    raisedBedId: number;
    raisedBedName?: string | null;
};

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

function hasRaisedBedId(
    target: GardenVisitSummaryTarget,
): target is GardenVisitSummaryTarget & { raisedBedId: number } {
    return target.raisedBedId != null;
}

function inspectTargetForItem(
    item: GardenVisitSummaryDisplayItem,
): InspectableSummaryTarget | null {
    const targets = item.targets.filter(hasRaisedBedId);
    const firstTarget = targets[0];
    if (!firstTarget) {
        return null;
    }

    const sameRaisedBed = targets.every(
        (target) => target.raisedBedId === firstTarget.raisedBedId,
    );
    if (!sameRaisedBed) {
        return null;
    }

    const preciseTarget = targets.length === 1 ? firstTarget : null;
    const positionIndex = preciseTarget?.positionIndex ?? null;
    const fieldId = preciseTarget?.fieldId ?? null;
    const label =
        positionIndex != null
            ? `Polje ${(positionIndex + 1).toString()}`
            : (firstTarget.raisedBedName ?? 'Gredica');

    return {
        fieldId,
        label,
        positionIndex,
        raisedBedId: firstTarget.raisedBedId,
        raisedBedName: firstTarget.raisedBedName ?? null,
    };
}

function dismissalKeyForSummary(
    factsHash: string | null,
    displayItems: GardenVisitSummaryDisplayItem[],
) {
    if (factsHash !== null) {
        return `hash:${factsHash}`;
    }

    if (displayItems.length === 0) {
        return null;
    }

    return `items:${displayItems.map((item) => item.id).join('|')}`;
}

export function GardenVisitSummaryModal({
    enabled,
    onClosed,
}: GardenVisitSummaryModalProps) {
    const summary = useGardenVisitSummary({ enabled });
    const markSeen = useMarkGardenVisitSummarySeen();
    const { data: currentGarden } = useCurrentGarden();
    const setGardenVisitSummaryHighlight = useGameState(
        (state) => state.setGardenVisitSummaryHighlight,
    );
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const [dismissedSummaryKey, setDismissedSummaryKey] = useState<
        string | null
    >(null);
    const emptySummarySeenRequestKeyRef = useRef<string | null>(null);
    const closingSummaryKeyRef = useRef<string | null>(null);
    const currentFactsHash = summary.factsHash ?? null;
    const currentDismissalKey = dismissalKeyForSummary(
        currentFactsHash,
        summary.displayItems,
    );
    const hasCurrentDismissal =
        currentDismissalKey !== null &&
        dismissedSummaryKey === currentDismissalKey;
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
            setDismissedSummaryKey(null);
            emptySummarySeenRequestKeyRef.current = null;
            closingSummaryKeyRef.current = null;
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

        if (summary.isError) {
            completeFlow();
            return;
        }

        if (!summary.hasDisplayItems) {
            const requestKey = currentFactsHash ?? 'empty-summary';
            if (
                markSeen.isPending ||
                emptySummarySeenRequestKeyRef.current === requestKey
            ) {
                return;
            }

            emptySummarySeenRequestKeyRef.current = requestKey;
            markSeen.mutate(
                { factsHash: currentFactsHash },
                {
                    onError: (error) => {
                        console.error(
                            'Failed to mark empty garden visit summary seen',
                            error,
                        );
                        completeFlow();
                    },
                    onSuccess: () => {
                        completeFlow();
                    },
                },
            );
        }
    }, [
        completeFlow,
        currentFactsHash,
        enabled,
        markSeen,
        summary.canLoadSummary,
        summary.gardenReady,
        summary.hasDisplayItems,
        summary.isError,
        summary.isFetching,
        summary.isPending,
    ]);

    const closeSummary = useCallback(
        (afterClose?: () => void) => {
            if (
                currentDismissalKey === null ||
                closingSummaryKeyRef.current === currentDismissalKey
            ) {
                return;
            }

            closingSummaryKeyRef.current = currentDismissalKey;
            setDismissedSummaryKey(currentDismissalKey);
            afterClose?.();
            completeFlow();

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
                        if (
                            closingSummaryKeyRef.current === currentDismissalKey
                        ) {
                            closingSummaryKeyRef.current = null;
                        }
                    },
                },
            );
        },
        [completeFlow, currentDismissalKey, currentFactsHash, markSeen],
    );

    const handleInspect = (item: GardenVisitSummaryDisplayItem) => {
        const target = inspectTargetForItem(item);
        if (!target || !currentGarden) {
            return;
        }

        const raisedBedName =
            target.raisedBedName ??
            currentGarden.raisedBeds.find(
                (raisedBed) => raisedBed.id === target.raisedBedId,
            )?.name ??
            null;
        if (!raisedBedName) {
            return;
        }

        closeSummary(() => {
            setGardenVisitSummaryHighlight({
                fieldId: target.fieldId,
                gardenId: currentGarden.id,
                label: target.label,
                message: item.message,
                positionIndex: target.positionIndex,
                raisedBedId: target.raisedBedId,
                raisedBedName: target.raisedBedName,
            });
            setRaisedBedCloseupParam(raisedBedName, target.positionIndex);
        });
    };

    const handleClose = () => {
        closeSummary();
    };

    return (
        <GardenVisitSummaryModalContent
            displayItems={summary.displayItems}
            onClose={handleClose}
            onInspect={handleInspect}
            open={open}
        />
    );
}

export function GardenVisitSummaryModalContent({
    displayItems,
    isClosing = false,
    onClose,
    onInspect,
    open,
}: GardenVisitSummaryModalContentProps) {
    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (open && !nextOpen && !isClosing) {
                onClose();
            }
        },
        [isClosing, onClose, open],
    );

    return (
        <GameModal
            title="Od zadnjeg posjeta"
            open={open}
            onOpenChange={handleOpenChange}
            className="max-w-xl overflow-hidden p-0"
            dismissible={!isClosing}
            hideClose
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
                            const inspectTarget =
                                onInspect && inspectTargetForItem(item);

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
                                        <Row
                                            alignItems="center"
                                            className="flex-wrap"
                                            spacing={1}
                                        >
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
                                            {inspectTarget ? (
                                                <Button
                                                    aria-label={`Prikaži u vrtu: ${item.message}`}
                                                    color="primary"
                                                    disabled={isClosing}
                                                    onClick={() =>
                                                        onInspect(item)
                                                    }
                                                    size="xs"
                                                    startDecorator={
                                                        <Navigate
                                                            aria-hidden
                                                            className="size-3"
                                                        />
                                                    }
                                                    variant="plain"
                                                >
                                                    Prikaži u vrtu
                                                </Button>
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
        </GameModal>
    );
}
