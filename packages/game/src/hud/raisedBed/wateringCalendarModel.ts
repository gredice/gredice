import {
    buildEventCalendarMonths,
    type EventCalendarDay,
    type EventCalendarDayTone,
    type EventCalendarEntry,
    type EventCalendarMonth,
    formatEventCalendarDayKey,
    startOfEventCalendarDay,
} from '@gredice/ui/EventCalendar';

export type WateringCalendarEntrySource =
    | 'completed'
    | 'scheduled'
    | 'cart'
    | 'preview';

export type WateringCalendarEntry = {
    id: string;
    date: Date | string;
    label: string;
    source: WateringCalendarEntrySource;
    weight?: number | null;
};

export type WateringCalendarDayTone = EventCalendarDayTone;
export type WateringCalendarDay = EventCalendarDay;
export type WateringCalendarMonth = EventCalendarMonth;

export const startOfLocalDay = startOfEventCalendarDay;
export const formatLocalDayKey = formatEventCalendarDayKey;

function dateFromUnknown(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function sourceForReferenceDate(
    entry: WateringCalendarEntry,
    referenceDate: Date,
): WateringCalendarEntrySource {
    if (entry.source !== 'completed') {
        return entry.source;
    }

    const entryDate = dateFromUnknown(entry.date);
    if (!entryDate) {
        return entry.source;
    }

    return startOfLocalDay(entryDate).getTime() >
        startOfLocalDay(referenceDate).getTime()
        ? 'scheduled'
        : entry.source;
}

export function toWateringEventCalendarEntry(
    entry: WateringCalendarEntry,
    referenceDate = new Date(),
): EventCalendarEntry {
    return {
        id: entry.id,
        date: entry.date,
        label: entry.label,
        tone: sourceForReferenceDate(entry, referenceDate),
        weight: entry.weight,
    };
}

export function buildWateringCalendarMonths(
    entries: WateringCalendarEntry[],
    referenceDate = new Date(),
): WateringCalendarMonth[] {
    return buildEventCalendarMonths({
        entries: entries.map((entry) =>
            toWateringEventCalendarEntry(entry, referenceDate),
        ),
    });
}
