export type CatBehavior =
    | 'pillow'
    | 'roam'
    | 'cover'
    | 'low-entity'
    | 'stalk-bird';

export type CatWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type CatBehaviorAvailability = Partial<Record<CatBehavior, boolean>>;

type WeightedBehavior = {
    behavior: CatBehavior;
    dayWeight: number;
};

const CAT_DAY_RANGE_BLOCKS = 7.5;
const CAT_NIGHT_RANGE_BLOCKS = 1.7;
const CAT_SHELTER_RANGE_BLOCKS = 5.5;
const catBirdStalkChance = 0.42;

const behaviorWeights = [
    { behavior: 'pillow', dayWeight: 0.08 },
    { behavior: 'roam', dayWeight: 0.45 },
    { behavior: 'cover', dayWeight: 0.12 },
    { behavior: 'low-entity', dayWeight: 0.14 },
    { behavior: 'stalk-bird', dayWeight: 0.21 },
] satisfies WeightedBehavior[];

export function isCatNight(timeOfDay: number) {
    return timeOfDay <= 0.21 || timeOfDay >= 0.79;
}

export function isCatHighSun(
    timeOfDay: number,
    weather: CatWeather | null | undefined,
) {
    return (
        timeOfDay >= 0.43 &&
        timeOfDay <= 0.62 &&
        (weather?.cloudy ?? 0) < 0.35 &&
        (weather?.foggy ?? 0) < 0.2 &&
        (weather?.rainy ?? 0) < 0.08 &&
        (weather?.snowy ?? 0) < 0.08
    );
}

export function isCatBadWeather(weather: CatWeather | null | undefined) {
    return (
        (weather?.rainy ?? 0) >= 0.18 ||
        (weather?.snowy ?? 0) >= 0.18 ||
        (weather?.thundery ?? 0) >= 0.12 ||
        (weather?.windSpeed ?? 0) >= 13
    );
}

export function shouldCatSeekCover(
    timeOfDay: number,
    weather: CatWeather | null | undefined,
) {
    return isCatBadWeather(weather) || isCatHighSun(timeOfDay, weather);
}

export function getCatActivityRange(
    timeOfDay: number,
    weather: CatWeather | null | undefined,
) {
    if (isCatNight(timeOfDay)) {
        return CAT_NIGHT_RANGE_BLOCKS;
    }

    if (shouldCatSeekCover(timeOfDay, weather)) {
        return CAT_SHELTER_RANGE_BLOCKS;
    }

    return CAT_DAY_RANGE_BLOCKS;
}

function isBehaviorAvailable(
    behavior: CatBehavior,
    availability: CatBehaviorAvailability,
) {
    return behavior === 'pillow' || availability[behavior] !== false;
}

export function getCatBehaviorWeights(availability: CatBehaviorAvailability) {
    return behaviorWeights.filter(({ behavior }) =>
        isBehaviorAvailable(behavior, availability),
    );
}

export function pickCatBehavior({
    availability,
    random,
    timeOfDay,
    weather,
}: {
    availability: CatBehaviorAvailability;
    random: () => number;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}): CatBehavior {
    if (isCatNight(timeOfDay)) {
        return 'pillow';
    }

    if (shouldCatSeekCover(timeOfDay, weather)) {
        return availability.cover !== false ? 'cover' : 'pillow';
    }

    if (availability['stalk-bird'] !== false && random() < catBirdStalkChance) {
        return 'stalk-bird';
    }

    const weights = getCatBehaviorWeights(availability);
    const totalWeight = weights.reduce(
        (total, item) => total + item.dayWeight,
        0,
    );
    if (totalWeight <= 0) {
        return 'pillow';
    }

    let threshold = random() * totalWeight;
    for (const item of weights) {
        threshold -= item.dayWeight;
        if (threshold <= 0) {
            return item.behavior;
        }
    }

    return 'pillow';
}

export function getCatDwellSeconds({
    behavior,
    random,
    timeOfDay,
    weather,
}: {
    behavior: CatBehavior;
    random: () => number;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}) {
    const amount = random();

    if (behavior === 'pillow') {
        return isCatNight(timeOfDay) ? 34 + amount * 28 : 16 + amount * 20;
    }

    if (behavior === 'cover') {
        return shouldCatSeekCover(timeOfDay, weather)
            ? 28 + amount * 26
            : 16 + amount * 18;
    }

    if (behavior === 'stalk-bird') {
        return 4 + amount * 8;
    }

    if (behavior === 'low-entity') {
        return 8 + amount * 12;
    }

    return 5 + amount * 9;
}
