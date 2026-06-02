'use client';

import type { GameQualityProfileTier } from './gameQuality';

export type GameProfileMetadata = {
    cloudProjectedShadowCount?: number;
    cloudRealShadowCasterCount?: number;
    cloudVisualCount?: number;
    dprCap?: number;
    groundDecorationAtlasPageCount?: number;
    groundDecorationChunkCount?: number;
    groundDecorationCount?: number;
    groundDecorationDensity?: number;
    groundDecorationVisibleCount?: number;
    instancedSnowOverlayCount?: number;
    qualityTier?: GameQualityProfileTier;
    rainParticleCount?: number;
    raisedBedMulchOverlayCount?: number;
    shadowMapAutoUpdate?: boolean;
    shadowMapDynamicRefreshMs?: number;
    shadowMapInvalidationCount?: number;
    shadowMapSize?: number;
    shadowsEnabled?: boolean;
    snowOverlayMinCoverage?: number;
    snowParticleCount?: number;
    weatherDisabled?: boolean;
};

declare global {
    interface Window {
        __grediceGameProfile?: GameProfileMetadata;
    }
}

export function readGameProfileMetadata() {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.__grediceGameProfile;
}

export function updateGameProfileMetadata(metadata: GameProfileMetadata) {
    if (typeof window === 'undefined') {
        return;
    }

    window.__grediceGameProfile = {
        ...window.__grediceGameProfile,
        ...metadata,
    };
}
