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

export type WateringCalendarDayTone =
    | 'none'
    | 'completed'
    | 'scheduled'
    | 'cart'
    | 'preview';

export type WateringCalendarDay = {
    key: string;
    date: Date;
    dayOfMonth: number;
    entries: WateringCalendarEntry[];
    markerSize: number;
    tone: WateringCalendarDayTone;
    totalWeight: number;
};

export type WateringCalendarMonth = {
    key: string;
    date: Date;
    weeks: Array<Array<WateringCalendarDay | null>>;
};

const minimumMarkerSize = 16;
const defaultMarkerSize = 22;
const maximumMarkerSize = 30;
const fallbackEntryWeight = 1;

function parseEntryDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfLocalDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function formatLocalDayKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function formatMonthKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
}

function entryWeight(entry: WateringCalendarEntry) {
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

function toneForDay(
    entries: WateringCalendarEntry[],
    date: Date,
    referenceDate: Date,
): WateringCalendarDayTone {
    if (entries.some((entry) => entry.source === 'preview')) {
        return 'preview';
    }

    if (entries.some((entry) => entry.source === 'cart')) {
        return 'cart';
    }

    if (
        entries.some((entry) => entry.source === 'scheduled') ||
        startOfLocalDay(date).getTime() >
            startOfLocalDay(referenceDate).getTime()
    ) {
        return 'scheduled';
    }

    return 'completed';
}

function monthRange(entries: WateringCalendarEntry[]) {
    const dates = entries
        .map((entry) => parseEntryDate(entry.date))
        .filter((date): date is Date => date !== null)
        .map(startOfLocalDay)
        .sort((left, right) => left.getTime() - right.getTime());

    if (dates.length === 0) {
        return null;
    }

    return {
        from: startOfLocalMonth(dates[0]),
        to: startOfLocalMonth(dates[dates.length - 1]),
    };
}

export function buildWateringCalendarMonths(
    entries: WateringCalendarEntry[],
    referenceDate = new Date(),
): WateringCalendarMonth[] {
    const range = monthRange(entries);
    if (!range) {
        return [];
    }

    const entriesByDay = new Map<string, WateringCalendarEntry[]>();
    for (const entry of entries) {
        const date = parseEntryDate(entry.date);
        if (!date) {
            continue;
        }

        const key = formatLocalDayKey(date);
        entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
    }

    const dayWeights = Array.from(entriesByDay.values()).map((dayEntries) =>
        dayEntries.reduce((sum, entry) => sum + entryWeight(entry), 0),
    );
    const minimumWeight = Math.min(...dayWeights);
    const maximumWeight = Math.max(...dayWeights);
    const months: WateringCalendarMonth[] = [];

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
        const cells: Array<WateringCalendarDay | null> = Array.from({
            length: mondayOffset,
        }).map(() => null);

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(
                firstDay.getFullYear(),
                firstDay.getMonth(),
                day,
            );
            const key = formatLocalDayKey(date);
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
                tone: toneForDay(dayEntries, date, referenceDate),
                totalWeight,
            });
        }

        const trailingCells = (7 - (cells.length % 7)) % 7;
        cells.push(...Array.from({ length: trailingCells }).map(() => null));

        const weeks: WateringCalendarMonth['weeks'] = [];
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
