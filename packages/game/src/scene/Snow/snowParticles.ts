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

// ---------------------------------------------------------------------------
// Restyled snowfall (GAME_ART.md "Weather > Snow"), the target's snow field
// ported: soft two-tone discs and icon snowflakes in a box that covers the
// view and scales with it, so flakes keep their pixel size, speed and
// density at any zoom and on any screen. The world-unit field above is the
// local snow of `BlockSnowFalling` (`Snow.tsx`).
// ---------------------------------------------------------------------------

/** Every number of the restyled snowfall, in one place. */
export const snowFieldStyle = {
    /** Disc diameters in CSS pixels; 50%, 35% and 15% of the discs. */
    discSizesPx: [7, 9.5, 12.5],
    /** Icon flake size range in CSS pixels. */
    iconSizePx: [20, 26],
    /**
     * Fall speed at field scale 1, in world units per second, times a
     * per-flake factor of 0.8 to 1.25: 56 to 88 px/s at zoom 100.
     */
    fallSpeed: 0.7,
    discFallFactor: [0.8, 0.45],
    iconFallFactor: [0.75, 0.3],
    /** Sideways sway in world units at field scale 1. */
    discSway: 0.18,
    iconSway: 0.22,
    /** Icon flake spin in radians per second, either direction. */
    iconSpin: 0.6,
    /** Reduced motion: flakes fall at 25%; icons do not spin; no sparkles. */
    reducedMotionRate: 0.25,
    /** Field scale bounds: half the view height over 4 world units. */
    fieldScaleRange: [0.35, 2.4],
    /** Field box: depth and height are 10 × scale, width covers the view. */
    fieldDepth: 10,
    fieldHeight: 10,
    fieldWidthMargin: 1.5,
    /** The field's centre sits this far above the ground, × scale. */
    fieldLift: 1.5,
    /** Avatar (perspective) views: a fixed box around the camera. */
    avatarFieldWidth: 16,
    avatarUnitsPerPixel: 0.01,
    /**
     * Sparkles on snow cover. They have no frame rate of their own: they hold
     * no render lease and twinkle only on frames another lease renders
     * (`SnowSparkles.tsx`; guarded by the `isRenderingContinuously` test in
     * `GameRuntimeScheduler.unit.ts`).
     */
    sparkleCycleSeconds: 2.6,
    sparkleSizeUnits: 0.13,
    sparkleCoverRange: [0.4, 0.9],
    sparkleSpotCapacity: 64,
    /**
     * Sparkles sit this high above the block top (above the displaced cover).
     */
    sparkleLift: 0.12,
} as const;

export type SnowFieldGeometry = {
    /** Field scale: 1 on a 1280 × 800 view at zoom 100. */
    scale: number;
    /** Box width, height and depth in world units. */
    box: readonly [width: number, height: number, depth: number];
    /** World units per CSS pixel for the flake quads. */
    unitsPerPixel: number;
    /** True in the avatar (perspective) views. */
    perspective: boolean;
};

function clampRange(value: number, [min, max]: readonly [number, number]) {
    return Math.min(max, Math.max(min, value));
}

/**
 * The snow field for an orthographic view (half sizes in world units, zoom
 * in pixels per unit), or the fixed avatar field when `view` is null.
 */
export function resolveSnowFieldGeometry(
    view: {
        halfWidth: number;
        halfHeight: number;
        pixelsPerUnit: number;
    } | null,
): SnowFieldGeometry {
    const style = snowFieldStyle;
    if (!view) {
        return {
            scale: 1,
            box: [
                style.avatarFieldWidth,
                style.fieldHeight,
                style.avatarFieldWidth,
            ],
            unitsPerPixel: style.avatarUnitsPerPixel,
            perspective: true,
        };
    }
    const scale = clampRange(view.halfHeight / 4, style.fieldScaleRange);
    return {
        scale,
        box: [
            2 * Math.max(0, view.halfWidth) + style.fieldWidthMargin * scale,
            style.fieldHeight * scale,
            style.fieldDepth * scale,
        ],
        unitsPerPixel: 1 / Math.max(1e-6, view.pixelsPerUnit),
        perspective: false,
    };
}

function hashKey(key: string) {
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** Small, well-spread seeded generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Four seeds in 0..1 per flake: box position x, y, z and the flake's own
 * value (size class, speed, sway phase). Deterministic per key, so a frozen
 * frame always shows the same flakes, and a larger capacity keeps the first
 * flakes unchanged.
 */
export function createSnowFlakeSeeds(capacity: number, key: string) {
    const count = Math.max(0, Math.floor(capacity));
    const random = mulberry32(hashKey(key));
    const seeds = new Float32Array(count * 4);
    for (let index = 0; index < seeds.length; index += 1) {
        seeds[index] = random();
    }
    return seeds;
}

/**
 * The field's motion clock: scene seconds turned into motion seconds (25%
 * under reduced motion) and the wind drift accumulated so far. Speeds change
 * by rebasing at the current time, so no flake jumps when the wind blends or
 * reduced motion switches.
 */
export type SnowFieldMotion = {
    /** Scene seconds at the last change. */
    epoch: number;
    /** Motion seconds at the epoch. */
    base: number;
    /** Motion seconds per scene second. */
    rate: number;
    /** Drift at the epoch, world XZ, in field-scale units. */
    driftX: number;
    driftZ: number;
    /** Drift per motion second, world XZ, in field-scale units. */
    velocityX: number;
    velocityZ: number;
};

export function createSnowFieldMotion(now: number): SnowFieldMotion {
    return {
        epoch: now,
        base: 0,
        rate: 1,
        driftX: 0,
        driftZ: 0,
        velocityX: 0,
        velocityZ: 0,
    };
}

/** Motion seconds at scene time `now`. */
export function resolveSnowFieldMotionSeconds(
    motion: SnowFieldMotion,
    now: number,
) {
    return motion.base + Math.max(0, now - motion.epoch) * motion.rate;
}

/** Rebases the clock at `now` and applies the new rate and drift speed. */
export function advanceSnowFieldMotion(
    motion: SnowFieldMotion,
    now: number,
    next: { rate: number; velocityX: number; velocityZ: number },
): SnowFieldMotion {
    const seconds = resolveSnowFieldMotionSeconds(motion, now);
    const elapsed = seconds - motion.base;
    return {
        epoch: Math.max(now, motion.epoch),
        base: seconds,
        rate: Math.max(0, next.rate),
        driftX: motion.driftX + motion.velocityX * elapsed,
        driftZ: motion.driftZ + motion.velocityZ * elapsed,
        velocityX: next.velocityX,
        velocityZ: next.velocityZ,
    };
}

/** Drift at a motion time, world XZ, in field-scale units. */
export function resolveSnowFieldDrift(
    motion: SnowFieldMotion,
    seconds: number,
) {
    const elapsed = seconds - motion.base;
    return {
        x: motion.driftX + motion.velocityX * elapsed,
        z: motion.driftZ + motion.velocityZ * elapsed,
    };
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/** Sparkle strength on snow cover: from cover 0.4 to full at 0.9. */
export function resolveSnowSparkleAmount(cover: number) {
    const [from, to] = snowFieldStyle.sparkleCoverRange;
    return smoothstep(from, to, Number.isFinite(cover) ? cover : 0);
}

/** Sparkles on cover: the tier cap × the sparkle amount; none when reduced. */
export function resolveSnowSparkleCount(
    cap: number,
    cover: number,
    reducedMotion: boolean,
) {
    if (reducedMotion) {
        return 0;
    }
    return Math.round(Math.max(0, cap) * resolveSnowSparkleAmount(cover));
}

export type SnowSparkleSpot = { x: number; y: number; z: number };

type SparkleStack = {
    position: { x: number; y: number; z: number };
    blocks: readonly { name: string }[];
};

function isSnowCoverTerrain(name: string) {
    return name.startsWith('Block_') && !/water/i.test(name);
}

/**
 * Tops of the open terrain the cover lies on (stacks whose top block is
 * ground, not water), spread evenly over the garden up to `capacity`. The
 * sparkle shader picks a new spot from this list every cycle.
 */
export function resolveSnowSparkleSpots(
    stacks: readonly SparkleStack[] | null | undefined,
    blockHeight: (name: string, supportName: string | undefined) => number,
    capacity: number = snowFieldStyle.sparkleSpotCapacity,
): SnowSparkleSpot[] {
    const spots: SnowSparkleSpot[] = [];
    for (const stack of stacks ?? []) {
        const top = stack.blocks.at(-1);
        if (!top || !isSnowCoverTerrain(top.name)) {
            continue;
        }
        let height = 0;
        for (const [index, block] of stack.blocks.entries()) {
            height += blockHeight(block.name, stack.blocks[index - 1]?.name);
        }
        spots.push({
            x: stack.position.x,
            y: stack.position.y + height,
            z: stack.position.z,
        });
    }
    spots.sort((a, b) => a.x - b.x || a.z - b.z);
    const limit = Math.max(0, Math.floor(capacity));
    if (spots.length <= limit) {
        return spots;
    }
    // Even spread over the sorted tiles, offset so both garden ends show.
    const stride = spots.length / limit;
    return Array.from(
        { length: limit },
        (_, index) => spots[Math.floor((index + 0.5) * stride)],
    );
}
