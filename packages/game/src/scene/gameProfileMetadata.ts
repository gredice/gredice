'use client';

import type { GameQualityTier } from './gameQuality';

export type GameProfileMetadata = {
    dprCap?: number;
    groundDecorationCount?: number;
    groundDecorationDensity?: number;
    instancedSnowOverlayCount?: number;
    qualityTier?: GameQualityTier;
    rainParticleCount?: number;
    raisedBedMulchOverlayCount?: number;
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
