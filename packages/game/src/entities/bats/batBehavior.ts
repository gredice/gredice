export type BatWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type BatLifecyclePhase =
    | 'hidden'
    | 'emerging'
    | 'foraging'
    | 'returning';

export const batPopulationCaps = {
    global: 6,
    group: 2,
    groupsPerScene: 2,
    scene: 3,
} as const;

export const batDawnEnd = 0.27;
export const batDuskStart = 0.73;
export const batMaxFog = 0.68;
export const batMaxRain = 0.12;
export const batMaxSnow = 0.08;
export const batMaxThunder = 0.08;
export const batMaxWindSpeed = 7;

export function isBatNight(timeOfDay: number) {
    return timeOfDay <= batDawnEnd || timeOfDay >= batDuskStart;
}

export function isBatWeatherSuitable(weather: BatWeather | null | undefined) {
    if (!weather) {
        return false;
    }

    return (
        (weather.foggy ?? 0) <= batMaxFog &&
        (weather.rainy ?? 0) <= batMaxRain &&
        (weather.snowy ?? 0) <= batMaxSnow &&
        (weather.thundery ?? 0) <= batMaxThunder &&
        (weather.windSpeed ?? 0) <= batMaxWindSpeed
    );
}

export function isBatActive(
    timeOfDay: number,
    weather: BatWeather | null | undefined,
) {
    return isBatNight(timeOfDay) && isBatWeatherSuitable(weather);
}

export function hashBatSeed(
    ...parts: Array<number | string | null | undefined>
) {
    let hash = 2_166_136_261;
    for (const part of parts) {
        const text = String(part ?? 'none');
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16_777_619);
        }
    }
    return hash >>> 0;
}

export function createBatRandom(seed: number) {
    let state = seed || 0x6d2b79f5;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

export function resolveBatLifecyclePhase({
    active,
    phase,
    reachedTarget,
}: {
    active: boolean;
    phase: BatLifecyclePhase;
    reachedTarget: boolean;
}): BatLifecyclePhase {
    if (!active) {
        if (phase === 'hidden' || (phase === 'returning' && reachedTarget)) {
            return 'hidden';
        }
        return 'returning';
    }

    if (phase === 'hidden' || phase === 'returning') {
        return 'emerging';
    }
    if (phase === 'emerging' && reachedTarget) {
        return 'foraging';
    }
    return phase;
}

export type BatPopulationGroupPlan = {
    count: number;
    habitatIndex: number;
};

export function planBatPopulation({
    availableSlots,
    habitatSeeds,
}: {
    availableSlots: number;
    habitatSeeds: readonly number[];
}) {
    let remaining = Math.min(
        Math.max(0, Math.floor(availableSlots)),
        batPopulationCaps.scene,
    );
    const groups: BatPopulationGroupPlan[] = [];

    for (
        let habitatIndex = 0;
        habitatIndex <
            Math.min(habitatSeeds.length, batPopulationCaps.groupsPerScene) &&
        remaining > 0;
        habitatIndex += 1
    ) {
        const random = createBatRandom(habitatSeeds[habitatIndex] ?? 1);
        const requested = random() < 0.58 ? 2 : 1;
        const count = Math.min(requested, remaining, batPopulationCaps.group);
        groups.push({ count, habitatIndex });
        remaining -= count;
    }

    return groups;
}

export class BatPopulationRegistry {
    private readonly claims = new Map<string, number>();

    claim(ownerId: string, requested: number) {
        const existing = this.claims.get(ownerId);
        if (existing !== undefined) {
            return existing;
        }
        const claimed = Math.min(
            Math.max(0, Math.floor(requested)),
            batPopulationCaps.scene,
            Math.max(0, batPopulationCaps.global - this.total()),
        );
        if (claimed > 0) {
            this.claims.set(ownerId, claimed);
        }
        return claimed;
    }

    release(ownerId: string) {
        this.claims.delete(ownerId);
    }

    total() {
        let total = 0;
        for (const claim of this.claims.values()) {
            total += claim;
        }
        return total;
    }
}

export const globalBatPopulationRegistry = new BatPopulationRegistry();

export function shouldBatGlide(
    random: () => number,
    completedSegments: number,
) {
    return completedSegments >= 2 && random() < 0.22;
}
