export type BeeWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

const BEE_DAY_START = 0.28;
const BEE_DAY_END = 0.74;
const MAX_BEE_CLOUD_COVER = 0.42;
const MAX_BEE_WIND_SPEED = 1.2;
const MAX_BEE_BAD_WEATHER = 0.05;
const BEE_HABITAT_RADIUS_BLOCKS = 10;

export type BeeTargetPosition = {
    position: {
        x: number;
        z: number;
    };
};

export function isBeeDaytime(timeOfDay: number) {
    return timeOfDay >= BEE_DAY_START && timeOfDay <= BEE_DAY_END;
}

export function isBeeWeatherSuitable(weather: BeeWeather | null | undefined) {
    if (!weather) {
        return false;
    }

    return (
        (weather.cloudy ?? 0) <= MAX_BEE_CLOUD_COVER &&
        (weather.foggy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.rainy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.snowy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.thundery ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.windSpeed ?? 0) <= MAX_BEE_WIND_SPEED
    );
}

export function isBeeActive(
    timeOfDay: number,
    weather: BeeWeather | null | undefined,
) {
    return isBeeDaytime(timeOfDay) && isBeeWeatherSuitable(weather);
}

export function getBeeDwellSeconds(random: () => number) {
    return 2.4 + random() * 3.6;
}

export function getBeeWanderHoverSeconds(random: () => number) {
    return 0.2 + random() * 0.4;
}

export function shouldBeeWanderNext({
    otherFlowerCount,
    currentlyWandering,
    random,
}: {
    otherFlowerCount: number;
    currentlyWandering: boolean;
    random: () => number;
}) {
    if (otherFlowerCount <= 0) {
        return true;
    }
    if (currentlyWandering) {
        return random() < 0.35;
    }
    return random() < 0.4;
}

export function createBeeWanderOffset(random: () => number) {
    const angle = random() * Math.PI * 2;
    const radius = 1.6 + random() * 3.8;
    const lift = 0.5 + random() * 0.9;
    return {
        dx: Math.cos(angle) * radius,
        dy: lift,
        dz: Math.sin(angle) * radius,
    };
}

export function isWithinBeeHabitatRadius(
    left: BeeTargetPosition,
    right: BeeTargetPosition,
) {
    const radiusSquared = BEE_HABITAT_RADIUS_BLOCKS * BEE_HABITAT_RADIUS_BLOCKS;
    const x = left.position.x - right.position.x;
    const z = left.position.z - right.position.z;
    return x * x + z * z <= radiusSquared;
}

export function getBeeHabitatGroups<T extends BeeTargetPosition>(
    flowerTargets: readonly T[],
) {
    const groups: T[][] = [];

    for (const target of flowerTargets) {
        const habitat = groups.find((group) => {
            const anchor = group[0];
            return (
                anchor !== undefined && isWithinBeeHabitatRadius(anchor, target)
            );
        });

        if (habitat) {
            habitat.push(target);
        } else {
            groups.push([target]);
        }
    }

    return groups;
}

export function getBeeSpawnHabitatGroups<T extends BeeTargetPosition>({
    additionalTargets,
    spawnTargets,
}: {
    additionalTargets: readonly T[];
    spawnTargets: readonly T[];
}) {
    return getBeeHabitatGroups(spawnTargets).map((spawnGroup) => [
        ...spawnGroup,
        ...additionalTargets.filter((target) =>
            spawnGroup.some((spawnTarget) =>
                isWithinBeeHabitatRadius(spawnTarget, target),
            ),
        ),
    ]);
}

export function getBeeCount(flowerTargets: readonly BeeTargetPosition[]) {
    return getBeeHabitatGroups(flowerTargets).length;
}
