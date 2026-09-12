const dayMilliseconds = 24 * 60 * 60 * 1000;
const pluralRules = new Intl.PluralRules('hr');

function durationLabel(value: number, one: string, few: string, other: string) {
    const plural = pluralRules.select(value);
    return `${value} ${plural === 'one' ? one : plural === 'few' ? few : other}`;
}

export function formatProfileMembership(createdAt: string, now = new Date()) {
    const joined = new Date(createdAt);
    if (!Number.isFinite(joined.getTime())) {
        return null;
    }

    const currentDate = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    );
    const joinedDate = Date.UTC(
        joined.getUTCFullYear(),
        joined.getUTCMonth(),
        joined.getUTCDate(),
    );
    const days = Math.max(
        0,
        Math.floor((currentDate - joinedDate) / dayMilliseconds),
    );
    const lastDayOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const anniversaryDay = Math.min(joined.getUTCDate(), lastDayOfMonth);
    const months =
        (now.getUTCFullYear() - joined.getUTCFullYear()) * 12 +
        now.getUTCMonth() -
        joined.getUTCMonth() -
        (now.getUTCDate() < anniversaryDay ? 1 : 0);

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
