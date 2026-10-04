type DeterministicCloudSpawnInput = {
    focusX: number;
    focusZ: number;
    laneX: number;
    laneZ: number;
    seed: number;
    spawnHalfX: number;
    spawnHalfZ: number;
};

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, amount: number) {
    return start + (end - start) * amount;
}

export function seededCloudRandom(seed: number) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

export function resolveDeterministicCloudSpawn({
    focusX,
    focusZ,
    laneX,
    laneZ,
    seed,
    spawnHalfX,
    spawnHalfZ,
}: DeterministicCloudSpawnInput) {
    const jitterX = lerp(
        -spawnHalfX * 0.35,
        spawnHalfX * 0.35,
        seededCloudRandom(seed + 10),
    );
    const jitterZ = lerp(
        -spawnHalfZ * 0.35,
        spawnHalfZ * 0.35,
        seededCloudRandom(seed + 11),
    );

    return {
        x: clamp(
            focusX + laneX * spawnHalfX * 0.65 + jitterX,
            focusX - spawnHalfX,
            focusX + spawnHalfX,
        ),
        z: clamp(
            focusZ + laneZ * spawnHalfZ * 0.65 + jitterZ,
            focusZ - spawnHalfZ,
            focusZ + spawnHalfZ,
        ),
    };
}
