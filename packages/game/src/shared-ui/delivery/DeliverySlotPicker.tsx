'use client';

import { IconButton } from '@gredice/ui/IconButton';
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    Check,
    MapPin,
    Truck,
} from '@gredice/ui/icons';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

const LOADING_DAY_KEYS = ['first', 'second', 'third', 'fourth'];

export interface DeliverySlotPickerSlot {
    id: number;
    startAt: Date | string;
    endAt: Date | string;
    fulfillment: 'delivery' | 'pickup';
    disabled?: boolean;
}

export interface DeliverySlotPickerProps {
    slots: readonly DeliverySlotPickerSlot[];
    value?: number;
    onValueChange: (slotId: number | undefined) => void;
    label?: string | null;
    description?: string;
    emptyMessage?: string;
    locale?: string;
    timeZone?: string;
    referenceDate?: Date | string;
    autoFocus?: boolean;
    autoSelectFirstDeliverySlot?: boolean;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
}

interface SlotDay {
    key: string;
    date: Date;
    slots: DeliverySlotPickerSlot[];
}

interface SlotWeek {
    key: string;
    startAt: Date;
    endAt: Date;
    days: SlotDay[];
}

function dateKey(formatter: Intl.DateTimeFormat, date: Date) {
    const parts = new Map(
        formatter.formatToParts(date).map(({ type, value }) => [type, value]),
    );

    return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

function startOfWeek(formatter: Intl.DateTimeFormat, date: Date) {
    const weekStart = new Date(`${dateKey(formatter, date)}T12:00:00.000Z`);
    const daysFromMonday = (weekStart.getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday);
    return weekStart;
}

function weekKey(formatter: Intl.DateTimeFormat, date: Date) {
    return dateKey(formatter, startOfWeek(formatter, date));
}

function slotCountLabel(count: number) {
    return count === 1 ? '1 termin' : `${count.toString()} termina`;
}

export function DeliverySlotPicker({
    slots,
    value,
    onValueChange,
    label = 'Termin dostave',
    description = 'Prvo odaberi dan, a zatim vrijeme koje ti najviše odgovara.',
    emptyMessage = 'Trenutno nema dostupnih termina za odabrani način dostave.',
    locale = 'hr-HR',
    timeZone = 'Europe/Zagreb',
    referenceDate,
    autoFocus = true,
    autoSelectFirstDeliverySlot = true,
    loading = false,
    disabled = false,
    className,
}: DeliverySlotPickerProps) {
    const labelId = useId();
    const [initialDate] = useState(() => new Date());
    const formatters = useMemo(
        () => ({
            dateKey: new Intl.DateTimeFormat('en-US', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone,
            }),
            dayNumber: new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                timeZone,
            }),
            fullDate: new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
                timeZone,
            }),
            month: new Intl.DateTimeFormat(locale, {
                month: 'short',
                timeZone,
            }),
            time: new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                hour12: false,
                minute: '2-digit',
                timeZone,
            }),
            weekEnd: new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone,
            }),
            weekStart: new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                timeZone,
            }),
            weekday: new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                timeZone,
            }),
        }),
        [locale, timeZone],
    );
    const currentDate = referenceDate ? new Date(referenceDate) : initialDate;
    const todayKey = dateKey(formatters.dateKey, currentDate);
    const days = useMemo(() => {
        const groupedDays = new Map<string, SlotDay>();

        for (const slot of [...slots].sort(
            (first, second) =>
                new Date(first.startAt).getTime() -
                new Date(second.startAt).getTime(),
        )) {
            const date = new Date(slot.startAt);
            const key = dateKey(formatters.dateKey, date);
            const existingDay = groupedDays.get(key);

            if (existingDay) {
                existingDay.slots.push(slot);
            } else {
                groupedDays.set(key, { key, date, slots: [slot] });
            }
        }

        return [...groupedDays.values()];
    }, [formatters.dateKey, slots]);
    const weeks = useMemo(() => {
        const groupedWeeks = new Map<string, SlotWeek>();

        for (const day of days) {
            const weekStart = startOfWeek(formatters.dateKey, day.date);
            const key = dateKey(formatters.dateKey, weekStart);
            const existingWeek = groupedWeeks.get(key);

            if (existingWeek) {
                existingWeek.days.push(day);
            } else {
                const weekEnd = new Date(weekStart);
                weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
                groupedWeeks.set(key, {
                    key,
                    startAt: weekStart,
                    endAt: weekEnd,
                    days: [day],
                });
            }
        }

        const populatedWeeks = [...groupedWeeks.values()];
        const firstWeek = populatedWeeks[0];
        const lastWeek = populatedWeeks[populatedWeeks.length - 1];

        if (!firstWeek || !lastWeek) {
            return [];
        }

        const continuousWeeks: SlotWeek[] = [];
        const cursor = new Date(firstWeek.startAt);

        while (cursor.getTime() <= lastWeek.startAt.getTime()) {
            const key = dateKey(formatters.dateKey, cursor);
            const populatedWeek = groupedWeeks.get(key);

            if (populatedWeek) {
                continuousWeeks.push(populatedWeek);
            } else {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor);
                endAt.setUTCDate(endAt.getUTCDate() + 6);
                continuousWeeks.push({ key, startAt, endAt, days: [] });
            }

            cursor.setUTCDate(cursor.getUTCDate() + 7);
        }

        return continuousWeeks;
    }, [days, formatters.dateKey]);
    const selectedSlot = slots.find((slot) => slot.id === value);
    const selectedSlotDate = selectedSlot
        ? new Date(selectedSlot.startAt)
        : undefined;
    const selectedSlotDayKey = selectedSlotDate
        ? dateKey(formatters.dateKey, selectedSlotDate)
        : undefined;
    const selectedSlotWeekKey =
        selectedSlotDate && selectedSlotDayKey
            ? weekKey(formatters.dateKey, selectedSlotDate)
            : undefined;
    const [preferredWeekKey, setPreferredWeekKey] = useState<string>();
    const [preferredDayKey, setPreferredDayKey] = useState<string>();
    const firstAvailableWeekKey = weeks.find((week) =>
        week.days.some((day) =>
            day.slots.some(
                (slot) => slot.fulfillment === 'delivery' && !slot.disabled,
            ),
        ),
    )?.key;
    const currentWeekKey = weekKey(formatters.dateKey, currentDate);
    const selectedWeekKey =
        selectedSlotWeekKey ??
        weeks.find((week) => week.key === preferredWeekKey)?.key ??
        weeks.find((week) => week.key === currentWeekKey)?.key ??
        firstAvailableWeekKey ??
        weeks[0]?.key;
    const selectedWeekIndex = Math.max(
        weeks.findIndex((week) => week.key === selectedWeekKey),
        0,
    );
    const selectedWeek = weeks[selectedWeekIndex];
    const selectedDayKey =
        selectedSlotDayKey ??
        selectedWeek?.days.find((day) => day.key === preferredDayKey)?.key ??
        (autoSelectFirstDeliverySlot
            ? selectedWeek?.days.find((day) =>
                  day.slots.some(
                      (slot) =>
                          slot.fulfillment === 'delivery' && !slot.disabled,
                  ),
              )?.key
            : undefined) ??
        selectedWeek?.days.find((day) => day.key === todayKey)?.key ??
        selectedWeek?.days[0]?.key;
    const selectedDay = selectedWeek?.days.find(
        (day) => day.key === selectedDayKey,
    );
    const focusTargetKey = selectedSlotDayKey
        ? `slot-${value?.toString()}`
        : selectedDayKey
          ? `day-${selectedDayKey}`
          : undefined;
    const focusTargetRef = useRef<HTMLButtonElement>(null);
    const autoSelectedSlotRef = useRef<number | undefined>(undefined);
    const firstAvailableDeliverySlotId = selectedDay?.slots.find(
        (slot) => slot.fulfillment === 'delivery' && !slot.disabled,
    )?.id;

    useEffect(() => {
        if (value !== undefined) {
            autoSelectedSlotRef.current = undefined;
            return;
        }

        if (
            !autoSelectFirstDeliverySlot ||
            disabled ||
            firstAvailableDeliverySlotId === undefined ||
            autoSelectedSlotRef.current === firstAvailableDeliverySlotId
        ) {
            return;
        }

        autoSelectedSlotRef.current = firstAvailableDeliverySlotId;
        onValueChange(firstAvailableDeliverySlotId);
    }, [
        autoSelectFirstDeliverySlot,
        disabled,
        firstAvailableDeliverySlotId,
        onValueChange,
        value,
    ]);

    useEffect(() => {
        if (autoFocus && !disabled && focusTargetKey) {
            focusTargetRef.current?.focus();
        }
    }, [autoFocus, disabled, focusTargetKey]);

    function selectWeek(nextWeekIndex: number) {
        const nextWeek = weeks[nextWeekIndex];

        if (!nextWeek) {
            return;
        }

        setPreferredWeekKey(nextWeek.key);
        setPreferredDayKey(
            (autoSelectFirstDeliverySlot
                ? nextWeek.days.find((day) =>
                      day.slots.some(
                          (slot) =>
                              slot.fulfillment === 'delivery' && !slot.disabled,
                      ),
                  )?.key
                : undefined) ??
                nextWeek.days.find((day) => day.key === todayKey)?.key ??
                nextWeek.days[0]?.key,
        );

        if (selectedSlotWeekKey && selectedSlotWeekKey !== nextWeek.key) {
            onValueChange(undefined);
        }
    }

    return (
        <section
            aria-label={label ? undefined : description}
            aria-labelledby={label ? labelId : undefined}
            className={cx('w-full min-w-0', className)}
        >
            <div className="mb-3">
                {label && (
                    <Typography id={labelId} level="h6" semiBold>
                        {label}
                    </Typography>
                )}
                <Typography level="body2" className="text-foreground/70">
                    {description}
                </Typography>
            </div>

            {loading ? (
                <div
                    aria-label="Učitavanje termina"
                    className="space-y-4"
                    role="status"
                >
                    <Skeleton className="mx-auto h-9 w-56" />
                    <div className="flex gap-2 overflow-hidden">
                        {LOADING_DAY_KEYS.map((key) => (
                            <Skeleton
                                key={key}
                                className="h-[5.5rem] min-w-[5rem] grow"
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                </div>
            ) : weeks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8">
                    <Calendar
                        aria-hidden
                        className="mx-auto mb-3 size-6 text-muted-foreground"
                    />
                    <NoDataPlaceholder>{emptyMessage}</NoDataPlaceholder>
                </div>
            ) : (
                <div className="space-y-5">
                    {weeks.length > 1 && selectedWeek && (
                        <nav
                            aria-label="Tjedni termini"
                            className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-1.5 py-1"
                        >
                            <IconButton
                                aria-label="Prikaži prethodni tjedan"
                                disabled={disabled || selectedWeekIndex === 0}
                                onClick={() =>
                                    selectWeek(selectedWeekIndex - 1)
                                }
                                size="sm"
                                variant="plain"
                            >
                                <ArrowLeft className="size-4" />
                            </IconButton>
                            <div className="min-w-0 text-center">
                                <p className="m-0 truncate text-sm font-semibold text-foreground">
                                    Tjedan{' '}
                                    {formatters.weekStart.format(
                                        selectedWeek.startAt,
                                    )}{' '}
                                    –{' '}
                                    {formatters.weekEnd.format(
                                        selectedWeek.endAt,
                                    )}
                                </p>
                                <p className="m-0 text-[0.65rem] text-foreground/70">
                                    {(selectedWeekIndex + 1).toString()} od{' '}
                                    {weeks.length.toString()}
                                </p>
                            </div>
                            <IconButton
                                aria-label="Prikaži sljedeći tjedan"
                                disabled={
                                    disabled ||
                                    selectedWeekIndex === weeks.length - 1
                                }
                                onClick={() =>
                                    selectWeek(selectedWeekIndex + 1)
                                }
                                size="sm"
                                variant="plain"
                            >
                                <ArrowRight className="size-4" />
                            </IconButton>
                        </nav>
                    )}

                    {selectedWeek && selectedWeek.days.length > 0 ? (
                        <fieldset
                            className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1"
                            disabled={disabled}
                        >
                            <legend className="sr-only">Odaberi dan</legend>
                            {selectedWeek.days.map((day) => {
                                const isSelected = day.key === selectedDay?.key;
                                const isToday = day.key === todayKey;

                                return (
                                    <button
                                        key={day.key}
                                        aria-current={
                                            isToday ? 'date' : undefined
                                        }
                                        aria-label={`${formatters.fullDate.format(day.date)}, ${slotCountLabel(day.slots.length)}${isToday ? ', danas' : ''}`}
                                        aria-pressed={isSelected}
                                        className={cx(
                                            'relative flex min-h-[5.5rem] min-w-[5rem] flex-1 flex-col items-center justify-center rounded-lg border px-2.5 py-2 text-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed',
                                            isSelected
                                                ? 'border-primary bg-primary/10 text-primary ring-1 ring-inset ring-primary/40'
                                                : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/50',
                                        )}
                                        disabled={disabled}
                                        ref={
                                            !selectedSlotDayKey && isSelected
                                                ? focusTargetRef
                                                : undefined
                                        }
                                        onClick={() => {
                                            setPreferredDayKey(day.key);

                                            if (
                                                selectedSlotDayKey &&
                                                selectedSlotDayKey !== day.key
                                            ) {
                                                onValueChange(undefined);
                                            }
                                        }}
                                        type="button"
                                    >
                                        {isToday && (
                                            <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wide text-primary-foreground">
                                                Danas
                                            </span>
                                        )}
                                        <span
                                            aria-hidden
                                            className={cx(
                                                'absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-muted text-[0.6rem] font-bold text-foreground/70',
                                                isSelected &&
                                                    'bg-primary text-primary-foreground',
                                            )}
                                        >
                                            {day.slots.length}
                                        </span>
                                        <span className="text-[0.65rem] font-bold uppercase tracking-wide">
                                            {formatters.weekday.format(
                                                day.date,
                                            )}
                                        </span>
                                        <span className="text-xl font-bold leading-tight">
                                            {formatters.dayNumber.format(
                                                day.date,
                                            )}
                                        </span>
                                        <span className="text-[0.65rem] text-foreground/70">
                                            {formatters.month.format(day.date)}
                                        </span>
                                    </button>
                                );
                            })}
                        </fieldset>
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-7 text-center">
                            <Calendar
                                aria-hidden
                                className="mx-auto mb-3 size-6 text-muted-foreground"
                            />
                            <NoDataPlaceholder>
                                Nema planiranih ni otvorenih termina dostave ili
                                osobnog preuzimanja za ovaj tjedan.
                            </NoDataPlaceholder>
                        </div>
                    )}

                    {selectedDay && (
                        <div className="pt-1">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <Typography level="body2" semiBold>
                                    Dostupna vremena
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-right capitalize text-foreground/70"
                                >
                                    {formatters.fullDate.format(
                                        selectedDay.date,
                                    )}
                                </Typography>
                            </div>
                            <fieldset
                                className="m-0 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 border-0 p-0"
                                disabled={disabled}
                            >
                                <legend className="sr-only">
                                    Odaberi vrijeme za{' '}
                                    {formatters.fullDate.format(
                                        selectedDay.date,
                                    )}
                                </legend>
                                {selectedDay.slots.map((slot) => {
                                    const isSelected = slot.id === value;
                                    const startAtLabel = formatters.time.format(
                                        new Date(slot.startAt),
                                    );
                                    const endAtLabel = formatters.time.format(
                                        new Date(slot.endAt),
                                    );
                                    const FulfillmentIcon =
                                        slot.fulfillment === 'delivery'
                                            ? Truck
                                            : MapPin;
                                    const fulfillmentLabel =
                                        slot.fulfillment === 'delivery'
                                            ? 'Dostava'
                                            : 'Preuzimanje';

                                    return (
                                        <button
                                            key={slot.id}
                                            aria-label={`${startAtLabel} – ${endAtLabel}, ${fulfillmentLabel}${slot.disabled ? ', nije dostupno' : ''}`}
                                            aria-pressed={isSelected}
                                            className={cx(
                                                'flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-sm tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-inset ring-primary/40'
                                                    : 'border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5',
                                            )}
                                            disabled={disabled || slot.disabled}
                                            ref={
                                                isSelected
                                                    ? focusTargetRef
                                                    : undefined
                                            }
                                            onClick={() =>
                                                onValueChange(slot.id)
                                            }
                                            type="button"
                                        >
                                            <FulfillmentIcon
                                                aria-hidden
                                                className={cx(
                                                    'size-4 shrink-0',
                                                    !isSelected &&
                                                        'text-muted-foreground',
                                                )}
                                            />
                                            <span className="min-w-0 flex-1 text-left">
                                                <span className="block whitespace-nowrap font-semibold">
                                                    <span
                                                        className={cx(
                                                            slot.disabled &&
                                                                'line-through',
                                                        )}
                                                    >
                                                        {startAtLabel} –{' '}
                                                        {endAtLabel}
                                                    </span>
                                                </span>
                                                <span
                                                    className={cx(
                                                        'block text-[0.65rem] font-medium',
                                                        isSelected
                                                            ? 'text-primary/80'
                                                            : 'text-foreground/70',
                                                    )}
                                                >
                                                    {fulfillmentLabel}
                                                    {slot.disabled &&
                                                        ' · Nije dostupno'}
                                                </span>
                                            </span>
                                            {isSelected && (
                                                <Check
                                                    aria-hidden
                                                    className="size-4 shrink-0"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </fieldset>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
