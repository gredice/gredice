const numberFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 1,
});
const signedNumberFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
});
const percentFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'percent',
    maximumFractionDigits: 1,
});
const signedPercentFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
});
const shortWeekdayFormatter = new Intl.DateTimeFormat('hr-HR', {
    weekday: 'short',
    timeZone: 'UTC',
});
const longDayFormatter = new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
});
const dayMonthFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
});

function dateFromKey(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
}

export function formatDashboardNumber(value: number) {
    return numberFormatter.format(value);
}

export function formatDashboardSignedNumber(value: number) {
    return signedNumberFormatter.format(value);
}

/** Formats a 0–1 ratio as a percentage. */
export function formatDashboardPercent(ratio: number) {
    return percentFormatter.format(ratio);
}

/** Formats a 0–1 ratio as a signed percentage. */
export function formatDashboardSignedPercent(ratio: number) {
    return signedPercentFormatter.format(ratio);
}

export function formatDashboardShortWeekday(date: string) {
    return shortWeekdayFormatter.format(dateFromKey(date));
}

export function formatDashboardLongDay(date: string) {
    return longDayFormatter.format(dateFromKey(date));
}

export function formatDashboardDayMonth(date: string) {
    return dayMonthFormatter.format(dateFromKey(date));
}
