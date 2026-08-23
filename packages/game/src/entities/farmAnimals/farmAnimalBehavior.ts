export type FarmAnimalSpecies = 'Chicken' | 'Piglet' | 'Sheep';

export type ChickenBehavior =
    | 'home'
    | 'roam'
    | 'forage'
    | 'dust-bathe'
    | 'cover'
    | 'follow-avatar';

export type PigletBehavior =
    | 'home'
    | 'roam'
    | 'root'
    | 'wallow'
    | 'cover'
    | 'follow-avatar';

export type SheepBehavior =
    | 'home'
    | 'roam'
    | 'graze'
    | 'chew-cud'
    | 'follow-avatar';

export type FarmAnimalBehavior =
    | ChickenBehavior
    | PigletBehavior
    | SheepBehavior;

export type FarmAnimalWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type FarmAnimalBehaviorAvailability = Partial<
    Record<FarmAnimalBehavior, boolean>
>;

export type FarmAnimalBehaviorWeight = {
    behavior: FarmAnimalBehavior;
    weight: number;
};

type FarmAnimalWeatherThresholds = {
    rainy: number;
    snowy: number;
    thundery: number;
    windSpeed: number;
};

const behaviorWeightsBySpecies = {
    Chicken: [
        { behavior: 'home', weight: 0.08 },
        { behavior: 'roam', weight: 0.22 },
        { behavior: 'forage', weight: 0.38 },
        { behavior: 'dust-bathe', weight: 0.2 },
        { behavior: 'cover', weight: 0.12 },
    ],
    Piglet: [
        { behavior: 'home', weight: 0.07 },
        { behavior: 'roam', weight: 0.25 },
        { behavior: 'root', weight: 0.34 },
        { behavior: 'wallow', weight: 0.22 },
        { behavior: 'cover', weight: 0.12 },
    ],
    Sheep: [
        { behavior: 'home', weight: 0.08 },
        { behavior: 'roam', weight: 0.2 },
        { behavior: 'graze', weight: 0.43 },
        { behavior: 'chew-cud', weight: 0.29 },
    ],
} satisfies Record<FarmAnimalSpecies, FarmAnimalBehaviorWeight[]>;

const adverseWeatherThresholdsBySpecies = {
    Chicken: {
        rainy: 0.22,
        snowy: 0.12,
        thundery: 0.08,
        windSpeed: 12,
    },
    Piglet: {
        rainy: 0.55,
        snowy: 0.2,
        thundery: 0.1,
        windSpeed: 15,
    },
    Sheep: {
        rainy: 0.7,
        snowy: 0.35,
        thundery: 0.12,
        windSpeed: 18,
    },
} satisfies Record<FarmAnimalSpecies, FarmAnimalWeatherThresholds>;

const daytimeActivityRangeBySpecies = {
    Chicken: 5.5,
    Piglet: 7,
    Sheep: 6.5,
} satisfies Record<FarmAnimalSpecies, number>;

const shelteredActivityRangeBySpecies = {
    Chicken: 1.1,
    Piglet: 1.4,
    Sheep: 1.8,
} satisfies Record<FarmAnimalSpecies, number>;

export function isFarmAnimalNight(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}

export function isFarmAnimalAdverseWeather(
    species: FarmAnimalSpecies,
    weather: FarmAnimalWeather | null | undefined,
) {
    const thresholds = adverseWeatherThresholdsBySpecies[species];

    return (
        (weather?.rainy ?? 0) >= thresholds.rainy ||
        (weather?.snowy ?? 0) >= thresholds.snowy ||
        (weather?.thundery ?? 0) >= thresholds.thundery ||
        (weather?.windSpeed ?? 0) >= thresholds.windSpeed
    );
}

export function getFarmAnimalActivityRange({
    species,
    timeOfDay,
    weather,
}: {
    species: FarmAnimalSpecies;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    if (
        isFarmAnimalNight(timeOfDay) ||
        isFarmAnimalAdverseWeather(species, weather)
    ) {
        return shelteredActivityRangeBySpecies[species];
    }

    return daytimeActivityRangeBySpecies[species];
}

export function getFarmAnimalBehaviorWeights({
    species,
    availability,
}: {
    species: FarmAnimalSpecies;
    availability: FarmAnimalBehaviorAvailability;
}) {
    return behaviorWeightsBySpecies[species].filter(
        ({ behavior }) =>
            behavior === 'home' || availability[behavior] !== false,
    );
}

export function pickFarmAnimalBehavior({
    species,
    availability,
    followingAvatar = false,
    random,
    timeOfDay,
    weather,
}: {
    species: FarmAnimalSpecies;
    availability: FarmAnimalBehaviorAvailability;
    followingAvatar?: boolean;
    random: () => number;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}): FarmAnimalBehavior {
    if (
        isFarmAnimalNight(timeOfDay) ||
        isFarmAnimalAdverseWeather(species, weather)
    ) {
        return 'home';
    }

    if (followingAvatar && availability['follow-avatar'] !== false) {
        return 'follow-avatar';
    }

    const weights = getFarmAnimalBehaviorWeights({ species, availability });
    const totalWeight = weights.reduce((total, item) => total + item.weight, 0);
    if (totalWeight <= 0) {
        return 'home';
    }

    let threshold = random() * totalWeight;
    for (const item of weights) {
        threshold -= item.weight;
        if (threshold <= 0) {
            return item.behavior;
        }
    }

    return 'home';
}

function getChickenDwellRange(
    behavior: FarmAnimalBehavior,
): readonly [number, number] {
    if (behavior === 'forage') {
        return [4, 8];
    }
    if (behavior === 'dust-bathe') {
        return [5, 10];
    }
    if (behavior === 'cover') {
        return [8, 14];
    }
    if (behavior === 'roam') {
        return [3, 7];
    }

    return [7, 13];
}

function getPigletDwellRange(
    behavior: FarmAnimalBehavior,
): readonly [number, number] {
    if (behavior === 'root') {
        return [5, 10];
    }
    if (behavior === 'wallow') {
        return [7, 13];
    }
    if (behavior === 'cover') {
        return [8, 15];
    }
    if (behavior === 'roam') {
        return [4, 8];
    }

    return [8, 15];
}

function getSheepDwellRange(
    behavior: FarmAnimalBehavior,
): readonly [number, number] {
    if (behavior === 'graze') {
        return [6, 11];
    }
    if (behavior === 'chew-cud') {
        return [5, 9];
    }
    if (behavior === 'roam') {
        return [4, 7];
    }

    return [7, 13];
}

export function getFarmAnimalDwellSeconds({
    species,
    behavior,
    random,
    timeOfDay,
    weather,
}: {
    species: FarmAnimalSpecies;
    behavior: FarmAnimalBehavior;
    random: () => number;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    if (behavior === 'follow-avatar') {
        return 1;
    }

    if (behavior === 'home') {
        if (isFarmAnimalNight(timeOfDay)) {
            const minimum = species === 'Chicken' ? 24 : 26;
            const maximum = species === 'Chicken' ? 42 : 44;
            return minimum + random() * (maximum - minimum);
        }

        if (isFarmAnimalAdverseWeather(species, weather)) {
            const minimum = species === 'Chicken' ? 18 : 16;
            const maximum = species === 'Chicken' ? 30 : 28;
            return minimum + random() * (maximum - minimum);
        }
    }

    const [minimum, maximum] =
        species === 'Chicken'
            ? getChickenDwellRange(behavior)
            : species === 'Piglet'
              ? getPigletDwellRange(behavior)
              : getSheepDwellRange(behavior);
    return minimum + random() * (maximum - minimum);
}
