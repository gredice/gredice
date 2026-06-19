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

function toEventCalendarEntry(
    entry: WateringCalendarEntry,
): EventCalendarEntry {
    return {
        id: entry.id,
        date: entry.date,
        label: entry.label,
        tone: entry.source,
        weight: entry.weight,
    };
}

export function buildWateringCalendarMonths(
    entries: WateringCalendarEntry[],
    _referenceDate?: Date,
): WateringCalendarMonth[] {
    return buildEventCalendarMonths({
        entries: entries.map(toEventCalendarEntry),
    });
}
