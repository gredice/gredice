'use client';

import { Chip } from '@gredice/ui/Chip';
import { Collapse } from '@gredice/ui/Collapse';
import { ExpandDown } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useState } from 'react';
import {
    type OperationsListDayBubbles as OperationsListDayBubblesModel,
    type OperationsListDayCounts,
    operationsListDayCountsLabel,
    operationsListDayLabel,
} from '../../app/admin/operations/operationsListGrouping';
import { OperationsDayBubbles } from './OperationsDayBubbles';

const collapseDurationMs = 200;

export function OperationsDayGroup({
    bubbles,
    children,
    counts,
    dayKey,
    isExpanded,
    isToday,
    onToggle,
}: {
    bubbles: OperationsListDayBubblesModel;
    children: ReactNode;
    counts: OperationsListDayCounts;
    dayKey: string;
    isExpanded: boolean;
    isToday?: boolean;
    onToggle: (dayKey: string) => void;
}) {
    // Collapsed days keep their rows unmounted so a long list does not pay for
    // rows nobody looks at. The unmount waits out the collapse animation.
    const [isContentMounted, setIsContentMounted] = useState(isExpanded);
    const contentId = `operations-day-${dayKey}`;

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
        <li className="min-w-0">
            <button
                type="button"
                aria-controls={contentId}
                aria-expanded={isExpanded}
                onClick={() => onToggle(dayKey)}
                className={cx(
                    'group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4',
                    isExpanded && 'bg-muted/30',
                )}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 truncate font-medium first-letter:uppercase">
                                {operationsListDayLabel(dayKey)}
                            </span>
                            {isToday ? (
                                <Chip color="info" size="sm">
                                    Danas
                                </Chip>
                            ) : null}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="max-w-full truncate">
                                {operationsListDayCountsLabel(counts)}
                            </span>
                        </div>
                    </Stack>
                    <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
                        <OperationsDayBubbles
                            bubbles={bubbles.bubbles}
                            overflowCount={bubbles.overflowCount}
                        />
                    </div>
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
                    <ul id={contentId} className="divide-y border-t bg-card">
                        {children}
                    </ul>
                ) : null}
            </Collapse>
        </li>
    );
}
