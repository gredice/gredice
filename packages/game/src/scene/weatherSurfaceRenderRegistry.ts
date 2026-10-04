'use client';

import { updateGameProfileMetadata } from './gameProfileMetadata';

export type WeatherSurfaceMode = 'integrated' | 'legacy';

export type WeatherSurfaceRenderSnapshot = {
    avoidedOverlaySubmissionCount: number;
    avoidedOverlayTriangleCount: number;
    fallbackOverlaySubmissionCount: number;
    fallbackOverlayTriangleCount: number;
    integratedInstanceCount: number;
    integratedMaterialCount: number;
    mode: WeatherSurfaceMode;
    pluginVariantKeys: readonly string[];
};

type WeatherSurfaceRenderRegistration = {
    snapshot: WeatherSurfaceRenderSnapshot;
    token: symbol;
};

const registrations = new Map<string, WeatherSurfaceRenderRegistration>();

export function getWeatherSurfaceRenderRegistrySnapshot() {
    let avoidedOverlaySubmissionCount = 0;
    let avoidedOverlayTriangleCount = 0;
    let fallbackOverlaySubmissionCount = 0;
    let fallbackOverlayTriangleCount = 0;
    let integratedInstanceCount = 0;
    let integratedMaterialCount = 0;
    let mode: WeatherSurfaceMode = 'legacy';
    const pluginVariantKeys = new Set<string>();

    for (const registration of registrations.values()) {
        const snapshot = registration.snapshot;
        avoidedOverlaySubmissionCount += snapshot.avoidedOverlaySubmissionCount;
        avoidedOverlayTriangleCount += snapshot.avoidedOverlayTriangleCount;
        fallbackOverlaySubmissionCount +=
            snapshot.fallbackOverlaySubmissionCount;
        fallbackOverlayTriangleCount += snapshot.fallbackOverlayTriangleCount;
        integratedInstanceCount += snapshot.integratedInstanceCount;
        integratedMaterialCount += snapshot.integratedMaterialCount;
        if (snapshot.mode === 'integrated') {
            mode = 'integrated';
        }
        for (const key of snapshot.pluginVariantKeys) {
            pluginVariantKeys.add(key);
        }
    }

    return {
        avoidedOverlaySubmissionCount,
        avoidedOverlayTriangleCount,
        fallbackOverlaySubmissionCount,
        fallbackOverlayTriangleCount,
        integratedInstanceCount,
        integratedMaterialCount,
        mode,
        pluginVariantCount: pluginVariantKeys.size,
    };
}

function publishWeatherSurfaceRenderSnapshot() {
    const snapshot = getWeatherSurfaceRenderRegistrySnapshot();
    updateGameProfileMetadata({
        weatherSurfaceAvoidedOverlaySubmissionCount:
            snapshot.avoidedOverlaySubmissionCount,
        weatherSurfaceAvoidedOverlayTriangleCount:
            snapshot.avoidedOverlayTriangleCount,
        weatherSurfaceFallbackOverlaySubmissionCount:
            snapshot.fallbackOverlaySubmissionCount,
        weatherSurfaceFallbackOverlayTriangleCount:
            snapshot.fallbackOverlayTriangleCount,
        weatherSurfaceIntegratedInstanceCount: snapshot.integratedInstanceCount,
        weatherSurfaceIntegratedMaterialCount: snapshot.integratedMaterialCount,
        weatherSurfaceMode: snapshot.mode,
        weatherSurfacePluginVariantCount: snapshot.pluginVariantCount,
    });
}

export function registerWeatherSurfaceRenderEntry(
    entryKey: string,
    snapshot: WeatherSurfaceRenderSnapshot,
) {
    const token = Symbol(entryKey);
    registrations.set(entryKey, { snapshot, token });
    publishWeatherSurfaceRenderSnapshot();

    return () => {
        if (registrations.get(entryKey)?.token !== token) {
            return;
        }
        registrations.delete(entryKey);
        publishWeatherSurfaceRenderSnapshot();
    };
}

export function resetWeatherSurfaceRenderRegistryForTests() {
    registrations.clear();
}
