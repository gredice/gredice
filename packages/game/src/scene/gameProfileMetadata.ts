'use client';

import type { GameQualityProfileTier } from './gameQuality';

export type GameProfileMetadata = {
    cloudProjectedShadowCount?: number;
    cloudRealShadowCasterCount?: number;
    cloudVisualCount?: number;
    dprCap?: number;
    groundDecorationAtlasEstimatedGpuBytes?: number;
    groundDecorationAtlasPageCount?: number;
    groundDecorationChunkCount?: number;
    groundDecorationCount?: number;
    groundDecorationDensity?: number;
    groundDecorationVisibleCount?: number;
    generatedLSystemCacheEntryCount?: number;
    generatedLSystemCacheEstimatedBytes?: number;
    generatedLSystemCacheEvictionCount?: number;
    generatedLSystemCacheHitCount?: number;
    generatedLSystemCacheMaxEntryCount?: number;
    generatedLSystemCacheMaxEstimatedBytes?: number;
    generatedLSystemCacheMissCount?: number;
    generatedLSystemCacheOversizeSkipCount?: number;
    generatedLSystemCachePeakEstimatedBytes?: number;
    generatedLSystemCacheWriteCount?: number;
    instancedSnowOverlayCount?: number;
    qualityTier?: GameQualityProfileTier;
    rainParticleCount?: number;
    rainWetOverlayDistinctUniformCount?: number;
    rainWetOverlayMaterialConsumerCount?: number;
    raisedBedMulchOverlayCount?: number;
    rendererGeometries?: number;
    rendererLines?: number;
    rendererMatrices?: number;
    rendererPoints?: number;
    rendererRenderCalls?: number;
    rendererShaders?: number;
    rendererTextures?: number;
    rendererTriangles?: number;
    shadowMapAutoUpdate?: boolean;
    shadowMapDynamicRefreshMs?: number;
    shadowMapInvalidationCount?: number;
    shadowMapSize?: number;
    shadowsEnabled?: boolean;
    snowOverlayDistinctUniformCount?: number;
    snowOverlayMaterialConsumerCount?: number;
    snowOverlayMinCoverage?: number;
    snowParticleCapacity?: number;
    snowParticleCount?: number;
    snowParticleGeometryBuildCount?: number;
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
