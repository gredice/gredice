export type HarvestTraceWateringGridItem = {
    isWatering?: boolean;
    occurredAt: string;
    operationCount?: number;
};

export type HarvestTraceWateringGridDay = {
    count: number;
    date: Date;
    intensity: 0 | 1 | 2 | 3 | 4;
    isInTraceRange: boolean;
    key: string;
};

export type HarvestTraceWateringGridWeek = {
    days: HarvestTraceWateringGridDay[];
    key: string;
};

function startOfLocalDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateFromUnknown(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getMonday(date: Date) {
    const day = date.getDay();
    return addDays(date, day === 0 ? -6 : 1 - day);
}

function getSunday(date: Date) {
    return addDays(getMonday(date), 6);
}

export function formatHarvestTraceWateringDayKey(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function wateringCount(item: HarvestTraceWateringGridItem) {
    if (item.isWatering !== true) {
        return 0;
    }

    return typeof item.operationCount === 'number' && item.operationCount > 0
        ? Math.floor(item.operationCount)
        : 1;
}

function intensityForCount(
    count: number,
    maximumCount: number,
): 0 | 1 | 2 | 3 | 4 {
    if (count === 0 || maximumCount === 0) {
        return 0;
    }

    return Math.max(1, Math.ceil((count / maximumCount) * 4)) as 1 | 2 | 3 | 4;
}

export function buildHarvestTraceWateringGrid(
    items: HarvestTraceWateringGridItem[],
) {
    const datedItems = items.flatMap((item) => {
        const date = dateFromUnknown(item.occurredAt);
        return date ? [{ date, item }] : [];
    });

    if (datedItems.length === 0) {
        return [];
    }

    const wateringCounts = new Map<string, number>();
    for (const { date, item } of datedItems) {
        const count = wateringCount(item);
        if (count === 0) {
            continue;
        }

        const key = formatHarvestTraceWateringDayKey(date);
        wateringCounts.set(key, (wateringCounts.get(key) ?? 0) + count);
    }

    const maximumCount = Math.max(0, ...wateringCounts.values());
    const sortedDates = datedItems
        .map(({ date }) => date)
        .sort((left, right) => left.getTime() - right.getTime());
    const traceStart = sortedDates[0];
    const traceEnd = sortedDates.at(-1);

    if (!traceStart || !traceEnd) {
        return [];
    }

    const gridStart = getMonday(traceStart);
    const gridEnd = getSunday(traceEnd);
    const weeks: HarvestTraceWateringGridWeek[] = [];

    for (
        let weekStart = gridStart;
        weekStart.getTime() <= gridEnd.getTime();
        weekStart = addDays(weekStart, 7)
    ) {
        const days = Array.from({ length: 7 }, (_, dayIndex) => {
            const date = addDays(weekStart, dayIndex);
            const key = formatHarvestTraceWateringDayKey(date);
            const count = wateringCounts.get(key) ?? 0;

            return {
                count,
                date,
                intensity: intensityForCount(count, maximumCount),
                isInTraceRange:
                    date.getTime() >= traceStart.getTime() &&
                    date.getTime() <= traceEnd.getTime(),
                key,
            };
        });

        weeks.push({
            days,
            key: formatHarvestTraceWateringDayKey(weekStart),
        });
    }

    return weeks;
}
