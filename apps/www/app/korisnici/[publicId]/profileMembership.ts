const dayMilliseconds = 24 * 60 * 60 * 1000;
const pluralRules = new Intl.PluralRules('hr');
const calendarFormatter = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
});

function croatianCalendarDate(instant: Date) {
    const parts = calendarFormatter.formatToParts(instant);
    const part = (type: string) =>
        Number(parts.find((entry) => entry.type === type)?.value);
    // UTC represents the Croatian calendar date here, so DST cannot shorten a day.
    return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

function durationLabel(value: number, one: string, few: string, other: string) {
    const plural = pluralRules.select(value);
    return `${value} ${plural === 'one' ? one : plural === 'few' ? few : other}`;
}

export function formatProfileMembership(createdAt: string, now = new Date()) {
    const joinedInstant = new Date(createdAt);
    if (!Number.isFinite(joinedInstant.getTime())) {
        return null;
    }
    const joined = croatianCalendarDate(joinedInstant);
    const today = croatianCalendarDate(now);
    const days = Math.max(
        0,
        Math.floor((today.getTime() - joined.getTime()) / dayMilliseconds),
    );
    const lastDayOfMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const anniversaryDay = Math.min(joined.getUTCDate(), lastDayOfMonth);
    const months =
        (today.getUTCFullYear() - joined.getUTCFullYear()) * 12 +
        today.getUTCMonth() -
        joined.getUTCMonth() -
        (today.getUTCDate() < anniversaryDay ? 1 : 0);

    if (months >= 12) {
        return `Korisnik već ${durationLabel(Math.floor(months / 12), 'godinu', 'godine', 'godina')}`;
    }
    if (months > 0) {
        return `Korisnik već ${durationLabel(months, 'mjesec', 'mjeseca', 'mjeseci')}`;
    }
    if (days > 0) {
        return `Korisnik već ${durationLabel(days, 'dan', 'dana', 'dana')}`;
    }
    return 'Korisnik od danas';
}
