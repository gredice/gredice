'use client';

import type { GameQualityProfileTier } from './gameQuality';

export type GeneratedPlantProfilePartCounts = {
    billboardInstances: number;
    flowers: number;
    leaves: number;
    produce: number;
    shadowCasterSubmissions: number;
    shadowPrimitiveInstances: number;
    stems: number;
    thorns: number;
};

export type GeneratedPlantProfileRenderCounts = {
    detailedFields: number;
    farFields: number;
    farPlantInstances: number;
    invisibleFields: number;
    invisiblePlantInstances: number;
    midFields: number;
    midPlantInstances: number;
    nearFields: number;
    nearPlantInstances: number;
    parts: GeneratedPlantProfilePartCounts;
    pendingNearFields: number;
    pendingNearPlantInstances: number;
    totalFields: number;
    totalPlantInstances: number;
};

export type GeneratedPlantProfileSnapshot = {
    active: boolean;
    camera: {
        active: boolean;
        settled: boolean;
        view: 'closeup' | 'normal';
        zoom: number | null;
    };
    error: string | null;
    lSystem: {
        cancelledTaskCount: number;
        completedTaskCount: number;
        requestedTaskCount: number;
        workerDurationMaxMs: number;
        workerDurationTotalMs: number;
        workerFailureCount: number;
        workerRequestCount: number;
        workerTaskCount: number;
    };
    lodEvaluation: {
        fieldEvaluationCount: number;
        updateCount: number;
    };
    milestonesMs: {
        cameraSettled: number | null;
        firstDetailedField: number | null;
        fullyDetailed: number | null;
        nearIntent: number | null;
        pendingNear: number | null;
    };
    nonSelected: GeneratedPlantProfileRenderCounts;
    renderData: {
        buildCount: number;
        buildDurationMaxMs: number;
        buildDurationTotalMs: number;
        builtPlantInstanceCount: number;
    };
    selected: GeneratedPlantProfileRenderCounts;
    selectedBlockId: string;
    selectedRaisedBedId: number;
    sessionId: number;
};

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
    generatedPlantProfile?: GeneratedPlantProfileSnapshot | null;
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
