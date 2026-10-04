'use client';

import type { HTMLAttributes, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { IconButton } from '../IconButton';
import { ArrowLeft, ArrowRight } from '../icons';
import { cx } from '../utils';
import {
    addCalendarDays,
    addCalendarMonths,
    calendarDateIsInRange,
    formatCalendarDateKey,
    getCalendarMonthCells,
    getInitialCalendarMonth,
    parseCalendarDateKey,
    startOfCalendarMonth,
} from './calendarDateUtils';

const weekDays = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'full',
});

export type CalendarProps = Omit<
    HTMLAttributes<HTMLFieldSetElement>,
    'onChange'
> & {
    disabled?: boolean;
    max?: string;
    min?: string;
    onValueChange: (value: string) => void;
    referenceDate?: Date;
    value: string;
};

export function Calendar({
    className,
    disabled = false,
    max,
    min,
    onValueChange,
    referenceDate,
    value,
    ...rest
}: CalendarProps) {
    const selectedDate = parseCalendarDateKey(value);
    const minimumDate = parseCalendarDateKey(min);
    const maximumDate = parseCalendarDateKey(max);
    const today = referenceDate ?? new Date();
    const [visibleMonth, setVisibleMonth] = useState(() =>
        getInitialCalendarMonth({
            maximumDate,
            minimumDate,
            referenceDate: today,
            selectedDate,
        }),
    );
    const pendingFocusDate = useRef<string | null>(null);
    const dayButtons = useRef(new Map<string, HTMLButtonElement>());
    const visibleMonthKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`;
    const selectedMonthKey = selectedDate
        ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`
        : null;
    const selectedDateKey = selectedDate
        ? formatCalendarDateKey(selectedDate)
        : null;

    const cells = getCalendarMonthCells(visibleMonth);
    const previousMonth = addCalendarMonths(visibleMonth, -1);
    const nextMonth = addCalendarMonths(visibleMonth, 1);
    const previousMonthLastDay = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        0,
        12,
    );
    const nextMonthFirstDay = nextMonth;
    const canGoBack =
        !disabled &&
        (!minimumDate ||
            calendarDateIsInRange(
                previousMonthLastDay,
                minimumDate,
                maximumDate,
            ));
    const canGoForward =
        !disabled &&
        (!maximumDate ||
            calendarDateIsInRange(nextMonthFirstDay, minimumDate, maximumDate));
    const todayKey = formatCalendarDateKey(today);
    const firstEnabledDate = cells.find(
        (date) => date && calendarDateIsInRange(date, minimumDate, maximumDate),
    );
    const focusableDateKey =
        selectedDate &&
        selectedMonthKey === visibleMonthKey &&
        calendarDateIsInRange(selectedDate, minimumDate, maximumDate)
            ? selectedDateKey
            : cells.some(
                    (date) => date && formatCalendarDateKey(date) === todayKey,
                ) && calendarDateIsInRange(today, minimumDate, maximumDate)
              ? todayKey
              : firstEnabledDate
                ? formatCalendarDateKey(firstEnabledDate)
                : null;

    function moveDayFocus(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
        const dayOffset =
            event.key === 'ArrowLeft'
                ? -1
                : event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'ArrowUp'
                    ? -7
                    : event.key === 'ArrowDown'
                      ? 7
                      : null;

        if (dayOffset === null) {
            return;
        }

        event.preventDefault();
        const nextDate = addCalendarDays(date, dayOffset);
        if (
            disabled ||
            !calendarDateIsInRange(nextDate, minimumDate, maximumDate)
        ) {
            return;
        }

        const nextDateKey = formatCalendarDateKey(nextDate);
        const nextButton = dayButtons.current.get(nextDateKey);
        if (nextButton) {
            nextButton.focus();
            return;
        }

        pendingFocusDate.current = nextDateKey;
        setVisibleMonth(startOfCalendarMonth(nextDate));
    }

    return (
        <fieldset
            aria-label="Kalendar"
            className={cx('min-w-0 space-y-3 border-0 p-0', className)}
            {...rest}
        >
            <div className="flex items-center justify-between gap-2">
                <IconButton
                    aria-label="Prethodni mjesec"
                    disabled={!canGoBack}
                    size="xs"
                    title="Prethodni mjesec"
                    type="button"
                    variant="plain"
                    onClick={() => setVisibleMonth(previousMonth)}
                >
                    <ArrowLeft aria-hidden className="size-4" />
                </IconButton>
                <div
                    aria-live="polite"
                    className="min-w-0 truncate text-sm font-semibold capitalize"
                >
                    {monthFormatter.format(visibleMonth)}
                </div>
                <IconButton
                    aria-label="Sljedeći mjesec"
                    disabled={!canGoForward}
                    size="xs"
                    title="Sljedeći mjesec"
                    type="button"
                    variant="plain"
                    onClick={() => setVisibleMonth(nextMonth)}
                >
                    <ArrowRight aria-hidden className="size-4" />
                </IconButton>
            </div>
            <table
                aria-label="Dani u mjesecu"
                className="w-full table-fixed border-separate border-spacing-1 text-center"
            >
                <thead>
                    <tr>
                        {weekDays.map((weekDay) => (
                            <th
                                className="h-7 text-[0.65rem] font-semibold uppercase text-muted-foreground"
                                key={weekDay}
                                scope="col"
                            >
                                {weekDay}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 6 }, (_, weekIndex) => (
                        <tr key={`${visibleMonthKey}-${weekIndex.toString()}`}>
                            {cells
                                .slice(weekIndex * 7, weekIndex * 7 + 7)
                                .map((date, dayIndex) => {
                                    if (!date) {
                                        return (
                                            <td
                                                aria-hidden
                                                className="h-8 p-0"
                                                key={`${visibleMonthKey}-${weekIndex.toString()}-${dayIndex.toString()}`}
                                            />
                                        );
                                    }

                                    const dateKey = formatCalendarDateKey(date);
                                    const isSelected =
                                        dateKey === selectedDateKey;
                                    const isToday = dateKey === todayKey;
                                    const isDisabled =
                                        disabled ||
                                        !calendarDateIsInRange(
                                            date,
                                            minimumDate,
                                            maximumDate,
                                        );

                                    return (
                                        <td className="h-8 p-0" key={dateKey}>
                                            <button
                                                aria-current={
                                                    isToday ? 'date' : undefined
                                                }
                                                aria-label={dayFormatter.format(
                                                    date,
                                                )}
                                                aria-pressed={isSelected}
                                                className={cx(
                                                    'mx-auto grid size-8 place-items-center rounded-full text-xs tabular-nums transition-colors',
                                                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                    isSelected &&
                                                        'bg-primary font-semibold text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-popover',
                                                    !isSelected &&
                                                        !isDisabled &&
                                                        'text-foreground hover:bg-muted',
                                                    !isSelected &&
                                                        isToday &&
                                                        'bg-muted font-semibold',
                                                    isDisabled &&
                                                        'cursor-not-allowed text-muted-foreground/40',
                                                )}
                                                data-calendar-date={dateKey}
                                                disabled={isDisabled}
                                                ref={(node) => {
                                                    if (node) {
                                                        dayButtons.current.set(
                                                            dateKey,
                                                            node,
                                                        );
                                                        if (
                                                            pendingFocusDate.current ===
                                                            dateKey
                                                        ) {
                                                            pendingFocusDate.current =
                                                                null;
                                                            node.focus();
                                                        }
                                                    } else {
                                                        dayButtons.current.delete(
                                                            dateKey,
                                                        );
                                                    }
                                                }}
                                                tabIndex={
                                                    dateKey === focusableDateKey
                                                        ? 0
                                                        : -1
                                                }
                                                type="button"
                                                onClick={() =>
                                                    onValueChange(dateKey)
                                                }
                                                onKeyDown={(event) =>
                                                    moveDayFocus(event, date)
                                                }
                                            >
                                                {date.getDate()}
                                            </button>
                                        </td>
                                    );
                                })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </fieldset>
    );
}
