'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../Alert';
import { IconButton } from '../IconButton';
import { ArrowLeft, ArrowRight, Calendar } from '../icons';
import { Popper } from '../Popper';
import { Row } from '../Row';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type EventCalendarEntryTone =
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'completed'
    | 'scheduled'
    | 'cart'
    | 'preview';

export type EventCalendarEntry = {
    id: string;
    date: Date | string;
    label: string;
    meta?: ReactNode;
    tone?: EventCalendarEntryTone;
    weight?: number | null;
};

export type EventCalendarDayTone = EventCalendarEntryTone | 'none';

export type EventCalendarDay = {
    key: string;
    date: Date;
    dayOfMonth: number;
    entries: EventCalendarEntry[];
    markerSize: number;
    tone: EventCalendarDayTone;
    totalWeight: number;
};

export type EventCalendarMonth = {
    key: string;
    date: Date;
    weeks: Array<Array<EventCalendarDay | null>>;
};

type EventCalendarProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'children' | 'onSelect'
> & {
    entries: EventCalendarEntry[];
    emptyLabel?: ReactNode;
    error?: boolean;
    errorLabel?: ReactNode;
    isDateDisabled?: (date: Date) => boolean;
    isLoading?: boolean;
    loadingLabel?: ReactNode;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    onDateSelect?: (date: Date) => void;
    referenceDate?: Date;
    selectedDate?: Date | null;
    visibleFrom?: Date;
    visibleTo?: Date;
};

const weekDays = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const minimumMarkerSize = 16;
const defaultMarkerSize = 22;
const maximumMarkerSize = 30;
const fallbackEntryWeight = 1;

const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const tonePriority = [
    'preview',
    'cart',
    'danger',
    'warning',
    'scheduled',
    'info',
    'success',
    'completed',
    'neutral',
] satisfies EventCalendarEntryTone[];

const markerClassNames = {
    neutral:
        'bg-muted-foreground text-background dark:bg-neutral-500 dark:text-white',
    info: 'bg-sky-600 text-white shadow-sm shadow-sky-300/40',
    success: 'bg-green-600 text-white shadow-sm shadow-green-300/40',
    warning: 'bg-amber-400 text-amber-950 shadow-sm shadow-amber-200/50',
    danger: 'bg-red-600 text-white shadow-sm shadow-red-300/40',
    completed: 'bg-sky-600 text-white shadow-sm shadow-sky-300/40',
    scheduled: 'bg-sky-500 text-white shadow-sm shadow-sky-300/40',
    cart: 'bg-cyan-700 text-white shadow-sm shadow-cyan-300/40',
    preview: 'bg-blue-700 text-white shadow-sm shadow-blue-300/40',
} satisfies Record<EventCalendarEntryTone, string>;

const markerTextClassNames = {
    neutral: 'text-background dark:text-white',
    info: 'text-white',
    success: 'text-white',
    warning: 'text-amber-950',
    danger: 'text-white',
    completed: 'text-white',
    scheduled: 'text-white',
    cart: 'text-white',
    preview: 'text-white',
} satisfies Record<EventCalendarEntryTone, string>;

function parseEventDate(value: Date | string | undefined) {
    if (value === undefined) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfEventCalendarDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function formatEventCalendarDayKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function formatMonthKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
}

function entryWeight(entry: EventCalendarEntry) {
    return typeof entry.weight === 'number' && entry.weight > 0
        ? entry.weight
        : fallbackEntryWeight;
}

function markerSize({
    maximumWeight,
    minimumWeight,
    weight,
}: {
    maximumWeight: number;
    minimumWeight: number;
    weight: number;
}) {
    if (maximumWeight <= minimumWeight) {
        return defaultMarkerSize;
    }

    const ratio = (weight - minimumWeight) / (maximumWeight - minimumWeight);
    return Math.round(
        minimumMarkerSize + ratio * (maximumMarkerSize - minimumMarkerSize),
    );
}

function toneForDay(entries: EventCalendarEntry[]): EventCalendarDayTone {
    if (entries.length === 0) {
        return 'none';
    }

    return (
        tonePriority.find((tone) =>
            entries.some((entry) => (entry.tone ?? 'info') === tone),
        ) ?? 'info'
    );
}

function monthRange({
    entries,
    visibleFrom,
    visibleTo,
}: {
    entries: EventCalendarEntry[];
    visibleFrom?: Date;
    visibleTo?: Date;
}) {
    const dates = [
        ...entries
            .map((entry) => parseEventDate(entry.date))
            .filter((date): date is Date => date !== null),
        parseEventDate(visibleFrom),
        parseEventDate(visibleTo),
    ]
        .filter((date): date is Date => date !== null)
        .map(startOfEventCalendarDay)
        .sort((left, right) => left.getTime() - right.getTime());

    if (dates.length === 0) {
        return null;
    }

    return {
        from: startOfLocalMonth(dates[0]),
        to: startOfLocalMonth(dates[dates.length - 1]),
    };
}

export function buildEventCalendarMonths({
    entries,
    visibleFrom,
    visibleTo,
}: {
    entries: EventCalendarEntry[];
    visibleFrom?: Date;
    visibleTo?: Date;
}): EventCalendarMonth[] {
    const range = monthRange({ entries, visibleFrom, visibleTo });
    if (!range) {
        return [];
    }

    const entriesByDay = new Map<string, EventCalendarEntry[]>();
    for (const entry of entries) {
        const date = parseEventDate(entry.date);
        if (!date) {
            continue;
        }

        const key = formatEventCalendarDayKey(date);
        entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
    }

    const dayWeights = Array.from(entriesByDay.values()).map((dayEntries) =>
        dayEntries.reduce((sum, entry) => sum + entryWeight(entry), 0),
    );
    const minimumWeight = dayWeights.length > 0 ? Math.min(...dayWeights) : 0;
    const maximumWeight = dayWeights.length > 0 ? Math.max(...dayWeights) : 0;
    const months: EventCalendarMonth[] = [];

    for (
        let cursor = range.from;
        cursor.getTime() <= range.to.getTime();
        cursor = addMonths(cursor, 1)
    ) {
        const firstDay = startOfLocalMonth(cursor);
        const daysInMonth = new Date(
            firstDay.getFullYear(),
            firstDay.getMonth() + 1,
            0,
        ).getDate();
        const mondayOffset = (firstDay.getDay() + 6) % 7;
        const cells: Array<EventCalendarDay | null> = Array.from({
            length: mondayOffset,
        }).map(() => null);

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(
                firstDay.getFullYear(),
                firstDay.getMonth(),
                day,
            );
            const key = formatEventCalendarDayKey(date);
            const dayEntries = entriesByDay.get(key) ?? [];
            if (dayEntries.length === 0) {
                cells.push({
                    key,
                    date,
                    dayOfMonth: day,
                    entries: [],
                    markerSize: 0,
                    tone: 'none',
                    totalWeight: 0,
                });
                continue;
            }

            const totalWeight = dayEntries.reduce(
                (sum, entry) => sum + entryWeight(entry),
                0,
            );
            cells.push({
                key,
                date,
                dayOfMonth: day,
                entries: dayEntries,
                markerSize: markerSize({
                    maximumWeight,
                    minimumWeight,
                    weight: totalWeight,
                }),
                tone: toneForDay(dayEntries),
                totalWeight,
            });
        }

        const trailingCells = (7 - (cells.length % 7)) % 7;
        cells.push(...Array.from({ length: trailingCells }).map(() => null));

        const weeks: EventCalendarMonth['weeks'] = [];
        for (let index = 0; index < cells.length; index += 7) {
            weeks.push(cells.slice(index, index + 7));
        }

        months.push({
            key: formatMonthKey(firstDay),
            date: firstDay,
            weeks,
        });
    }

    return months;
}

function isSameDay(left: Date, right: Date) {
    return formatEventCalendarDayKey(left) === formatEventCalendarDayKey(right);
}

function isBeforeDay(left: Date, right: Date) {
    return (
        startOfEventCalendarDay(left).getTime() <
        startOfEventCalendarDay(right).getTime()
    );
}

function isAfterDay(left: Date, right: Date) {
    return (
        startOfEventCalendarDay(left).getTime() >
        startOfEventCalendarDay(right).getTime()
    );
}

function dayTitle(day: EventCalendarDay, isSelected: boolean) {
    const dateLabel = dayFormatter.format(day.date);
    const suffix = isSelected ? ', odabrano' : '';

    if (day.entries.length === 0) {
        return `${dateLabel}${suffix}`;
    }

    const labels = day.entries.map((entry) => entry.label).join(', ');
    return `${dateLabel}${suffix}: ${labels}`;
}

function TodayMarker() {
    return (
        <span
            aria-hidden
            className="absolute size-9 rounded-full ring-2 ring-sky-600/40 dark:ring-sky-300/50"
            data-event-calendar-today-marker
        />
    );
}

function EventCalendarDayDetails({ day }: { day: EventCalendarDay }) {
    return (
        <Stack spacing={2}>
            <Typography level="body3" semiBold>
                {dayFormatter.format(day.date)}
            </Typography>
            <Stack spacing={1}>
                {day.entries.map((entry) => (
                    <Stack key={entry.id} spacing={0}>
                        <Typography level="body3" semiBold>
                            {entry.label}
                        </Typography>
                        {entry.meta ? (
                            <Typography level="body3" secondary>
                                {entry.meta}
                            </Typography>
                        ) : null}
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
}

function EventCalendarDayView({
    day,
    isDateDisabled,
    maxSelectableDate,
    minSelectableDate,
    onDateSelect,
    selectedDate,
    todayKey,
}: {
    day: EventCalendarDay;
    isDateDisabled?: (date: Date) => boolean;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    onDateSelect?: (date: Date) => void;
    selectedDate?: Date | null;
    todayKey: string;
}) {
    const isToday = day.key === todayKey;
    const hasEntries = day.entries.length > 0;
    const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
    const dateIsOutsideRange =
        (minSelectableDate && isBeforeDay(day.date, minSelectableDate)) ||
        (maxSelectableDate && isAfterDay(day.date, maxSelectableDate)) ||
        isDateDisabled?.(day.date) === true;
    const isSelectable = Boolean(onDateSelect) && !dateIsOutsideRange;

    if (!hasEntries && !onDateSelect) {
        return (
            <div className="relative grid size-8 place-items-center text-xs tabular-nums">
                {isToday ? <TodayMarker /> : null}
                <span className="relative z-10">{day.dayOfMonth}</span>
            </div>
        );
    }

    const tone = hasEntries && day.tone !== 'none' ? day.tone : null;
    const content = (
        <button
            type="button"
            className={cx(
                'relative grid size-8 place-items-center rounded-full text-xs tabular-nums transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                tone && 'font-semibold',
                tone && markerTextClassNames[tone],
                !tone &&
                    isSelected &&
                    'bg-primary font-semibold text-primary-foreground',
                !tone &&
                    !isSelected &&
                    isSelectable &&
                    'text-foreground hover:bg-muted',
                !tone &&
                    !isSelected &&
                    !isSelectable &&
                    'text-muted-foreground/40',
                isSelected &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-card',
            )}
            aria-label={dayTitle(day, isSelected)}
            aria-pressed={onDateSelect ? isSelected : undefined}
            data-event-calendar-selected={isSelected ? true : undefined}
            disabled={!hasEntries && !isSelectable}
            onClick={() => {
                if (isSelectable) {
                    onDateSelect?.(day.date);
                }
            }}
        >
            {isToday ? <TodayMarker /> : null}
            {tone ? (
                <span
                    aria-hidden
                    className={cx(
                        'absolute rounded-full',
                        markerClassNames[tone],
                    )}
                    data-event-calendar-marker
                    data-event-calendar-tone={tone}
                    style={{
                        height: day.markerSize,
                        width: day.markerSize,
                    }}
                />
            ) : null}
            <span className="relative z-10">{day.dayOfMonth}</span>
        </button>
    );

    if (!hasEntries) {
        return content;
    }

    return (
        <Popper
            className="w-[min(calc(100vw-2rem),16rem)] p-3"
            side="top"
            sideOffset={6}
            trigger={content}
        >
            <EventCalendarDayDetails day={day} />
        </Popper>
    );
}

function EventCalendarMonthView({
    canGoBack,
    canGoForward,
    isDateDisabled,
    maxSelectableDate,
    minSelectableDate,
    month,
    onDateSelect,
    onNextMonth,
    onPreviousMonth,
    selectedDate,
    todayKey,
}: {
    canGoBack: boolean;
    canGoForward: boolean;
    isDateDisabled?: (date: Date) => boolean;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    month: EventCalendarMonth;
    onDateSelect?: (date: Date) => void;
    onNextMonth: () => void;
    onPreviousMonth: () => void;
    selectedDate?: Date | null;
    todayKey: string;
}) {
    return (
        <section className="space-y-2" data-event-calendar-month={month.key}>
            <Row
                spacing={2}
                className="text-slate-700 dark:text-slate-200"
                justifyContent="space-between"
            >
                <Row spacing={2} className="min-w-0">
                    <Calendar className="size-4 shrink-0 text-sky-600" />
                    <Typography
                        level="body2"
                        semiBold
                        className="truncate capitalize"
                    >
                        {monthFormatter.format(month.date)}
                    </Typography>
                </Row>
                <Row spacing={1} className="shrink-0">
                    <IconButton
                        aria-label="Prethodni mjesec"
                        disabled={!canGoBack}
                        size="xs"
                        title="Prethodni mjesec"
                        type="button"
                        variant="plain"
                        onClick={onPreviousMonth}
                    >
                        <ArrowLeft className="size-3.5" />
                    </IconButton>
                    <IconButton
                        aria-label="Sljedeći mjesec"
                        disabled={!canGoForward}
                        size="xs"
                        title="Sljedeći mjesec"
                        type="button"
                        variant="plain"
                        onClick={onNextMonth}
                    >
                        <ArrowRight className="size-3.5" />
                    </IconButton>
                </Row>
            </Row>
            <div className="grid grid-cols-7 gap-1 text-center">
                {weekDays.map((weekDay) => (
                    <div
                        key={weekDay}
                        className="text-[0.65rem] font-semibold uppercase text-muted-foreground"
                    >
                        {weekDay}
                    </div>
                ))}
                {month.weeks.flatMap((week, weekIndex) =>
                    week.map((day, dayIndex) => (
                        <div
                            key={
                                day?.key ??
                                `${month.key}-${weekIndex}-${dayIndex}`
                            }
                            className="grid h-8 place-items-center"
                        >
                            {day ? (
                                <EventCalendarDayView
                                    day={day}
                                    isDateDisabled={isDateDisabled}
                                    maxSelectableDate={maxSelectableDate}
                                    minSelectableDate={minSelectableDate}
                                    onDateSelect={onDateSelect}
                                    selectedDate={selectedDate}
                                    todayKey={todayKey}
                                />
                            ) : null}
                        </div>
                    )),
                )}
            </div>
        </section>
    );
}

export function EventCalendar({
    className,
    emptyLabel = 'Nema zabilježenih događaja.',
    entries,
    error,
    errorLabel = 'Kalendar nije dostupan.',
    isDateDisabled,
    isLoading,
    loadingLabel = 'Učitavanje...',
    maxSelectableDate,
    minSelectableDate,
    onDateSelect,
    referenceDate,
    selectedDate,
    visibleFrom,
    visibleTo,
    ...rest
}: EventCalendarProps) {
    const months = useMemo(
        () => buildEventCalendarMonths({ entries, visibleFrom, visibleTo }),
        [entries, visibleFrom, visibleTo],
    );
    const todayKey = formatEventCalendarDayKey(referenceDate ?? new Date());
    const selectedDateKey = selectedDate
        ? formatMonthKey(startOfLocalMonth(selectedDate))
        : null;
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(
        null,
    );

    useEffect(() => {
        if (months.length === 0) {
            setSelectedMonthKey(null);
            return;
        }

        setSelectedMonthKey((currentKey) => {
            if (
                currentKey &&
                months.some((month) => month.key === currentKey)
            ) {
                return currentKey;
            }

            if (
                selectedDateKey &&
                months.some((month) => month.key === selectedDateKey)
            ) {
                return selectedDateKey;
            }

            return months[months.length - 1].key;
        });
    }, [months, selectedDateKey]);

    const fallbackMonthKey =
        selectedDateKey && months.some((month) => month.key === selectedDateKey)
            ? selectedDateKey
            : (months[months.length - 1]?.key ?? null);
    const requestedMonthKey = selectedMonthKey ?? fallbackMonthKey;
    const requestedMonthIndex = requestedMonthKey
        ? months.findIndex((month) => month.key === requestedMonthKey)
        : -1;
    const selectedMonthIndex =
        months.length === 0
            ? -1
            : requestedMonthIndex >= 0
              ? requestedMonthIndex
              : months.length - 1;
    const selectedMonth =
        selectedMonthIndex >= 0 ? months[selectedMonthIndex] : null;
    const canGoBack = selectedMonthIndex > 0;
    const canGoForward =
        selectedMonthIndex >= 0 && selectedMonthIndex < months.length - 1;

    return (
        <Stack
            spacing={3}
            className={cx(
                'rounded-lg border bg-card/80 p-3 shadow-sm',
                className,
            )}
            data-event-calendar
            {...rest}
        >
            {error ? <Alert color="danger">{errorLabel}</Alert> : null}
            {isLoading ? (
                <Row spacing={2}>
                    <Spinner loadingLabel="Učitavanje kalendara" />
                    <Typography level="body2" secondary>
                        {loadingLabel}
                    </Typography>
                </Row>
            ) : null}
            {!error && !isLoading && months.length === 0 && emptyLabel ? (
                <Typography level="body2" secondary>
                    {emptyLabel}
                </Typography>
            ) : null}
            {selectedMonth ? (
                <EventCalendarMonthView
                    key={selectedMonth.key}
                    canGoBack={canGoBack}
                    canGoForward={canGoForward}
                    isDateDisabled={isDateDisabled}
                    maxSelectableDate={maxSelectableDate}
                    minSelectableDate={minSelectableDate}
                    month={selectedMonth}
                    onDateSelect={onDateSelect}
                    onNextMonth={() => {
                        if (canGoForward) {
                            setSelectedMonthKey(
                                months[selectedMonthIndex + 1].key,
                            );
                        }
                    }}
                    onPreviousMonth={() => {
                        if (canGoBack) {
                            setSelectedMonthKey(
                                months[selectedMonthIndex - 1].key,
                            );
                        }
                    }}
                    selectedDate={selectedDate}
                    todayKey={todayKey}
                />
            ) : null}
        </Stack>
    );
}
