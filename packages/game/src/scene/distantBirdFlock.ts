import { SeededRNG } from '../generators/plant/lib/rng';
import type { Stack } from '../types/Stack';
import type { GameQualityProfileTier } from './gameQuality';

export const distantBirdFlockSlotSeconds = 360;
export const distantBirdFlockCaps: Record<GameQualityProfileTier, number> = {
    low: 0,
    'auto-constrained': 0,
    medium: 3,
    high: 5,
    custom: 5,
};

export function resolveDistantBirdFlockCount({
    tier,
    enabled = true,
    reducedMotion = false,
    rain = 0,
    snow = 0,
    fog = 0,
    windSpeed = 0,
}: {
    tier: GameQualityProfileTier;
    enabled?: boolean;
    reducedMotion?: boolean;
    rain?: number;
    snow?: number;
    fog?: number;
    windSpeed?: number;
}) {
    if (
        !enabled ||
        reducedMotion ||
        ![rain, snow, fog, windSpeed].every(Number.isFinite) ||
        rain >= 0.5 ||
        snow > 0.05 ||
        fog >= 0.6 ||
        windSpeed >= 12
    )
        return 0;
    return distantBirdFlockCaps[tier];
}

export function createDistantBirdFlockWindow(seed: string, slot: number) {
    const rng = new SeededRNG(`distant-birds:v1:${seed}:${slot}`);
    return {
        slot,
        start: slot * distantBirdFlockSlotSeconds + rng.nextRange(75, 155),
        duration: rng.nextRange(24, 28),
        direction: rng.nextFloat() < 0.5 ? -1 : 1,
        phase: rng.nextRange(0, Math.PI * 2),
    };
}

export function sampleDistantBirdFlockWindow(seed: string, seconds: number) {
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const slot = Math.floor(time / distantBirdFlockSlotSeconds);
    const window = createDistantBirdFlockWindow(seed, slot);
    const progress = (time - window.start) / window.duration;
    const active =
        time >= window.start && time < window.start + window.duration;
    return {
        ...window,
        active,
        progress,
        opacity: active ? Math.min(1, progress * 6, (1 - progress) * 6) : 0,
        nextStart:
            time < window.start
                ? window.start
                : createDistantBirdFlockWindow(seed, slot + 1).start,
    };
}

/** All flight positions stay beyond the garden's positive-Z footprint. */
export function resolveDistantBirdFlockBounds(stacks?: Stack[]) {
    let minX = Infinity;
    let maxX = -Infinity;
    let maxZ = 0;
    for (const { position } of stacks ?? []) {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.z))
            continue;
        minX = Math.min(minX, position.x);
        maxX = Math.max(maxX, position.x);
        maxZ = Math.max(maxZ, position.z);
    }
    const hasPositions = Number.isFinite(minX);
    return {
        centerX: hasPositions ? (minX + maxX) / 2 : 0,
        backZ: maxZ + 8,
        span: Math.max(35, hasPositions ? (maxX - minX) / 2 + 30 : 35),
    };
}

export function sampleDistantBirdPosition(
    window: ReturnType<typeof sampleDistantBirdFlockWindow>,
    bounds: ReturnType<typeof resolveDistantBirdFlockBounds>,
    index: number,
) {
    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.ceil(index / 2);
    return {
        x:
            bounds.centerX +
            window.direction *
                ((window.progress * 2 - 1) * bounds.span - row * 0.7),
        y:
            6 +
            Math.sin(window.progress * Math.PI * 2 + window.phase) * 0.12 +
            row * 0.1,
        z: bounds.backZ + row * side * 0.55,
        roll:
            Math.sin(
                window.progress * Math.PI * 2 + window.phase + index * 0.1,
            ) * 0.08,
    };
}

/** Fade before the camera edge, including changes of framing during a crossing. */
export function distantBirdFramingOpacity(x: number, y: number, z: number) {
    if (![x, y, z].every(Number.isFinite) || z < -1 || z > 1) return 0;
    return Math.max(
        0,
        Math.min(1, (1 - Math.abs(x)) / 0.2, (1 - Math.abs(y)) / 0.2),
    );
}
