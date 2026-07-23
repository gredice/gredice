'use client';

import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import type { IUniform } from 'three';
import { useOptionalGameState } from '../useGameState';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    type RainSurfaceUniformOptions,
    type SnowSurfaceUniformOptions,
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
        (state) => state.weather?.rainy ?? 0,
        0,
    );
    const snowCoverage = useOptionalGameState((state) => state.snowCoverage, 0);

    useEffect(() => {
        registry.publishStats();
        return () =>
            reportWeatherSurfaceUniformStats({
                rainConsumerCount: 0,
                rainDistinctUniformCount: 0,
                snowConsumerCount: 0,
                snowDistinctUniformCount: 0,
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

    return entry.uniform;
}

export function useRainSurfaceWetnessUniform({
    drySpeed,
    intensityMultiplier,
    wetSpeed,
}: RainSurfaceUniformOptions): IUniform<number> {
    const registry = useWeatherSurfaceUniformRegistry();
    const entry = useMemo(
        () =>
            registry.getRainEntry({
                drySpeed,
                intensityMultiplier,
                wetSpeed,
            }),
        [drySpeed, intensityMultiplier, registry, wetSpeed],
    );

    useEffect(() => registry.retain(entry), [entry, registry]);

    return entry.uniform;
}

export function useRainSurfacePuddleStrengthUniform(): IUniform<number> {
    return useWeatherSurfaceUniformRegistry().rainPuddleStrengthUniform;
}
