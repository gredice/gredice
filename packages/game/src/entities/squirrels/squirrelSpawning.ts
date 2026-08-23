export const squirrelPopulationCaps = {
    perGarden: 2,
    perHabitat: 1,
} as const;

export const squirrelRespawnCooldownMs = 45_000;

export type SquirrelSpawnHabitat = {
    id: string;
    seed: number;
};

export type SquirrelSpawnCooldown = {
    lastDespawnedAt: number;
    spawnSequence: number;
};

export type SquirrelSpawn = {
    habitatId: string;
    spawnSequence: number;
};

export function hashSquirrelSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSquirrelRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function getSquirrelCooldownRemainingMs({
    cooldown,
    now,
}: {
    cooldown: SquirrelSpawnCooldown | undefined;
    now: number;
}) {
    if (!cooldown) {
        return 0;
    }

    return Math.max(
        0,
        cooldown.lastDespawnedAt + squirrelRespawnCooldownMs - now,
    );
}

export function createSquirrelSpawnPlan({
    cooldowns,
    gardenSeed,
    habitats,
    maxPerGarden = squirrelPopulationCaps.perGarden,
    now,
}: {
    cooldowns: ReadonlyMap<string, SquirrelSpawnCooldown>;
    gardenSeed: string;
    habitats: readonly SquirrelSpawnHabitat[];
    maxPerGarden?: number;
    now: number;
}) {
    return habitats
        .map((habitat) => {
            const spawnSequence = cooldowns.get(habitat.id)?.spawnSequence ?? 0;
            return {
                habitat,
                rank: hashSquirrelSeed(`${gardenSeed}:${habitat.id}`),
                spawnSequence,
            };
        })
        .sort(
            (left, right) =>
                left.rank - right.rank ||
                left.habitat.id.localeCompare(right.habitat.id),
        )
        .slice(0, Math.max(0, maxPerGarden))
        .filter(
            ({ habitat }) =>
                getSquirrelCooldownRemainingMs({
                    cooldown: cooldowns.get(habitat.id),
                    now,
                }) === 0,
        )
        .map(
            ({ habitat, spawnSequence }) =>
                ({
                    habitatId: habitat.id,
                    spawnSequence,
                }) satisfies SquirrelSpawn,
        );
}

export function reconcileSquirrelCooldowns({
    cooldowns,
    habitats,
}: {
    cooldowns: ReadonlyMap<string, SquirrelSpawnCooldown>;
    habitats: readonly SquirrelSpawnHabitat[];
}) {
    const habitatIds = new Set(habitats.map((habitat) => habitat.id));
    const reconciled = new Map(
        Array.from(cooldowns).filter(([id]) => habitatIds.has(id)),
    );

    return reconciled;
}
