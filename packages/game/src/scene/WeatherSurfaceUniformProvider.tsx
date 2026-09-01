'use client';

import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import type { IUniform } from 'three';
import { useOptionalGameState } from '../useGameState';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import { useSceneRenderRequest, useSceneTimeInvalidation } from './SceneTime';
import {
    type RainSurfaceUniformOptions,
    type SnowSurfaceUniformOptions,
    type WeatherSurfaceUniformActivitySnapshot,
    WeatherSurfaceUniformRegistry,
    type WeatherSurfaceUniformStats,
} from './weatherSurfaceUniforms';

const WeatherSurfaceUniformContext =
    createContext<WeatherSurfaceUniformRegistry | null>(null);

function reportWeatherSurfaceUniformStats(stats: WeatherSurfaceUniformStats) {
    updateGameProfileMetadata({
        rainWetOverlayDistinctUniformCount: stats.rainDistinctUniformCount,
        rainWetOverlayMaterialConsumerCount: stats.rainConsumerCount,
        snowOverlayDistinctUniformCount: stats.snowDistinctUniformCount,
        snowOverlayMaterialConsumerCount: stats.snowConsumerCount,
        weatherSurfaceSnowIntegrationReadyCount:
            stats.snowIntegrationReadyCount,
        weatherSurfaceSnowIntegrationTrackedCount:
            stats.snowIntegrationTrackedCount,
        weatherSurfaceSnowIntegrationTransitionCount:
            stats.snowIntegrationTransitionCount,
    });
}

function useWeatherSurfaceUniformRegistry() {
    const registry = useContext(WeatherSurfaceUniformContext);
    if (!registry) {
        throw new Error('Missing WeatherSurfaceUniformProvider in scene tree');
    }
    return registry;
}

export function WeatherSurfaceUniformProvider({ children }: PropsWithChildren) {
    const pendingStatsRef = useRef<WeatherSurfaceUniformStats | null>(null);
    const registry = useMemo(
        () =>
            new WeatherSurfaceUniformRegistry((stats) => {
                pendingStatsRef.current = stats;
            }),
        [],
    );
    const rainAmount = useOptionalGameState(
        (state) => state.rainSurfaceIntensity,
        0,
    );
    const snowCoverage = useOptionalGameState((state) => state.snowCoverage, 0);
    const activity = useSyncExternalStore(
        registry.subscribeActivity,
        registry.getActivitySnapshot,
        registry.getActivitySnapshot,
    );
    const requestRender = useSceneRenderRequest();
    useSceneTimeInvalidation(
        'weather-surface-transition',
        activity.rainSettling || activity.snowSettling,
    );

    useEffect(() => {
        registry.advance({ rainAmount, snowCoverage }, 0);
        requestRender('weather-surface-target-change');
    }, [rainAmount, registry, requestRender, snowCoverage]);

    useEffect(() => {
        registry.publishStats();
        return () =>
            reportWeatherSurfaceUniformStats({
                rainConsumerCount: 0,
                rainDistinctUniformCount: 0,
                snowConsumerCount: 0,
                snowDistinctUniformCount: 0,
                snowIntegrationReadyCount: 0,
                snowIntegrationTrackedCount: 0,
                snowIntegrationTransitionCount: 0,
            });
    }, [registry]);

    useFrame((_, delta) => {
        if (pendingStatsRef.current) {
            reportWeatherSurfaceUniformStats(pendingStatsRef.current);
            pendingStatsRef.current = null;
        }
        registry.advance({ rainAmount, snowCoverage }, delta);
    });

    return (
        <WeatherSurfaceUniformContext.Provider value={registry}>
            {children}
        </WeatherSurfaceUniformContext.Provider>
    );
}

export function useSnowSurfaceAmountUniform({
    coverageMultiplier,
    overrideSnow,
}: SnowSurfaceUniformOptions): IUniform<number> {
    return useRetainedSnowSurfaceEntry({
        coverageMultiplier,
        overrideSnow,
    }).uniform;
}

function useRetainedSnowSurfaceEntry({
    coverageMultiplier,
    overrideSnow,
}: SnowSurfaceUniformOptions) {
    const registry = useWeatherSurfaceUniformRegistry();
    const entry = useMemo(
        () =>
            registry.getSnowEntry({
                coverageMultiplier,
                overrideSnow,
            }),
        [coverageMultiplier, overrideSnow, registry],
    );

    useEffect(() => registry.retain(entry), [entry, registry]);

    return entry;
}

export function useSnowSurfaceIntegrationState({
    coverageMultiplier,
    noiseInfluence,
    overrideSnow,
}: SnowSurfaceUniformOptions & { noiseInfluence: number }) {
    const registry = useWeatherSurfaceUniformRegistry();
    const entry = useRetainedSnowSurfaceEntry({
        coverageMultiplier,
        overrideSnow,
    });
    const subscribe = useCallback(
        (listener: () => void) =>
            registry.subscribeSnowIntegrationReadiness(
                entry,
                noiseInfluence,
                listener,
            ),
        [entry, noiseInfluence, registry],
    );
    const getSnapshot = useCallback(
        () => registry.getSnowIntegrationReady(entry, noiseInfluence),
        [entry, noiseInfluence, registry],
    );
    const ready = useSyncExternalStore(subscribe, getSnapshot, () => false);

    return {
        amountUniform: entry.uniform,
        ready,
    };
}

export function useRainSurfaceWetnessUniform({
    drySpeed,
    intensityMultiplier,
    wetSpeed,
}: RainSurfaceUniformOptions): IUniform<number> {
    return useRetainedRainSurfaceEntry({
        drySpeed,
        intensityMultiplier,
        wetSpeed,
    }).uniform;
}

function useRainSurfaceEntry({
    drySpeed,
    intensityMultiplier,
    wetSpeed,
}: RainSurfaceUniformOptions) {
    const registry = useWeatherSurfaceUniformRegistry();
    return useMemo(
        () =>
            registry.getRainEntry({
                drySpeed,
                intensityMultiplier,
                wetSpeed,
            }),
        [drySpeed, intensityMultiplier, registry, wetSpeed],
    );
}

function useRetainedRainSurfaceEntry(options: RainSurfaceUniformOptions) {
    const registry = useWeatherSurfaceUniformRegistry();
    const entry = useRainSurfaceEntry(options);

    useEffect(() => registry.retain(entry), [entry, registry]);

    return entry;
}

function useRainSurfaceEntryActivity({
    enabled,
    entry,
    minimumWetness,
}: {
    enabled: boolean;
    entry: ReturnType<WeatherSurfaceUniformRegistry['getRainEntry']>;
    minimumWetness: number;
}) {
    const registry = useWeatherSurfaceUniformRegistry();
    const subscribe = useCallback(
        (listener: () => void) =>
            enabled
                ? registry.subscribeRainSurfaceActivity(
                      entry,
                      minimumWetness,
                      listener,
                  )
                : () => undefined,
        [enabled, entry, minimumWetness, registry],
    );
    const getSnapshot = useCallback(
        () => enabled && registry.getRainSurfaceActive(entry, minimumWetness),
        [enabled, entry, minimumWetness, registry],
    );
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useRainSurfaceWetnessState({
    drySpeed,
    intensityMultiplier,
    minimumWetness = 0.01,
    wetSpeed,
}: RainSurfaceUniformOptions & { minimumWetness?: number }) {
    const entry = useRetainedRainSurfaceEntry({
        drySpeed,
        intensityMultiplier,
        wetSpeed,
    });
    const active = useRainSurfaceEntryActivity({
        enabled: true,
        entry,
        minimumWetness,
    });

    return {
        active,
        wetnessUniform: entry.uniform,
    };
}

export function useRainSurfaceWetnessActive({
    drySpeed,
    enabled,
    intensityMultiplier,
    minimumWetness = 0.01,
    wetSpeed,
}: RainSurfaceUniformOptions & {
    enabled: boolean;
    minimumWetness?: number;
}) {
    const entry = useRainSurfaceEntry({
        drySpeed,
        intensityMultiplier,
        wetSpeed,
    });
    return useRainSurfaceEntryActivity({
        enabled,
        entry,
        minimumWetness,
    });
}

export function useRainSurfacePuddleStrengthUniform(): IUniform<number> {
    return useWeatherSurfaceUniformRegistry().rainPuddleStrengthUniform;
}

export function useWeatherSurfaceUniformActivitySnapshot(): WeatherSurfaceUniformActivitySnapshot {
    const registry = useWeatherSurfaceUniformRegistry();
    return useSyncExternalStore(
        registry.subscribeActivity,
        registry.getActivitySnapshot,
        registry.getActivitySnapshot,
    );
}
