import {
    gardenAchievementTimeZone,
    parseSeasonAchievementKey,
} from '@gredice/js/achievements';

const firstSeasonMonth = { spring: 3, summer: 6, autumn: 9 };

/** Availability follows the same Zagreb calendar as achievement evaluation. */
export function achievementAvailability(key: string, now: Date) {
    const season = parseSeasonAchievementKey(key);
    if (!season) return 'Uvijek dostupno';

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: gardenAchievementTimeZone,
        year: 'numeric',
        month: 'numeric',
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const current = year * 12 + month;
    const start = season.year * 12 + firstSeasonMonth[season.name];
    if (current < start) return 'Sezona tek dolazi';
    if (current >= start + 3) return 'Sezona je završila';
    return 'Dostupno ove sezone';
}
