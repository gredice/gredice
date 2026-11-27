import type { GameQualityProfile } from '../gameQuality';

/**
 * Weather caps per quality tier (GAME_ART.md "Weather > Quality tiers").
 * They derive from the quality profile: the rain and snow multipliers are
 * the profile's own, everything else follows the profile's tier. Saved
 * custom quality profiles get no new fields; a custom or auto-constrained
 * profile maps onto the nearest tier.
 */
export type WeatherTier = 'low' | 'medium' | 'high';

export type WeatherTierCaps = {
    tier: WeatherTier;
    /** Separate clouds in the top band, plus the deck (10 / 7 / 4). */
    bandClouds: number;
    /** Moving cloud-shadow ellipses (6 / 4 / 0). */
    cloudShadows: number;
    /** Heavy-rain drops on a 1280 × 800 view at multiplier 1. */
    rainBase: number;
    /** Profile rain multiplier (1 / 0.7 / 0.35). */
    rainMultiplier: number;
    /** Instance capacity of the drop buffer. */
    rainCapacity: number;
    /** Splash rings at once in heavy rain (29 / 14 / 0). */
    splashRings: number;
    /** Puddles on paths and bare soil (24 / 12 / 6). */
    puddles: number;
    /** Snowflakes on a 1280 × 800 view at snowy 1 and multiplier 1. */
    snowBase: number;
    /** Profile snow multiplier (1 / 0.6 / 0.3). */
    snowMultiplier: number;
    /** Disc flake capacity. */
    snowCapacity: number;
    /** Share of the flakes drawn as the snowflake icon. */
    iconFlakeShare: number;
    /** Icon flake capacity. */
    iconFlakeCapacity: number;
    /** Sparkles on full snow cover (14 / 10 / 7). */
    sparkles: number;
    /** Mist rolls along the terrain rim (12 / 8 / 4). */
    mistRimRolls: number;
    /** Mist rolls in free sky (4 / 2 / 0). */
    mistSkyRolls: number;
    /** Wind swooshes in free sky (4 / 2 / 1). */
    swooshes: number;
    /** Tumbling wind leaves (14 / 10 / 0). */
    windLeaves: number;
};

const tierCaps = {
    high: {
        bandClouds: 10,
        cloudShadows: 6,
        splashRings: 29,
        puddles: 24,
        sparkles: 14,
        mistRimRolls: 12,
        mistSkyRolls: 4,
        swooshes: 4,
        windLeaves: 14,
    },
    medium: {
        bandClouds: 7,
        cloudShadows: 4,
        splashRings: 14,
        puddles: 12,
        sparkles: 10,
        mistRimRolls: 8,
        mistSkyRolls: 2,
        swooshes: 2,
        windLeaves: 10,
    },
    low: {
        bandClouds: 4,
        cloudShadows: 0,
        splashRings: 0,
        puddles: 6,
        sparkles: 7,
        mistRimRolls: 4,
        mistSkyRolls: 0,
        swooshes: 1,
        windLeaves: 0,
    },
} as const satisfies Record<
    WeatherTier,
    Omit<
        WeatherTierCaps,
        | 'tier'
        | 'rainBase'
        | 'rainMultiplier'
        | 'rainCapacity'
        | 'snowBase'
        | 'snowMultiplier'
        | 'snowCapacity'
        | 'iconFlakeShare'
        | 'iconFlakeCapacity'
    >
>;

/** Counts and capacities shared by every tier (the target's constants). */
export const weatherParticleBudget = {
    rainBase: 840,
    rainCapacity: 1400,
    snowBase: 520,
    snowCapacity: 820,
    iconFlakeShare: 0.12,
    iconFlakeCapacity: 110,
    /** Particle counts scale with the view's pixel area over this one. */
    referenceViewWidthPx: 1280,
    referenceViewHeightPx: 800,
} as const;

/**
 * The weather tier of a quality profile. Auto-constrained devices take the
 * low caps (like ripples and morning mist today); a custom profile without
 * shadows is low, one at full rain density is high, anything else medium.
 */
export function resolveWeatherTier(
    profile: Pick<
        GameQualityProfile,
        'rainParticleMultiplier' | 'shadows' | 'tier'
    >,
): WeatherTier {
    switch (profile.tier) {
        case 'low':
        case 'medium':
        case 'high':
            return profile.tier;
        case 'auto-constrained':
            return 'low';
        case 'custom':
            if (!profile.shadows) {
                return 'low';
            }
            return profile.rainParticleMultiplier >= 0.85 ? 'high' : 'medium';
    }
}

function multiplier(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function resolveWeatherTierCaps(
    profile: Pick<
        GameQualityProfile,
        'rainParticleMultiplier' | 'shadows' | 'snowParticleMultiplier' | 'tier'
    >,
): WeatherTierCaps {
    const tier = resolveWeatherTier(profile);
    return {
        tier,
        ...tierCaps[tier],
        rainBase: weatherParticleBudget.rainBase,
        rainMultiplier: multiplier(profile.rainParticleMultiplier),
        rainCapacity: weatherParticleBudget.rainCapacity,
        snowBase: weatherParticleBudget.snowBase,
        snowMultiplier: multiplier(profile.snowParticleMultiplier),
        snowCapacity: weatherParticleBudget.snowCapacity,
        iconFlakeShare: weatherParticleBudget.iconFlakeShare,
        iconFlakeCapacity: weatherParticleBudget.iconFlakeCapacity,
    };
}

/** The view's pixel area over the 1280 × 800 reference view. */
export function resolveViewAreaScale(widthPx: number, heightPx: number) {
    const area = Math.max(0, widthPx) * Math.max(0, heightPx);
    return (
        area /
        (weatherParticleBudget.referenceViewWidthPx *
            weatherParticleBudget.referenceViewHeightPx)
    );
}

/**
 * Raindrops on screen: 840 × tier × rainy^1.3 × area scale, continuous, up
 * to the capacity; none at rainy 0.03 or less.
 */
export function resolveRainDropCount(
    caps: Pick<WeatherTierCaps, 'rainBase' | 'rainCapacity' | 'rainMultiplier'>,
    rainy: number,
    viewAreaScale: number,
) {
    if (!(rainy > 0.03)) {
        return 0;
    }
    return Math.min(
        caps.rainCapacity,
        Math.round(
            caps.rainBase *
                caps.rainMultiplier *
                Math.min(1, rainy) ** 1.3 *
                Math.max(0, viewAreaScale),
        ),
    );
}

/**
 * Snowflakes on screen: 520 × tier × snowy × area scale, of which 12% are
 * icon flakes; none at snowy 0.03 or less.
 */
export function resolveSnowFlakeCounts(
    caps: Pick<
        WeatherTierCaps,
        | 'iconFlakeCapacity'
        | 'iconFlakeShare'
        | 'snowBase'
        | 'snowCapacity'
        | 'snowMultiplier'
    >,
    snowy: number,
    viewAreaScale: number,
) {
    if (!(snowy > 0.03)) {
        return { discs: 0, iconFlakes: 0, total: 0 };
    }
    const total = Math.round(
        caps.snowBase *
            caps.snowMultiplier *
            Math.min(1, snowy) *
            Math.max(0, viewAreaScale),
    );
    const iconFlakes = Math.min(
        caps.iconFlakeCapacity,
        Math.round(total * caps.iconFlakeShare),
    );
    const discs = Math.min(caps.snowCapacity, total - iconFlakes);
    return { discs, iconFlakes, total: discs + iconFlakes };
}
