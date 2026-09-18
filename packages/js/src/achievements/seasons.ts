export const gardenAchievementTimeZone = 'Europe/Zagreb';

export const growingSeasonNames = ['spring', 'summer', 'autumn'] as const;
export type GrowingSeasonName = (typeof growingSeasonNames)[number];

export type GrowingSeason = {
    year: number;
    name: GrowingSeasonName;
};

const seasonKeyPattern = /^season_(\d{4})_(spring|summer|autumn)$/;

export function seasonAchievementKey(season: GrowingSeason) {
    return `season_${season.year}_${season.name}`;
}

export function parseSeasonAchievementKey(
    key: string,
): GrowingSeason | undefined {
    const match = seasonKeyPattern.exec(key);
    if (!match) return undefined;
    const name = match[2];
    if (name !== 'spring' && name !== 'summer' && name !== 'autumn') {
        return undefined;
    }
    return {
        year: Number(match[1]),
        name,
    };
}

function zonedDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: gardenAchievementTimeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

export function getGrowingSeasonForDate(date: Date): GrowingSeason | undefined {
    if (Number.isNaN(date.getTime())) return undefined;
    const { year, month } = zonedDateParts(date);
    if (month >= 3 && month <= 5) return { year, name: 'spring' };
    if (month >= 6 && month <= 8) return { year, name: 'summer' };
    if (month >= 9 && month <= 11) return { year, name: 'autumn' };
    return undefined;
}
