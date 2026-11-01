import { SeededRNG } from '../../generators/plant/lib/rng';

export const maximumSnowParticleCount = 5000;

type SnowParticleAttributeOptions = {
    capacity: number;
    flakeSize: number;
    heightRange: number;
    random?: () => number;
    seed?: number;
    size: number;
};

type SnowWeatherMotionOptions = {
    gravity: number;
    windDirection: number;
    windSpeed: number;
};

function clampUnit(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}

function randomBetween(random: () => number, min: number, max: number) {
    return min + (max - min) * random();
}

function randomSpread(random: () => number, range: number) {
    return (random() - 0.5) * range;
}

export function resolveSnowParticleCounts(
    intensity: number,
    particleMultiplier: number,
) {
    const normalizedMultiplier = clampUnit(particleMultiplier);
    const capacity = Math.round(
        maximumSnowParticleCount * normalizedMultiplier,
    );
    const activeCount = Math.min(
        capacity,
        Math.round(
            maximumSnowParticleCount *
                normalizedMultiplier *
                clampUnit(intensity),
        ),
    );

    return { activeCount, capacity };
}

export function clampSnowParticleCount(activeCount: number, capacity: number) {
    const normalizedCapacity = Math.max(0, Math.floor(capacity));
    return Math.min(normalizedCapacity, Math.max(0, Math.floor(activeCount)));
}

export function createSnowParticleAttributes({
    capacity,
    flakeSize,
    heightRange,
    random,
    seed,
    size,
}: SnowParticleAttributeOptions) {
    const seeded =
        seed === undefined ? undefined : new SeededRNG(`snow:${seed}`);
    const nextRandom =
        random ?? (seeded ? () => seeded.nextFloat() : Math.random);
    const normalizedCapacity = Math.max(0, Math.floor(capacity));
    const baseAttributes = new Float32Array(normalizedCapacity * 4);
    const motionAttributes = new Float32Array(normalizedCapacity * 4);
    const shapeAttributes = new Float32Array(normalizedCapacity * 4);

    for (let index = 0; index < normalizedCapacity; index += 1) {
        const offset = index * 4;
        baseAttributes[offset] = randomSpread(nextRandom, size);
        baseAttributes[offset + 1] = nextRandom() * heightRange;
        baseAttributes[offset + 2] = randomSpread(nextRandom, size);
        baseAttributes[offset + 3] = randomBetween(nextRandom, 0.55, 1.35);

        motionAttributes[offset] = randomSpread(nextRandom, 0.22);
        motionAttributes[offset + 1] = randomSpread(nextRandom, 0.16);
        motionAttributes[offset + 2] = nextRandom() * Math.PI * 2;
        motionAttributes[offset + 3] = randomBetween(nextRandom, 0.45, 1.25);

        shapeAttributes[offset] =
            flakeSize * randomBetween(nextRandom, 0.75, 1.25);
        shapeAttributes[offset + 1] = randomBetween(nextRandom, 0.86, 1);
    }

    return { baseAttributes, motionAttributes, shapeAttributes };
}

export function resolveSnowWeatherMotion({
    gravity,
    windDirection,
    windSpeed,
}: SnowWeatherMotionOptions) {
    const directionRadians = (windDirection * Math.PI) / 180;

    return {
        fallVelocity: Math.max(0.2, gravity * 280 + windSpeed * 0.08),
        windVelocityX: Math.sin(directionRadians) * windSpeed * 0.3,
        windVelocityZ: -Math.cos(directionRadians) * windSpeed * 0.3,
    };
}

export function advanceSnowMotionOffset(
    offset: number,
    velocity: number,
    elapsed: number,
    range: number,
) {
    const normalizedRange = Math.max(0.001, Math.abs(range));
    const nextOffset = offset + velocity * Math.max(0, elapsed);
    return ((nextOffset % normalizedRange) + normalizedRange) % normalizedRange;
}
