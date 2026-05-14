'use client';

export type GameQualityTier = 'low' | 'medium' | 'high';
export type GameQualitySetting = GameQualityTier | 'auto';
export type GameCloudShadowMode = 'hard' | 'soft';

export type GameQualityProfile = {
    cloudShadowMode: GameCloudShadowMode;
    dpr: number;
    groundDecorationDensity: number;
    rainParticleMultiplier: number;
    shadowMapSize: number;
    shadows: boolean;
    snowOverlayMinCoverage: number;
    snowParticleMultiplier: number;
    tier: GameQualityTier;
};

export const gameQualityProfiles = {
    low: {
        cloudShadowMode: 'hard',
        dpr: 1,
        groundDecorationDensity: 0,
        rainParticleMultiplier: 0.35,
        shadowMapSize: 0,
        shadows: false,
        snowOverlayMinCoverage: 0.35,
        snowParticleMultiplier: 0.3,
        tier: 'low',
    },
    medium: {
        cloudShadowMode: 'hard',
        dpr: 1.5,
        groundDecorationDensity: 0.5,
        rainParticleMultiplier: 0.7,
        shadowMapSize: 2048,
        shadows: true,
        snowOverlayMinCoverage: 0.08,
        snowParticleMultiplier: 0.6,
        tier: 'medium',
    },
    high: {
        cloudShadowMode: 'soft',
        dpr: 2,
        groundDecorationDensity: 1,
        rainParticleMultiplier: 1,
        shadowMapSize: 4096,
        shadows: true,
        snowOverlayMinCoverage: 0.02,
        snowParticleMultiplier: 1,
        tier: 'high',
    },
} satisfies Record<GameQualityTier, GameQualityProfile>;

const GAME_QUALITY_SETTING_STORAGE_KEY = 'game-quality-setting';
let cachedGameQualitySetting: GameQualitySetting | undefined;

export function isGameQualityTier(
    value: string | undefined,
): value is GameQualityTier {
    return value === 'low' || value === 'medium' || value === 'high';
}

export function isGameQualitySetting(
    value: string | undefined,
): value is GameQualitySetting {
    return value === 'auto' || isGameQualityTier(value);
}

export function getGameQualitySetting(): GameQualitySetting {
    if (cachedGameQualitySetting !== undefined) {
        return cachedGameQualitySetting;
    }

    try {
        const storedValue =
            typeof window !== 'undefined'
                ? (window.localStorage.getItem(
                      GAME_QUALITY_SETTING_STORAGE_KEY,
                  ) ?? undefined)
                : undefined;

        cachedGameQualitySetting = isGameQualitySetting(storedValue)
            ? storedValue
            : 'auto';
    } catch {
        cachedGameQualitySetting = 'auto';
    }

    return cachedGameQualitySetting;
}

export function setGameQualitySetting(setting: GameQualitySetting) {
    cachedGameQualitySetting = setting;

    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (setting === 'auto') {
            window.localStorage.removeItem(GAME_QUALITY_SETTING_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(GAME_QUALITY_SETTING_STORAGE_KEY, setting);
    } catch {
        // Ignore storage failures and keep the in-memory state updated.
    }
}

function readNavigatorNumber(property: string) {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const value = Reflect.get(window.navigator, property);
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

function resolveAutoGameQualityTier(): GameQualityTier {
    if (typeof window === 'undefined') {
        return 'medium';
    }

    const dpr = window.devicePixelRatio || 1;
    const memoryGb = readNavigatorNumber('deviceMemory');
    const coreCount = readNavigatorNumber('hardwareConcurrency');
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrowViewport = window.innerWidth <= 640;

    if (
        coarsePointer ||
        narrowViewport ||
        dpr >= 2.75 ||
        (memoryGb !== undefined && memoryGb <= 4) ||
        (coreCount !== undefined && coreCount <= 4 && dpr > 1.25)
    ) {
        return 'low';
    }

    return 'medium';
}

export function resolveGameQualityProfile(
    quality?: GameQualitySetting,
): GameQualityProfile {
    const tier =
        quality === undefined || quality === 'auto'
            ? resolveAutoGameQualityTier()
            : quality;
    return gameQualityProfiles[tier];
}
