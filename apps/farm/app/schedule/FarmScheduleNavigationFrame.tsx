'use client';

import { Left, Navigate } from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { FarmScheduleSectionSkeleton } from './FarmScheduleSectionSkeleton';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';
import { getFarmScheduleDateKey } from './scheduleShared';

interface FarmScheduleNavigationFrameProps {
    children: ReactNode;
    labelPrintSlot: ReactNode;
    selectedDateKey: string;
    summarySlot: ReactNode;
}

function formatDateParam(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date();
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getOffsetDate(date: Date, offset: number) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + offset);
    return newDate;
}

function buildScheduleHref(dateKey: string) {
    return `/schedule?date=${dateKey}` as Route;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
    return (
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
    );
}

function FarmSchedulePendingSections() {
    return (
        <Stack spacing={8} aria-hidden="true">
            <FarmScheduleSectionSkeleton />
            <FarmScheduleSectionSkeleton />
            <FarmScheduleSectionSkeleton />
        </Stack>
    );
}

export function FarmScheduleNavigationFrame({
    children,
    labelPrintSlot,
    selectedDateKey,
    summarySlot,
}: FarmScheduleNavigationFrameProps) {
    const router = useRouter();
    const [isRoutePending, startTransition] = useTransition();
    const [optimisticDateKey, setOptimisticDateKey] = useState(selectedDateKey);
    const [hasPendingNavigation, setHasPendingNavigation] = useState(false);

    useEffect(() => {
        setOptimisticDateKey(selectedDateKey);
        setHasPendingNavigation(false);
    }, [selectedDateKey]);

    const date = parseDateKey(optimisticDateKey);
    const dayOfWeek = new Intl.DateTimeFormat('hr-HR', {
        weekday: 'long',
    }).format(date);
    const dateFormatted = new Intl.DateTimeFormat('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
    const isToday = getFarmScheduleDateKey(new Date()) === optimisticDateKey;

    const prevDateKey = formatDateParam(getOffsetDate(date, -1));
    const nextDateKey = formatDateParam(getOffsetDate(date, 1));
    const prevHref = buildScheduleHref(prevDateKey);
    const nextHref = buildScheduleHref(nextDateKey);
    const showPendingContent = hasPendingNavigation || isRoutePending;

    useEffect(() => {
        router.prefetch(prevHref);
        router.prefetch(nextHref);
    }, [nextHref, prevHref, router]);

    function navigateToDate(
        event: MouseEvent<HTMLAnchorElement>,
        dateKey: string,
        href: Route,
    ) {
        if (event.defaultPrevented || isModifiedClick(event)) {
            return;
        }

        event.preventDefault();
        setOptimisticDateKey(dateKey);
        setHasPendingNavigation(true);
        startTransition(() => {
            router.push(href);
        });
    }

    return (
        <div
            className="max-w-5xl mx-auto w-full space-y-4 px-2 py-4 sm:p-4"
            aria-busy={showPendingContent}
        >
            <div className="space-y-2">
                <Typography component="h1" level="h5" semiBold>
                    Raspored
                </Typography>
                <div className="grid min-w-0 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 justify-self-center sm:justify-self-start">
                        <Row className="shrink-0 gap-1 sm:gap-2">
                            <Link
                                href={prevHref}
                                title="Prethodni dan"
                                aria-label="Prethodni dan"
                                onClick={(event) =>
                                    navigateToDate(event, prevDateKey, prevHref)
                                }
                                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:p-2"
                            >
                                <Left className="size-4 shrink-0" />
                            </Link>
                            <div className="min-w-16 text-center sm:min-w-20">
                                <Typography
                                    level="body2"
                                    semiBold
                                    className="capitalize text-xs leading-tight sm:text-sm"
                                >
                                    {isToday ? 'Danas' : dayOfWeek}
                                </Typography>
                                <Typography
                                    level="body2"
                                    className={cx(
                                        'text-muted-foreground text-xs leading-tight sm:text-sm',
                                        showPendingContent && 'animate-pulse',
                                    )}
                                >
                                    {dateFormatted}
                                </Typography>
                            </div>
                            <Link
                                href={nextHref}
                                title="Sljedeći dan"
                                aria-label="Sljedeći dan"
                                onClick={(event) =>
                                    navigateToDate(event, nextDateKey, nextHref)
                                }
                                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:p-2"
                            >
                                <Navigate className="size-4 shrink-0" />
                            </Link>
                        </Row>
                    </div>
                    <div className="min-w-0 justify-self-stretch sm:justify-self-end">
                        {showPendingContent ? (
                            <ScheduleDaySummarySkeleton />
                        ) : (
                            summarySlot
                        )}
                    </div>
                </div>
                <div className="flex min-w-0 justify-end">
                    {showPendingContent ? null : labelPrintSlot}
                </div>
            </div>
            {showPendingContent ? <FarmSchedulePendingSections /> : children}
        </div>
    );
}
