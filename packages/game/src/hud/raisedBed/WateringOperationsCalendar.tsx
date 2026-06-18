'use client';

import { Alert } from '@gredice/ui/Alert';
import { IconButton } from '@gredice/ui/IconButton';
import { ArrowLeft, ArrowRight, Calendar } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useState } from 'react';
import {
    buildWateringCalendarMonths,
    formatLocalDayKey,
    type WateringCalendarDay,
    type WateringCalendarEntry,
    type WateringCalendarMonth,
} from './wateringCalendarModel';

const weekDays = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});
const sourceLabels = {
    cart: 'U košari',
    completed: 'Obavljeno',
    preview: 'Novi termin',
    scheduled: 'Zakazano',
} satisfies Record<WateringCalendarEntry['source'], string>;

function markerClassName(day: WateringCalendarDay) {
    if (day.tone === 'preview') {
        return 'border-sky-600 bg-sky-100/70 border-dashed';
    }

    if (day.tone === 'cart') {
        return 'border-sky-600 bg-sky-200/80 shadow-sm shadow-sky-300/50';
    }

    if (day.tone === 'scheduled') {
        return 'border-sky-500 bg-sky-100/70';
    }

    return 'border-sky-500 bg-sky-500/20';
}

function dayTitle(day: WateringCalendarDay) {
    if (day.entries.length === 0) {
        return dayFormatter.format(day.date);
    }

    const labels = day.entries.map((entry) => entry.label).join(', ');
    return `${dayFormatter.format(day.date)}: ${labels}`;
}

function entryMeta(entry: WateringCalendarEntry) {
    const roundedWeight =
        typeof entry.weight === 'number' && entry.weight > 0
            ? Math.round(entry.weight)
            : null;

    return [
        sourceLabels[entry.source],
        roundedWeight == null ? null : `${roundedWeight} min`,
    ]
        .filter(Boolean)
        .join(' · ');
}

function TodayMarker() {
    return (
        <span
            aria-hidden
            className="absolute size-9 rounded-full bg-white shadow-sm ring-2 ring-sky-600/40 dark:bg-neutral-950 dark:ring-sky-300/50"
            data-watering-calendar-today-marker
        />
    );
}

function WateringCalendarDayView({
    day,
    todayKey,
}: {
    day: WateringCalendarDay;
    todayKey: string;
}) {
    const isToday = day.key === todayKey;

    if (day.entries.length === 0) {
        return (
            <div className="relative grid size-8 place-items-center text-xs tabular-nums">
                {isToday ? <TodayMarker /> : null}
                <span className="relative z-10">{day.dayOfMonth}</span>
            </div>
        );
    }

    const content = (
        <button
            type="button"
            className={cx(
                'relative grid size-8 place-items-center rounded-full text-xs tabular-nums',
                'font-semibold text-slate-950 dark:text-white',
            )}
            aria-label={dayTitle(day)}
        >
            {isToday ? <TodayMarker /> : null}
            <span
                aria-hidden
                className={cx(
                    'absolute rounded-full border-2',
                    markerClassName(day),
                )}
                data-watering-calendar-marker
                data-watering-calendar-tone={day.tone}
                style={{
                    height: day.markerSize,
                    width: day.markerSize,
                }}
            />
            <span className="relative z-10">{day.dayOfMonth}</span>
        </button>
    );

    return (
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent className="max-w-64 p-3">
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
                                <Typography level="body3" secondary>
                                    {entryMeta(entry)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Stack>
            </TooltipContent>
        </Tooltip>
    );
}

function WateringCalendarMonthView({
    month,
    todayKey,
}: {
    month: WateringCalendarMonth;
    todayKey: string;
}) {
    return (
        <section className="space-y-2" data-watering-calendar-month={month.key}>
            <Row spacing={2} className="text-slate-700 dark:text-slate-200">
                <Calendar className="size-4 shrink-0 text-sky-600" />
                <Typography level="body2" semiBold className="capitalize">
                    {monthFormatter.format(month.date)}
                </Typography>
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
                                <WateringCalendarDayView
                                    day={day}
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

export function WateringOperationsCalendar({
    className,
    entries,
    error,
    isLoading,
    referenceDate,
}: {
    className?: string;
    entries: WateringCalendarEntry[];
    error?: boolean;
    isLoading?: boolean;
    referenceDate?: Date;
}) {
    const months = useMemo(
        () => buildWateringCalendarMonths(entries, referenceDate),
        [entries, referenceDate],
    );
    const todayKey = formatLocalDayKey(referenceDate ?? new Date());
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

            return months[months.length - 1].key;
        });
    }, [months]);

    const requestedMonthIndex = selectedMonthKey
        ? months.findIndex((month) => month.key === selectedMonthKey)
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
            data-watering-calendar
        >
            {entries.length > 0 ? (
                <Row spacing={1} justifyContent="end">
                    <IconButton
                        aria-label="Prethodni mjesec"
                        disabled={!canGoBack}
                        size="xs"
                        title="Prethodni mjesec"
                        type="button"
                        variant="plain"
                        onClick={() => {
                            if (canGoBack) {
                                setSelectedMonthKey(
                                    months[selectedMonthIndex - 1].key,
                                );
                            }
                        }}
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
                        onClick={() => {
                            if (canGoForward) {
                                setSelectedMonthKey(
                                    months[selectedMonthIndex + 1].key,
                                );
                            }
                        }}
                    >
                        <ArrowRight className="size-3.5" />
                    </IconButton>
                </Row>
            ) : null}
            {error ? (
                <Alert color="danger">
                    Kalendar zalijevanja nije dostupan.
                </Alert>
            ) : null}
            {isLoading ? (
                <Row spacing={2}>
                    <Spinner loadingLabel="Učitavanje kalendara" />
                    <Typography level="body2" secondary>
                        Učitavanje...
                    </Typography>
                </Row>
            ) : null}
            {!error && !isLoading && months.length === 0 ? (
                <Typography level="body2" secondary>
                    Još nema zabilježenih zalijevanja.
                </Typography>
            ) : null}
            {selectedMonth ? (
                <WateringCalendarMonthView
                    key={selectedMonth.key}
                    month={selectedMonth}
                    todayKey={todayKey}
                />
            ) : null}
        </Stack>
    );
}
