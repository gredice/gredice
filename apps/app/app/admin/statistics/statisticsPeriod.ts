import {
    addCalendarDays,
    getTimeZoneDateKey,
    getTimeZoneDayRange,
    isCalendarDateKey,
} from '@gredice/storage';

const statisticsTimeZone = 'Europe/Zagreb';

export type StatisticsPeriodKey =
    | 'current-year'
    | 'current-month'
    | 'last-7-days'
    | 'last-30-days'
    | 'last-90-days'
    | 'all-time'
    | 'custom';

export type StatisticsPeriodSearchParams = {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
};

const dateLabelFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
});

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function normalizePeriod(value: string | undefined) {
    switch (value) {
        case 'current-year':
        case 'current-month':
        case 'last-7-days':
        case 'last-30-days':
        case 'last-90-days':
        case 'all-time':
        case 'custom':
            return value;
        default:
            return 'current-year';
    }
}

function formatDateKey(dateKey: string) {
    return dateLabelFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function createBoundedPeriod(
    key: StatisticsPeriodKey,
    from: string,
    to: string,
    maxDate: string,
) {
    return {
        key,
        fromDate: getTimeZoneDayRange(from, statisticsTimeZone).from,
        toDate: getTimeZoneDayRange(to, statisticsTimeZone).to,
        pickerFrom: from,
        pickerTo: to,
        maxDate,
        rangeLabel: `${formatDateKey(from)} – ${formatDateKey(to)}`,
    };
}

export function resolveStatisticsPeriod(
    searchParams: StatisticsPeriodSearchParams,
    now: Date = new Date(),
    { allowAllTime = true }: { allowAllTime?: boolean } = {},
) {
    const today = getTimeZoneDateKey(now, statisticsTimeZone);
    const currentYearFrom = `${today.slice(0, 4)}-01-01`;
    const currentYear = createBoundedPeriod(
        'current-year',
        currentYearFrom,
        today,
        today,
    );
    const period = normalizePeriod(firstValue(searchParams.period));

    if (period === 'all-time') {
        if (!allowAllTime) {
            return currentYear;
        }

        return {
            key: period,
            fromDate: undefined,
            toDate: undefined,
            pickerFrom: currentYearFrom,
            pickerTo: today,
            maxDate: today,
            rangeLabel: 'Cijelo razdoblje',
        };
    }

    if (period === 'custom') {
        const from = firstValue(searchParams.from);
        const to = firstValue(searchParams.to);

        if (
            from &&
            to &&
            isCalendarDateKey(from) &&
            isCalendarDateKey(to) &&
            from <= to &&
            to <= today
        ) {
            return createBoundedPeriod(period, from, to, today);
        }

        return currentYear;
    }

    if (period === 'current-month') {
        return createBoundedPeriod(
            period,
            `${today.slice(0, 7)}-01`,
            today,
            today,
        );
    }

    const dayCount =
        period === 'last-7-days'
            ? 7
            : period === 'last-30-days'
              ? 30
              : period === 'last-90-days'
                ? 90
                : null;

    if (dayCount) {
        return createBoundedPeriod(
            period,
            addCalendarDays(today, -(dayCount - 1)),
            today,
            today,
        );
    }

    return currentYear;
}

export function resolveBoundedStatisticsPeriod(
    searchParams: StatisticsPeriodSearchParams,
    now: Date = new Date(),
) {
    const period = resolveStatisticsPeriod(searchParams, now, {
        allowAllTime: false,
    });

    if (!period.fromDate || !period.toDate) {
        throw new Error('Bounded statistics period requires date boundaries.');
    }

    return {
        ...period,
        fromDate: period.fromDate,
        toDate: period.toDate,
    };
}

export function resolveCurrentWeekStatisticsPeriod(now: Date = new Date()) {
    const today = getTimeZoneDateKey(now, statisticsTimeZone);
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    return createBoundedPeriod(
        'custom',
        addCalendarDays(today, -daysSinceMonday),
        today,
        today,
    );
}
