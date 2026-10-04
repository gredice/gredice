export type CalendarRangeInput = {
    start?: number | string | null;
    end?: number | string | null;
};

export type CalendarRangePosition = {
    isStart: boolean;
    isEnd: boolean;
    left: string;
    right: string;
};

type MonthBoundary = {
    month: number;
    fraction: number;
};

type NormalizedCalendarRange = {
    start: MonthBoundary;
    end: MonthBoundary;
};

function parseMonthBoundary(value: number | string | null | undefined) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return null;
    }

    const parsed =
        typeof value === 'number' ? value : Number.parseFloat(value.trim());

    if (!Number.isFinite(parsed)) {
        return null;
    }

    const flooredMonth = Math.floor(parsed);

    return {
        month: Math.min(12, Math.max(1, flooredMonth)),
        fraction: Math.min(0.99, Math.max(0, parsed - flooredMonth)),
    };
}

function normalizeRange(
    range: CalendarRangeInput,
): NormalizedCalendarRange | null {
    const start = parseMonthBoundary(range.start);
    const end = parseMonthBoundary(range.end ?? range.start);

    if (!start || !end) {
        return null;
    }

    return { start, end };
}

function isMonthInRange(range: NormalizedCalendarRange, month: number) {
    if (range.start.month <= range.end.month) {
        return month >= range.start.month && month <= range.end.month;
    }

    return month >= range.start.month || month <= range.end.month;
}

export function getCalendarRangePosition(
    ranges: readonly CalendarRangeInput[] | undefined,
    month: number,
): CalendarRangePosition | null {
    const activeRanges =
        ranges
            ?.map(normalizeRange)
            .filter(
                (range): range is NormalizedCalendarRange =>
                    range !== null && isMonthInRange(range, month),
            ) ?? [];

    if (!activeRanges.length) {
        return null;
    }

    const isStart = activeRanges.some((range) => range.start.month === month);
    const isEnd = activeRanges.some((range) => range.end.month === month);
    const minStartFraction = Math.min(
        ...activeRanges.map((range) => range.start.fraction),
    );
    const maxEndFraction = Math.max(
        ...activeRanges.map((range) => range.end.fraction),
    );

    return {
        isStart,
        isEnd,
        left: isStart ? `${minStartFraction * 100}%` : '0px',
        right: isEnd ? `${Math.min(75, (1 - maxEndFraction) * 100)}%` : '0px',
    };
}
