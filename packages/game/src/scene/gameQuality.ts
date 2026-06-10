'use client';

export type GameQualityTier = 'low' | 'medium' | 'high';
type GameQualityAutoTier = Exclude<GameQualityTier, 'low'>;
export type GameQualityProfileTier = GameQualityTier | 'custom';
export type GameQualitySetting = GameQualityTier | 'auto' | 'custom';
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
    tier: GameQualityProfileTier;
};

export type GameQualityCustomProfile = Omit<GameQualityProfile, 'tier'>;
export type GameQualityAutoProfileMetrics = {
    coarsePointer: boolean;
    coreCount?: number;
    dpr: number;
    memoryGb?: number;
    narrowViewport: boolean;
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
const GAME_QUALITY_CUSTOM_PROFILE_STORAGE_KEY = 'game-quality-custom-profile';
const shadowMapSizeOptions = [1024, 2048, 4096];
const autoGameQualityTiers = {
    constrained: 'medium',
    standard: 'medium',
} satisfies Record<'constrained' | 'standard', GameQualityAutoTier>;
let cachedGameQualitySetting: GameQualitySetting | undefined;
let cachedGameQualityCustomProfile: GameQualityCustomProfile | undefined;

export const defaultGameQualityCustomProfile = toGameQualityCustomProfile(
    gameQualityProfiles.medium,
);

export function isGameQualityTier(
    value: string | undefined,
): value is GameQualityTier {
    return value === 'low' || value === 'medium' || value === 'high';
}

export function isGameQualitySetting(
    value: string | undefined,
): value is GameQualitySetting {
    return value === 'auto' || value === 'custom' || isGameQualityTier(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isMultiplier(value: unknown) {
    return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isDpr(value: unknown) {
    return isFiniteNumber(value) && value >= 1 && value <= 3;
}

function isShadowMapSize(value: unknown) {
    return isFiniteNumber(value) && shadowMapSizeOptions.includes(value);
}

function isGameCloudShadowMode(value: unknown): value is GameCloudShadowMode {
    return value === 'hard' || value === 'soft';
}

function isGameQualityCustomProfile(
    value: unknown,
): value is GameQualityCustomProfile {
    return (
        isRecord(value) &&
        isGameCloudShadowMode(value.cloudShadowMode) &&
        isDpr(value.dpr) &&
        isMultiplier(value.groundDecorationDensity) &&
        isMultiplier(value.rainParticleMultiplier) &&
        isShadowMapSize(value.shadowMapSize) &&
        typeof value.shadows === 'boolean' &&
        isMultiplier(value.snowOverlayMinCoverage) &&
        isMultiplier(value.snowParticleMultiplier)
    );
}

export function toGameQualityCustomProfile(
    profile: GameQualityProfile,
): GameQualityCustomProfile {
    return {
        cloudShadowMode: profile.cloudShadowMode,
        dpr: profile.dpr,
        groundDecorationDensity: profile.groundDecorationDensity,
        rainParticleMultiplier: profile.rainParticleMultiplier,
        shadowMapSize:
            profile.shadowMapSize === 0 ? 2048 : profile.shadowMapSize,
        shadows: profile.shadows,
        snowOverlayMinCoverage: profile.snowOverlayMinCoverage,
        snowParticleMultiplier: profile.snowParticleMultiplier,
    };
}

export function getGameQualityCustomProfile(): GameQualityCustomProfile {
    if (cachedGameQualityCustomProfile !== undefined) {
        return cachedGameQualityCustomProfile;
    }

    try {
        const storedValue =
            typeof window !== 'undefined'
                ? (window.localStorage.getItem(
                      GAME_QUALITY_CUSTOM_PROFILE_STORAGE_KEY,
                  ) ?? undefined)
                : undefined;
        const parsedValue =
            storedValue !== undefined ? JSON.parse(storedValue) : undefined;

        cachedGameQualityCustomProfile = isGameQualityCustomProfile(parsedValue)
            ? parsedValue
            : defaultGameQualityCustomProfile;
    } catch {
        cachedGameQualityCustomProfile = defaultGameQualityCustomProfile;
    }

    return cachedGameQualityCustomProfile;
}

export function setGameQualityCustomProfile(profile: GameQualityCustomProfile) {
    cachedGameQualityCustomProfile = profile;

    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            GAME_QUALITY_CUSTOM_PROFILE_STORAGE_KEY,
            JSON.stringify(profile),
        );
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

export function getGameQualityAutoProfileMetrics():
    | GameQualityAutoProfileMetrics
    | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return {
        coarsePointer:
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches,
        coreCount: readNavigatorNumber('hardwareConcurrency'),
        dpr: window.devicePixelRatio || 1,
        memoryGb: readNavigatorNumber('deviceMemory'),
        narrowViewport: window.innerWidth <= 640,
    };
}

function resolveAutoGameQualityTier(
    metrics = getGameQualityAutoProfileMetrics(),
): GameQualityAutoTier {
    if (metrics === undefined) {
        return autoGameQualityTiers.standard;
    }

    if (
        metrics.coarsePointer ||
        metrics.narrowViewport ||
        metrics.dpr >= 2.75 ||
        (metrics.memoryGb !== undefined && metrics.memoryGb <= 4) ||
        (metrics.coreCount !== undefined &&
            metrics.coreCount <= 4 &&
            metrics.dpr > 1.25)
    ) {
        return autoGameQualityTiers.constrained;
    }

    return autoGameQualityTiers.standard;
}

export function resolveGameQualityProfile(
    quality?: GameQualitySetting,
    customProfile?: GameQualityCustomProfile,
    autoMetrics?: GameQualityAutoProfileMetrics,
): GameQualityProfile {
    if (quality === 'custom') {
        return {
            ...(customProfile ?? getGameQualityCustomProfile()),
            tier: 'custom',
        };
    }

    const tier =
        quality === undefined || quality === 'auto'
            ? resolveAutoGameQualityTier(autoMetrics)
            : quality;
    return gameQualityProfiles[tier];
}
