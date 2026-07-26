import type {
    SurveyAnalyticsAdminResult,
    SurveyAnalyticsTrendInterval,
} from '@gredice/storage';

const percentageFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent',
});

const decimalFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 2,
});

const trendDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
});

const trendMonthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

function calendarDaySpan(from: string, to: string) {
    const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
    return Math.floor((toTime - fromTime) / 86_400_000) + 1;
}

export function resolveSurveyAnalyticsTrendInterval({
    from,
    to,
}: {
    from?: string | null;
    to?: string | null;
}): SurveyAnalyticsTrendInterval {
    if (!from || !to) return 'month';

    const daySpan = calendarDaySpan(from, to);
    if (daySpan === null || daySpan < 1) return 'month';
    if (daySpan <= 45) return 'day';
    if (daySpan <= 180) return 'week';
    return 'month';
}

export function formatSurveyAnalyticsRate(value: number | null) {
    return value === null || !Number.isFinite(value)
        ? '—'
        : percentageFormatter.format(value);
}

export function formatSurveyAnalyticsNumber(value: number | null) {
    return value === null || !Number.isFinite(value)
        ? '—'
        : decimalFormatter.format(value);
}

export function formatSurveyAnalyticsDuration(seconds: number | null) {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
        return '—';
    }

    const roundedSeconds = Math.round(seconds);
    if (roundedSeconds < 60) return `${roundedSeconds} s`;

    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = roundedSeconds % 60;
    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes} min ${remainingSeconds} s`
            : `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
        ? `${hours} h ${remainingMinutes} min`
        : `${hours} h`;
}

export function formatSurveyTrendBucket(
    bucketKey: string,
    interval: SurveyAnalyticsTrendInterval,
) {
    const date = new Date(`${bucketKey}T00:00:00.000Z`);
    if (interval === 'month') return trendMonthFormatter.format(date);
    if (interval === 'week') {
        return `Tjedan od ${trendDateFormatter.format(date)}`;
    }
    return trendDateFormatter.format(date);
}

export function buildSurveyAnalyticsSummaryCards(
    analytics: SurveyAnalyticsAdminResult,
) {
    return [
        {
            label: 'Dodijeljeno',
            value: analytics.funnel.assigned.toLocaleString('hr-HR'),
            detail: 'Dodjele stvorene u odabranom razdoblju',
        },
        {
            label: 'Otvoreno',
            value: analytics.funnel.reachedOpened.toLocaleString('hr-HR'),
            detail: `${formatSurveyAnalyticsRate(
                analytics.funnel.openRate,
            )} od ${analytics.funnel.assigned.toLocaleString('hr-HR')} dodjela`,
        },
        {
            label: 'Započeto',
            value: analytics.funnel.reachedStarted.toLocaleString('hr-HR'),
            detail: `${formatSurveyAnalyticsRate(
                analytics.funnel.startRate,
            )} od ${analytics.funnel.assigned.toLocaleString('hr-HR')} dodjela`,
        },
        {
            label: 'Predano',
            value: analytics.funnel.reachedSubmitted.toLocaleString('hr-HR'),
            detail: `${formatSurveyAnalyticsRate(
                analytics.funnel.responseRate,
            )} od ${analytics.funnel.assigned.toLocaleString('hr-HR')} dodjela`,
        },
        {
            label: 'Stopa početka',
            value: formatSurveyAnalyticsRate(analytics.funnel.startRate),
            detail: `${analytics.funnel.reachedStarted.toLocaleString(
                'hr-HR',
            )} od ${analytics.funnel.assigned.toLocaleString('hr-HR')} dodjela`,
        },
        {
            label: 'Stopa dovršetka',
            value: formatSurveyAnalyticsRate(analytics.funnel.completionRate),
            detail: `${analytics.funnel.reachedSubmitted.toLocaleString(
                'hr-HR',
            )} od ${analytics.funnel.reachedStarted.toLocaleString(
                'hr-HR',
            )} započetih`,
        },
        {
            label: 'Stopa odgovora',
            value: formatSurveyAnalyticsRate(analytics.funnel.responseRate),
            detail: `${analytics.funnel.reachedSubmitted.toLocaleString(
                'hr-HR',
            )} od ${analytics.funnel.assigned.toLocaleString('hr-HR')} dodjela`,
        },
        {
            label: 'Medijan ispunjavanja',
            value: formatSurveyAnalyticsDuration(
                analytics.responses.medianCompletionSeconds,
            ),
            detail: `${analytics.responses.completionSampleCount.toLocaleString(
                'hr-HR',
            )} valjanih vremenskih parova`,
        },
    ];
}
