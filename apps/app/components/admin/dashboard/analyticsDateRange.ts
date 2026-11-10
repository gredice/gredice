import {
    addCalendarDays,
    getTimeZoneDateKey,
    getTimeZoneDayRange,
    isCalendarDateKey,
} from '@gredice/storage';

export const analyticsTimeZone = 'Europe/Zagreb';

export type AnalyticsDateRange = {
    startDate: Date;
    endDate: Date;
    dateKeys: string[];
};

export type AnalyticsWeekDay = {
    date: string;
    /** 0 for Sunday through 6 for Saturday, matching `Date.getUTCDay()`. */
    weekday: number;
    isFuture: boolean;
};

function calendarDateKeys(from: string, to: string) {
    const dateKeys = [];

    for (let date = from; date <= to; date = addCalendarDays(date, 1)) {
        dateKeys.push(date);
    }

    return dateKeys;
}

export function analyticsDateKey(date: Date) {
    return getTimeZoneDateKey(date, analyticsTimeZone);
}

export function createAnalyticsDateRange(
    days: number | undefined,
    from?: string,
    to?: string,
    now: Date = new Date(),
): AnalyticsDateRange {
    const today = analyticsDateKey(now);
    const defaultDays =
        typeof days === 'number' && Number.isFinite(days) && days > 0
            ? days
            : 1;
    const defaultFrom = addCalendarDays(today, -(defaultDays - 1));
    let fromDateKey = defaultFrom;
    let toDateKey = today;

    if (
        from &&
        to &&
        isCalendarDateKey(from) &&
        isCalendarDateKey(to) &&
        from <= to
    ) {
        fromDateKey = from;
        toDateKey = to;
    }

    return {
        startDate: getTimeZoneDayRange(fromDateKey, analyticsTimeZone).from,
        endDate: getTimeZoneDayRange(toDateKey, analyticsTimeZone).to,
        dateKeys: calendarDateKeys(fromDateKey, toDateKey),
    };
}

/**
 * Seven calendar days starting at `weekStart`. Days after `today` are marked
 * as future so charts can keep a stable week layout without inventing data.
 */
export function createAnalyticsWeekDays(
    weekStart: string,
    today: string,
): AnalyticsWeekDay[] {
    return Array.from({ length: 7 }, (_, index) => {
        const date = addCalendarDays(weekStart, index);
        return {
            date,
            weekday: new Date(`${date}T00:00:00.000Z`).getUTCDay(),
            isFuture: date > today,
        };
    });
}
