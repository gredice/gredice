const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// The recurring window and peak ZHR follow the International Meteor
// Organization calendar. The product multiplier intentionally makes the
// in-game shower twice as dense as that real-world baseline.
export const PERSEIDS_DENSITY_MULTIPLIER = 2;
export const PERSEIDS_REAL_EDGE_RATE_PER_HOUR = 1;
export const PERSEIDS_REAL_PEAK_ZHR = 100;

const PERSEIDS_START_MONTH_INDEX = 6;
const PERSEIDS_START_DAY = 17;
const PERSEIDS_PEAK_MONTH_INDEX = 7;
const PERSEIDS_PEAK_DAY = 13;
const PERSEIDS_END_MONTH_INDEX = 7;
const PERSEIDS_END_DAY = 24;

export type PerseidsMeteorDefinition = {
    brightness: number;
    durationSeconds: number;
    end: [x: number, y: number];
    fireball: boolean;
    start: [x: number, y: number];
    trailFraction: number;
    width: number;
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function localDateTimestamp(date: Date) {
    return Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
    );
}

function dateTimestamp(
    year: number,
    monthIndex: number,
    day: number,
    hour = 0,
) {
    return Date.UTC(year, monthIndex, day, hour);
}

export function getPerseidsRealRatePerHour(date: Date) {
    if (!Number.isFinite(date.getTime())) {
        return 0;
    }

    const year = date.getFullYear();
    const timestamp = localDateTimestamp(date);
    const start = dateTimestamp(
        year,
        PERSEIDS_START_MONTH_INDEX,
        PERSEIDS_START_DAY,
    );
    const peak = dateTimestamp(
        year,
        PERSEIDS_PEAK_MONTH_INDEX,
        PERSEIDS_PEAK_DAY,
    );
    const endExclusive = dateTimestamp(
        year,
        PERSEIDS_END_MONTH_INDEX,
        PERSEIDS_END_DAY + 1,
    );

    if (timestamp < start || timestamp >= endExclusive) {
        return 0;
    }

    const normalizedActivity =
        timestamp <= peak
            ? ((timestamp - start) / (peak - start)) ** 4
            : ((endExclusive - timestamp) / (endExclusive - peak)) ** 3;

    return (
        PERSEIDS_REAL_EDGE_RATE_PER_HOUR +
        (PERSEIDS_REAL_PEAK_ZHR - PERSEIDS_REAL_EDGE_RATE_PER_HOUR) *
            clamp01(normalizedActivity)
    );
}

export function getPerseidsMeteorRatePerHour(date: Date) {
    return getPerseidsRealRatePerHour(date) * PERSEIDS_DENSITY_MULTIPLIER;
}

export function shouldRenderPerseids({
    date,
    skyVisibility,
}: {
    date: Date;
    skyVisibility: number;
}) {
    return (
        Number.isFinite(skyVisibility) &&
        skyVisibility > 0 &&
        getPerseidsMeteorRatePerHour(date) > 0
    );
}

export function samplePerseidsIntervalSeconds({
    meteorsPerHour,
    random = Math.random,
}: {
    meteorsPerHour: number;
    random?: () => number;
}) {
    if (!Number.isFinite(meteorsPerHour) || meteorsPerHour <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    const sample = Math.min(
        1 - Number.EPSILON,
        Math.max(Number.EPSILON, random()),
    );
    return (-Math.log(1 - sample) * 60 * 60) / meteorsPerHour;
}

function randomBetween(min: number, max: number, random: () => number) {
    return min + (max - min) * clamp01(random());
}

export function createPerseidsMeteor(
    random: () => number = Math.random,
): PerseidsMeteorDefinition {
    // The shared upper-left radiant makes the streaks read as one shower while
    // the varied endpoints spread them across the player's visible sky.
    const radiantX = randomBetween(0.12, 0.28, random);
    const radiantY = randomBetween(0.78, 0.92, random);
    const endX = randomBetween(0.52, 1.08, random);
    const endY = randomBetween(-0.08, 0.64, random);
    const directionX = endX - radiantX;
    const directionY = endY - radiantY;
    const directionLength = Math.max(
        Number.EPSILON,
        Math.hypot(directionX, directionY),
    );
    const startDistance = randomBetween(0.03, 0.16, random);
    const start: [number, number] = [
        radiantX + (directionX / directionLength) * startDistance,
        radiantY + (directionY / directionLength) * startDistance,
    ];
    const fireball = random() < 0.06;

    return {
        brightness: fireball
            ? randomBetween(1.25, 1.55, random)
            : randomBetween(0.78, 1.08, random),
        durationSeconds: fireball
            ? randomBetween(0.85, 1.15, random)
            : randomBetween(0.46, 0.72, random),
        end: [endX, endY],
        fireball,
        start,
        trailFraction: fireball
            ? randomBetween(0.34, 0.46, random)
            : randomBetween(0.2, 0.34, random),
        width: fireball
            ? randomBetween(0.13, 0.18, random)
            : randomBetween(0.065, 0.105, random),
    };
}

export function getPerseidsActiveWindowDurationDays() {
    const referenceYear = 2026;
    const start = dateTimestamp(
        referenceYear,
        PERSEIDS_START_MONTH_INDEX,
        PERSEIDS_START_DAY,
    );
    const endExclusive = dateTimestamp(
        referenceYear,
        PERSEIDS_END_MONTH_INDEX,
        PERSEIDS_END_DAY + 1,
    );
    return (endExclusive - start) / MILLISECONDS_PER_DAY;
}
