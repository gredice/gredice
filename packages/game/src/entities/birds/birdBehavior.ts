export type BirdBehavior =
    | 'home'
    | 'air'
    | 'circle'
    | 'tree'
    | 'entity'
    | 'ground';

export type BirdBehaviorAvailability = Partial<Record<BirdBehavior, boolean>>;

type WeightedBehavior = {
    behavior: BirdBehavior;
    dayWeight: number;
    nightWeight: number;
};

const BIRD_DAY_RANGE_BLOCKS = 10;
const BIRD_NIGHT_RANGE_BLOCKS = 3;

const behaviorWeights = [
    { behavior: 'home', dayWeight: 0.18, nightWeight: 0.68 },
    { behavior: 'air', dayWeight: 0.28, nightWeight: 0.09 },
    { behavior: 'circle', dayWeight: 0.12, nightWeight: 0.02 },
    { behavior: 'tree', dayWeight: 0.18, nightWeight: 0.08 },
    { behavior: 'entity', dayWeight: 0.16, nightWeight: 0.06 },
    { behavior: 'ground', dayWeight: 0.2, nightWeight: 0.09 },
] satisfies WeightedBehavior[];

export function isBirdNight(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}

export function getBirdActivityRange(timeOfDay: number) {
    return isBirdNight(timeOfDay)
        ? BIRD_NIGHT_RANGE_BLOCKS
        : BIRD_DAY_RANGE_BLOCKS;
}

export function getBirdBehaviorWeights(
    timeOfDay: number,
    availability: BirdBehaviorAvailability,
) {
    const isNight = isBirdNight(timeOfDay);
    return behaviorWeights
        .map(({ behavior, dayWeight, nightWeight }) => ({
            behavior,
            weight: isNight ? nightWeight : dayWeight,
        }))
        .filter(
            ({ behavior }) =>
                behavior === 'home' || availability[behavior] !== false,
        );
}

export function pickBirdBehavior(
    timeOfDay: number,
    availability: BirdBehaviorAvailability,
    random: () => number,
): BirdBehavior {
    const weights = getBirdBehaviorWeights(timeOfDay, availability);
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

export function getBirdDwellSeconds(
    behavior: BirdBehavior,
    timeOfDay: number,
    random: () => number,
) {
    const night = isBirdNight(timeOfDay);
    const amount = random();

    if (behavior === 'home') {
        return night ? 20 + amount * 10 : 10 + amount * 20;
    }

    if (behavior === 'air') {
        return night ? 10 + amount * 10 : 10 + amount * 20;
    }

    if (behavior === 'circle') {
        return night ? 10 + amount * 10 : 10 + amount * 20;
    }

    if (behavior === 'ground') {
        return night ? 10 + amount * 12 : 10 + amount * 20;
    }

    return night ? 12 + amount * 12 : 10 + amount * 20;
}
