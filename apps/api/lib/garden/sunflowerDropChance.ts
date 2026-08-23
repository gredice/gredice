export const SUNFLOWER_DROP_BASE_SPAWN_CHANCE = 0.1;

export function getSunflowerDropSpawnChance(sunflowerCount: number) {
    const eligibleSunflowerCount = Math.max(0, Math.floor(sunflowerCount));
    if (eligibleSunflowerCount === 0) {
        return 0;
    }

    return Math.min(
        1,
        1 - (1 - SUNFLOWER_DROP_BASE_SPAWN_CHANCE) ** eligibleSunflowerCount,
    );
}
