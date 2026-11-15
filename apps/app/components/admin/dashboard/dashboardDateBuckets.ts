import {
    formatDashboardDayMonth,
    formatDashboardLongDay,
    formatDashboardShortWeekday,
} from './dashboardFormat';

/** Keep compact charts readable: daily up to a week, then at most seven equal calendar intervals. */
export function createDashboardDateBuckets(dateKeys: string[]) {
    const size = Math.max(1, Math.ceil(dateKeys.length / 7));
    const buckets = [];
    for (let index = 0; index < dateKeys.length; index += size) {
        const dates = dateKeys.slice(index, index + size);
        const first = dates[0];
        const last = dates[dates.length - 1];
        if (!first || !last) continue;
        buckets.push({
            key: first,
            dates,
            label:
                size === 1
                    ? formatDashboardShortWeekday(first)
                    : formatDashboardDayMonth(first),
            description:
                first === last
                    ? formatDashboardLongDay(first)
                    : `${formatDashboardLongDay(first)} – ${formatDashboardLongDay(last)}`,
        });
    }
    return buckets;
}

export function sumDashboardBucket<T extends { date: string }>(
    data: T[],
    dates: string[],
    value: (point: T) => number,
) {
    const included = new Set(dates);
    return data.reduce(
        (total, point) => total + (included.has(point.date) ? value(point) : 0),
        0,
    );
}
