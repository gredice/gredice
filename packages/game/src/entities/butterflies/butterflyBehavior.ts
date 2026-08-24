export type ButterflyWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    temperature?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type ButterflyWingVariant = {
    bandVisible: boolean;
    edge: string;
    id: string;
    innerSpotsVisible: boolean;
    label: string;
    outerSpotsVisible: boolean;
    primary: string;
    secondary: string;
    spot: string;
};

export type ButterflySpawnDescriptor = {
    bornAt: number;
    expiresAt: number;
    flapAmplitude: number;
    flapRate: number;
    habitatId: string;
    id: string;
    seed: number;
    spawnSequence: number;
    startTargetIndex: number;
    variantId: ButterflyWingVariant['id'];
};

export type ButterflyLifecycleDecision = 'active' | 'depart' | 'despawn';

export const butterflyWingVariants = [
    {
        id: 'adriatic-blue',
        label: 'Jadransko plava',
        primary: '#4d8fbd',
        secondary: '#9ccfc5',
        edge: '#243846',
        spot: '#f6e4b5',
        bandVisible: true,
        outerSpotsVisible: true,
        innerSpotsVisible: false,
    },
    {
        id: 'copper-cream',
        label: 'Bakreno krem',
        primary: '#c66a32',
        secondary: '#edc58f',
        edge: '#513126',
        spot: '#fff0c9',
        bandVisible: false,
        outerSpotsVisible: true,
        innerSpotsVisible: true,
    },
    {
        id: 'plum-gold',
        label: 'Šljiva i zlato',
        primary: '#744b78',
        secondary: '#d7a64a',
        edge: '#35263d',
        spot: '#f8df93',
        bandVisible: true,
        outerSpotsVisible: false,
        innerSpotsVisible: true,
    },
    {
        id: 'sage-rose',
        label: 'Kadulja i ruža',
        primary: '#799474',
        secondary: '#d8898c',
        edge: '#34473a',
        spot: '#f6e1c8',
        bandVisible: true,
        outerSpotsVisible: true,
        innerSpotsVisible: true,
    },
    {
        id: 'lemon-charcoal',
        label: 'Limun i ugljen',
        primary: '#e9bd3e',
        secondary: '#5d5c57',
        edge: '#272827',
        spot: '#fff0a8',
        bandVisible: false,
        outerSpotsVisible: true,
        innerSpotsVisible: false,
    },
    {
        id: 'sky-coral',
        label: 'Nebo i koralj',
        primary: '#74add0',
        secondary: '#dd7d68',
        edge: '#304c63',
        spot: '#fff1d6',
        bandVisible: true,
        outerSpotsVisible: false,
        innerSpotsVisible: true,
    },
    {
        id: 'terracotta-mint',
        label: 'Terakota i metvica',
        primary: '#b65d3f',
        secondary: '#87b9a0',
        edge: '#4b302a',
        spot: '#f3dbab',
        bandVisible: false,
        outerSpotsVisible: true,
        innerSpotsVisible: true,
    },
    {
        id: 'violet-ivory',
        label: 'Ljubičica i bjelokost',
        primary: '#765a9a',
        secondary: '#e7d7b7',
        edge: '#352d4c',
        spot: '#fff4cf',
        bandVisible: true,
        outerSpotsVisible: true,
        innerSpotsVisible: false,
    },
] as const satisfies readonly ButterflyWingVariant[];

export const butterflyPopulationLimits = {
    global: 6,
    habitat: 2,
    spawnCooldownSeconds: 14,
} as const;

export const butterflyFlowerApproachProbability = 0.9;
export const butterflyFlowerOrbitRadius = {
    min: 0.3,
    max: 1.4,
} as const;

const butterflyDayStart = 0.29;
const butterflyDayEnd = 0.74;
const maxButterflyCloudCover = 0.52;
const maxButterflyBadWeather = 0.06;
const maxButterflyWindSpeed = 1.35;
const minButterflyTemperature = 12;
const maxButterflyTemperature = 35;
const unsuitableDepartureDelaySeconds = 6;
const departureDurationSeconds = 4;

export function hashButterflySeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSeededButterflyRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function createButterflyFlowerOrbitOffset(random: () => number) {
    const angle = random() * Math.PI * 2;
    const radius =
        butterflyFlowerOrbitRadius.min +
        random() *
            (butterflyFlowerOrbitRadius.max - butterflyFlowerOrbitRadius.min);
    return {
        x: Math.cos(angle) * radius,
        y: 0.35 + random() * 0.55,
        z: Math.sin(angle) * radius,
    };
}

export function shouldButterflyApproachFlower(random: () => number) {
    return random() < butterflyFlowerApproachProbability;
}

export function isButterflyDaytime(timeOfDay: number) {
    return timeOfDay >= butterflyDayStart && timeOfDay <= butterflyDayEnd;
}

export function isButterflyWeatherSuitable(
    weather: ButterflyWeather | null | undefined,
) {
    if (!weather) {
        return false;
    }

    const temperature = weather.temperature;
    return (
        (weather.cloudy ?? 0) <= maxButterflyCloudCover &&
        (weather.foggy ?? 0) <= maxButterflyBadWeather &&
        (weather.rainy ?? 0) <= maxButterflyBadWeather &&
        (weather.snowy ?? 0) <= maxButterflyBadWeather &&
        (weather.thundery ?? 0) <= maxButterflyBadWeather &&
        (weather.windSpeed ?? 0) <= maxButterflyWindSpeed &&
        (temperature == null ||
            (temperature >= minButterflyTemperature &&
                temperature <= maxButterflyTemperature))
    );
}

export function isButterflyActive(
    timeOfDay: number,
    weather: ButterflyWeather | null | undefined,
) {
    return isButterflyDaytime(timeOfDay) && isButterflyWeatherSuitable(weather);
}

export function getButterflyWingVariant(variantId: string) {
    return (
        butterflyWingVariants.find((variant) => variant.id === variantId) ??
        butterflyWingVariants[0]
    );
}

export function createButterflySpawnDescriptor({
    bornAt,
    gardenId,
    habitatId,
    spawnSequence,
    targetCount,
}: {
    bornAt: number;
    gardenId: number | string | null | undefined;
    habitatId: string;
    spawnSequence: number;
    targetCount: number;
}): ButterflySpawnDescriptor {
    const seed = hashButterflySeed(
        `${gardenId ?? 'garden'}:${habitatId}:${spawnSequence}`,
    );
    const random = createSeededButterflyRandom(seed);
    const variant =
        butterflyWingVariants[
            Math.floor(random() * butterflyWingVariants.length)
        ] ?? butterflyWingVariants[0];
    const lifetime = 68 + random() * 44;

    return {
        bornAt,
        expiresAt: bornAt + lifetime,
        flapAmplitude: 0.78 + random() * 0.32,
        flapRate: 7.2 + random() * 2.8,
        habitatId,
        id: `${habitatId}:${spawnSequence}`,
        seed,
        spawnSequence,
        startTargetIndex:
            targetCount > 0 ? Math.floor(random() * targetCount) : 0,
        variantId: variant.id,
    };
}

export function canSpawnButterfly({
    activeSpawns,
    habitatId,
    lastSpawnAt,
    now,
}: {
    activeSpawns: readonly Pick<ButterflySpawnDescriptor, 'habitatId'>[];
    habitatId: string;
    lastSpawnAt: number | null;
    now: number;
}) {
    if (activeSpawns.length >= butterflyPopulationLimits.global) {
        return false;
    }

    const habitatPopulation = activeSpawns.filter(
        (spawn) => spawn.habitatId === habitatId,
    ).length;
    if (habitatPopulation >= butterflyPopulationLimits.habitat) {
        return false;
    }

    return (
        lastSpawnAt === null ||
        now - lastSpawnAt >= butterflyPopulationLimits.spawnCooldownSeconds
    );
}

export function getButterflyLifecycleDecision({
    expiresAt,
    habitatAvailable,
    now,
    unsuitableSince,
}: {
    expiresAt: number;
    habitatAvailable: boolean;
    now: number;
    unsuitableSince: number | null;
}): ButterflyLifecycleDecision {
    if (!habitatAvailable) {
        return 'depart';
    }

    const departureStartedAt = Math.min(
        expiresAt,
        (unsuitableSince ?? Number.POSITIVE_INFINITY) +
            unsuitableDepartureDelaySeconds,
    );

    if (now >= departureStartedAt + departureDurationSeconds) {
        return 'despawn';
    }
    if (now >= departureStartedAt) {
        return 'depart';
    }
    return 'active';
}

export function getButterflyAvatarAvoidanceOffset({
    avatarPosition,
    butterflyPosition,
    radius = 1.25,
}: {
    avatarPosition: { x: number; y: number; z: number } | null;
    butterflyPosition: { x: number; y: number; z: number };
    radius?: number;
}) {
    if (!avatarPosition) {
        return { x: 0, y: 0, z: 0 };
    }

    const dx = butterflyPosition.x - avatarPosition.x;
    const dz = butterflyPosition.z - avatarPosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= radius) {
        return { x: 0, y: 0, z: 0 };
    }

    const safeDistance = Math.max(distance, 0.001);
    const strength = (1 - safeDistance / radius) * 0.72;
    return {
        x: (dx / safeDistance) * strength,
        y: strength * 0.34,
        z: (dz / safeDistance) * strength,
    };
}

export function getButterflyRestSeconds(random: () => number) {
    return 3.5 + random() * 5.5;
}
