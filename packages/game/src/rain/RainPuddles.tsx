'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import type { Color } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import { useRainSurfaceWetnessState } from '../scene/WeatherSurfaceUniformProvider';
import type { Stack } from '../types/Stack';
import {
    createRainPuddleMesh,
    createRainPuddleUniforms,
} from './rainPuddleMesh';
import {
    createRainPuddleSites,
    resolveRainPuddleRipples,
} from './rainPuddleState';

/**
 * Ground wetness for puddles: it rises and dries slower than the rain blend
 * itself (GAME_ART.md "Weather > Blends": wetness follows at 0.6×).
 */
export const rainPuddleWetnessSpeeds = {
    wetSpeed: 0.7,
    drySpeed: 0.45,
} as const;

/**
 * Toy puddles on path and bare soil (GAME_ART.md "Weather > Rain and heavy
 * rain"): one instanced draw for the garden, growing and fading with the
 * eased ground wetness, gone under snow cover.
 */
export function RainPuddles({
    cap,
    deep,
    gardenId,
    light,
    rainy,
    reducedMotion,
    rim,
    snowCover,
    stacks,
}: {
    cap: number;
    deep: Color;
    gardenId: number | undefined;
    light: Color;
    /** Blended rain: ripples ring only while it rains. */
    rainy: number;
    reducedMotion: boolean;
    rim: Color;
    snowCover: number;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const time = useSceneTimeUniform();
    const fixedTime = useSceneFixedTimeSeconds();
    const { active, wetnessUniform } = useRainSurfaceWetnessState({
        ...rainPuddleWetnessSpeeds,
        intensityMultiplier: 1,
        minimumWetness: 0.08,
    });
    const sites = useMemo(
        () =>
            createRainPuddleSites({
                blockData: blockData ?? [],
                cap,
                gardenId,
                stacks: stacks ?? [],
            }),
        [blockData, cap, gardenId, stacks],
    );
    const uniforms = useMemo(() => createRainPuddleUniforms(), []);
    const mesh = useMemo(
        () =>
            createRainPuddleMesh({
                sites,
                time,
                uniforms,
                wetness: wetnessUniform,
            }),
        [sites, time, uniforms, wetnessUniform],
    );
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        },
        [mesh],
    );

    const visible = active && sites.length > 0 && snowCover < 0.99;
    // Ripples ring while it rains; reduced motion keeps the puddles still.
    const ripples = reducedMotion ? 0 : resolveRainPuddleRipples(rainy);
    useSceneTimeInvalidation(
        'rain-puddle-ripples',
        visible && ripples > 0 && fixedTime === undefined,
    );
    const shownCount = visible ? sites.length : 0;
    useEffect(() => {
        updateGameProfileMetadata({ rainPuddleCount: shownCount });
    }, [shownCount]);
    useEffect(
        () => () => updateGameProfileMetadata({ rainPuddleCount: 0 }),
        [],
    );
    useLayoutEffect(() => {
        uniforms.uDeep.value.copy(deep);
        uniforms.uLight.value.copy(light);
        uniforms.uRim.value.copy(rim);
        uniforms.uRipples.value = ripples;
        uniforms.uSnowCover.value = snowCover;
    }, [deep, light, rim, ripples, snowCover, uniforms]);

    return <primitive object={mesh} visible={visible} />;
}
