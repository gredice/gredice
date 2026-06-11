export type DogBehavior =
    | 'doghouse'
    | 'roam'
    | 'cover'
    | 'low-entity'
    | 'chase-bird';

export type DogWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type DogBehaviorAvailability = Partial<Record<DogBehavior, boolean>>;

type WeightedBehavior = {
    behavior: DogBehavior;
    dayWeight: number;
};

const DOG_DAY_RANGE_BLOCKS = 10.5;
const DOG_NIGHT_RANGE_BLOCKS = 3.2;
const DOG_SHELTER_RANGE_BLOCKS = 7;
const dogBirdChaseChance = 0.32;
const dogNightDoghouseChance = 0.58;

const behaviorWeights = [
    { behavior: 'doghouse', dayWeight: 0.03 },
    { behavior: 'roam', dayWeight: 0.62 },
    { behavior: 'cover', dayWeight: 0.1 },
    { behavior: 'low-entity', dayWeight: 0.1 },
    { behavior: 'chase-bird', dayWeight: 0.15 },
] satisfies WeightedBehavior[];

export function isDogNight(timeOfDay: number) {
    return timeOfDay <= 0.18 || timeOfDay >= 0.83;
}

export function isDogHighSun(
    timeOfDay: number,
    weather: DogWeather | null | undefined,
) {
    return (
        timeOfDay >= 0.45 &&
        timeOfDay <= 0.61 &&
        (weather?.cloudy ?? 0) < 0.25 &&
        (weather?.foggy ?? 0) < 0.18 &&
        (weather?.rainy ?? 0) < 0.08 &&
        (weather?.snowy ?? 0) < 0.08
    );
}

export function isDogBadWeather(weather: DogWeather | null | undefined) {
    return (
        (weather?.rainy ?? 0) >= 0.28 ||
        (weather?.snowy ?? 0) >= 0.24 ||
        (weather?.thundery ?? 0) >= 0.12 ||
        (weather?.windSpeed ?? 0) >= 16
    );
}

export function shouldDogSeekCover(
    timeOfDay: number,
    weather: DogWeather | null | undefined,
) {
    return isDogBadWeather(weather) || isDogHighSun(timeOfDay, weather);
}

export function getDogActivityRange(
    timeOfDay: number,
    weather: DogWeather | null | undefined,
) {
    if (isDogNight(timeOfDay)) {
        return DOG_NIGHT_RANGE_BLOCKS;
    }

    if (shouldDogSeekCover(timeOfDay, weather)) {
        return DOG_SHELTER_RANGE_BLOCKS;
    }

    return DOG_DAY_RANGE_BLOCKS;
}

function isBehaviorAvailable(
    behavior: DogBehavior,
    availability: DogBehaviorAvailability,
) {
    return behavior === 'doghouse' || availability[behavior] !== false;
}

export function getDogBehaviorWeights(availability: DogBehaviorAvailability) {
    return behaviorWeights.filter(({ behavior }) =>
        isBehaviorAvailable(behavior, availability),
    );
}

function pickWeightedDogBehavior({
    availability,
    random,
}: {
    availability: DogBehaviorAvailability;
    random: () => number;
}) {
    const weights = getDogBehaviorWeights(availability);
    const totalWeight = weights.reduce(
        (total, item) => total + item.dayWeight,
        0,
    );
    if (totalWeight <= 0) {
        return 'doghouse';
    }

    let threshold = random() * totalWeight;
    for (const item of weights) {
        threshold -= item.dayWeight;
        if (threshold <= 0) {
            return item.behavior;
        }
    }

    return 'doghouse';
}

export function pickDogBehavior({
    availability,
    random,
    timeOfDay,
    weather,
}: {
    availability: DogBehaviorAvailability;
    random: () => number;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}): DogBehavior {
    if (isDogNight(timeOfDay)) {
        if (random() < dogNightDoghouseChance) {
            return 'doghouse';
        }

        return availability.roam !== false ? 'roam' : 'doghouse';
    }

    if (shouldDogSeekCover(timeOfDay, weather)) {
        return availability.cover !== false ? 'cover' : 'doghouse';
    }

    if (availability['chase-bird'] !== false && random() < dogBirdChaseChance) {
        return 'chase-bird';
    }

    return pickWeightedDogBehavior({ availability, random });
}

export function getDogDwellSeconds({
    behavior,
    random,
    timeOfDay,
    weather,
}: {
    behavior: DogBehavior;
    random: () => number;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}) {
    const amount = random();

    if (behavior === 'doghouse') {
        return isDogNight(timeOfDay) ? 18 + amount * 16 : 6 + amount * 8;
    }

    if (behavior === 'cover') {
        return shouldDogSeekCover(timeOfDay, weather)
            ? 14 + amount * 12
            : 7 + amount * 8;
    }

    if (behavior === 'chase-bird') {
        return 2.5 + amount * 4;
    }

    if (behavior === 'low-entity') {
        return 4 + amount * 7;
    }

    return 2.5 + amount * 5.5;
}
