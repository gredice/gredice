import { autumnSeed } from '../scene/autumnState';
import type { GameQualityProfileTier } from '../scene/gameQuality';

export const warmPropCaps = {
    low: 2,
    'auto-constrained': 2,
    medium: 4,
    high: 6,
    custom: 4,
} satisfies Record<GameQualityProfileTier, number>;

export function resolveWarmPropPolicy({
    tier,
    enabled,
    visible,
    reducedMotion,
    rain,
    snow,
}: {
    tier: GameQualityProfileTier;
    enabled: boolean;
    visible: boolean;
    reducedMotion: boolean;
    rain: number;
    snow: number;
}) {
    // Decorative fire goes dormant in heavy precipitation, without changing
    // weather, crops, fuel, or any persisted garden data.
    const active = enabled && visible && rain < 0.66 && snow < 0.1;
    return {
        capacity: active ? warmPropCaps[tier] : 0,
        animate:
            active &&
            !reducedMotion &&
            tier !== 'low' &&
            tier !== 'auto-constrained',
        smokePerSource:
            active && !reducedMotion
                ? tier === 'high'
                    ? 3
                    : tier === 'medium' || tier === 'custom'
                      ? 2
                      : 0
                : 0,
    };
}

export function warmPropPhase(id: string) {
    return autumnSeed(`warm-prop:${id}`);
}

export function warmPropFlicker(time: number, seed: number) {
    return (
        0.9 +
        Math.sin(time * 3.1 + seed * Math.PI * 2) * 0.07 +
        Math.sin(time * 5.7 + seed * 13) * 0.03
    );
}

/** One shared bed of crackle; repeated props never sum into a louder mix. */
export function warmPropCrackleGain(distance: number) {
    return Number.isFinite(distance)
        ? 0.14 * Math.max(0, 1 - Math.max(0, distance - 1) / 7) ** 2
        : 0;
}
