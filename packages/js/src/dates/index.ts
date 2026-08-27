/**
 * Calendar day helpers shared by the garden and admin operation lists.
 *
 * Days are resolved in a fixed time zone rather than the viewer's, so a list
 * rendered on the server and hydrated on the client always produces the same
 * groups.
 */

export type DayKey = string;

const dayKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const unknownDayKey = 'unknown';

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(timeZone: string) {
    const existingFormatter = dayKeyFormatters.get(timeZone);

    if (existingFormatter) {
        return existingFormatter;
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    dayKeyFormatters.set(timeZone, formatter);

    return formatter;
}

/** Resolves the calendar day a moment belongs to inside `timeZone`. */
export function timeZoneDayKey(
    value: Date | string | number | null | undefined,
    timeZone: string,
): DayKey {
    if (value === null || value === undefined || value === '') {
        return unknownDayKey;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return unknownDayKey;
    }

    const parts = Object.fromEntries(
        dayKeyFormatter(timeZone)
            .formatToParts(date)
            .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Turns a day key back into the UTC midnight date that represents it. */
export function dayKeyToUtcDate(dayKey: DayKey) {
    const match = dayKeyPattern.exec(dayKey);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}
