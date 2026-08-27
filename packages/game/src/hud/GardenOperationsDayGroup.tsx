import { Chip } from '@gredice/ui/Chip';
import { Collapse } from '@gredice/ui/Collapse';
import { ExpandDown } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useState } from 'react';
import {
    type GardenOperationsBubbleItem,
    GardenOperationsDayBubbles,
} from './GardenOperationsDayBubbles';
import {
    type GardenOperationsDayBubbles as GardenOperationsDayBubblesModel,
    type GardenOperationsDayCounts,
    gardenOperationsDayCountsLabel,
    gardenOperationsDayLabel,
} from './gardenOperationsDayGrouping';

const collapseDurationMs = 200;

export function GardenOperationsDayGroup({
    bubbles,
    children,
    counts,
    dayKey,
    isExpanded,
    isToday,
    onToggle,
}: {
    bubbles: GardenOperationsDayBubblesModel<GardenOperationsBubbleItem>;
    children: ReactNode;
    counts: GardenOperationsDayCounts;
    dayKey: string;
    isExpanded: boolean;
    isToday?: boolean;
    onToggle: (dayKey: string) => void;
}) {
    // Collapsed days keep their cards unmounted so a long history does not pay
    // for cards nobody looks at. The unmount waits out the collapse animation.
    const [isContentMounted, setIsContentMounted] = useState(isExpanded);
    const contentId = `garden-operations-day-${dayKey}`;

    useEffect(() => {
        if (isExpanded) {
            setIsContentMounted(true);
            return;
        }

        const timeout = setTimeout(
            () => setIsContentMounted(false),
            collapseDurationMs,
        );

        return () => clearTimeout(timeout);
    }, [isExpanded]);

    return (
        <div
            className="w-full min-w-0 max-w-full"
            data-garden-operations-day-group
        >
            <button
                type="button"
                aria-controls={contentId}
                aria-expanded={isExpanded}
                onClick={() => onToggle(dayKey)}
                className={cx(
                    'flex w-full min-w-0 items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50',
                    isExpanded && 'bg-muted/30',
                )}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Stack spacing={0.5} className="min-w-0 flex-1">
                        <Row spacing={1.5} className="min-w-0 flex-wrap">
                            <Typography
                                level="body2"
                                semiBold
                                className="min-w-0 truncate first-letter:uppercase"
                            >
                                {gardenOperationsDayLabel(dayKey)}
                            </Typography>
                            {isToday ? (
                                <Chip color="info" size="sm">
                                    Danas
                                </Chip>
                            ) : null}
                        </Row>
                        <Typography level="body3" secondary noWrap>
                            {gardenOperationsDayCountsLabel(counts)}
                        </Typography>
                    </Stack>
                    <GardenOperationsDayBubbles
                        bubbles={bubbles.bubbles}
                        overflowCount={bubbles.overflowCount}
                    />
                </div>
                <ExpandDown
                    aria-hidden="true"
                    className={cx(
                        'mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180',
                    )}
                />
            </button>
            <Collapse appear={isExpanded} duration={collapseDurationMs}>
                {isContentMounted ? (
                    <Stack spacing={2} id={contentId} className="pt-2 pb-1">
                        {children}
                    </Stack>
                ) : null}
            </Collapse>
        </div>
    );
}
