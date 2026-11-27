import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Color } from 'three';
import { useEntityBlockInstances } from '../entities/EntityInstancesBlock';
import { useBlockData } from '../hooks/useBlockData';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import type { GameQualityProfileTier } from './gameQuality';
import { createMorningMistMesh } from './morningMistMesh';
import {
    createMorningMistAnchors,
    morningMistCaps,
    morningMistSurfaceNames,
    resolveMorningMistDensity,
} from './morningMistState';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from './SceneTime';
import { weatherRoleSets } from './weather/weatherRoles';
import type { EnvironmentWeather } from './weatherBlend';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(reducedMotionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(reducedMotionQuery).matches;
}

/** Wisp opacity at full density, in the mist role's lilac. */
const morningMistAlpha = 0.16;
/**
 * Below this density a wisp moves the frame by under one RGB step (0.16 ×
 * 0.02 ≈ 1/300), so the mesh hides and holds no render lease.
 */
const morningMistVisibleDensity = 0.02;

/** The mist role at midday, for callers without a weather frame. */
const defaultMistColor = new Color(weatherRoleSets.midday.mist);

function isColorValue(value: unknown): value is Color {
    return (
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'isColor') === true
    );
}

/** Morning mist wisps over exposed grass, swamp and water tops. */
export function MorningMist({
    stacks,
    gardenId,
    tier,
    enabled,
    timeOfDay,
    weather,
    mistColor,
    reducedMotion: reducedMotionOverride,
    snowCover,
}: {
    stacks: Stack[] | undefined;
    gardenId?: number;
    tier: GameQualityProfileTier;
    enabled: boolean;
    timeOfDay: number;
    weather: EnvironmentWeather | undefined;
    /**
     * Mist role colour (working colour space) from the weather frame; the
     * midday mist role when none is given.
     */
    mistColor?: Color;
    /**
     * Shared weather reduced motion: the wisps stand still instead of
     * hiding. Falls back to the system preference.
     */
    reducedMotion?: boolean;
    /** Snow lying on the ground, 0 to 1; falls back to the game state. */
    snowCover?: number;
}) {
    const { data: blockData } = useBlockData();
    const instances = useEntityBlockInstances({
        stacks,
        names: morningMistSurfaceNames,
    });
    const storeSnow = useGameState((state) => state.snowCoverage);
    const snow = snowCover ?? storeSnow;
    const dragging = useGameState((state) => state.activeDragPreview !== null);
    const systemReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const reducedMotion = reducedMotionOverride ?? systemReducedMotion;
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const anchors = useMemo(
        () =>
            createMorningMistAnchors({
                instances: blockData ? (instances ?? []) : [],
                blockData: blockData ?? [],
                gardenId,
                tier,
            }),
        [blockData, instances, gardenId, tier],
    );
    const mesh = useMemo(
        () => createMorningMistMesh(anchors, time),
        [anchors, time],
    );
    // Reduced motion keeps the wisps, standing still.
    const allowed = enabled && visible && !dragging && anchors.length > 0;
    const density = allowed
        ? resolveMorningMistDensity(timeOfDay, weather, snow)
        : 0;

    useSceneTimeInvalidation(
        'morning-mist',
        density > morningMistVisibleDensity &&
            fixedTime === undefined &&
            !reducedMotion,
        20,
    );
    useEffect(() => {
        const uniforms = mesh.material.uniforms;
        if (uniforms.uMotion) uniforms.uMotion.value = reducedMotion ? 0 : 1;
        const color = uniforms.uColor?.value;
        if (isColorValue(color)) color.copy(mistColor ?? defaultMistColor);
        if (uniforms.uAlpha) uniforms.uAlpha.value = morningMistAlpha;
        requestRender('morning-mist-style');
    }, [mesh, mistColor, reducedMotion, requestRender]);
    useEffect(() => {
        if (!allowed) {
            mesh.visible = false;
            mesh.material.uniforms.uDensity.value = 0;
            updateGameProfileMetadata({ morningMistCount: 0 });
        }
        if (!allowed || mesh.material.uniforms.uDensity.value !== density)
            requestRender('morning-mist-target');
    }, [allowed, density, mesh, requestRender]);
    useFrame((_, delta) => {
        const uniform = mesh.material.uniforms.uDensity;
        // Frozen captures apply the exact target without accumulating rendered frames.
        // Live weather and solar changes fade; preference/visibility changes stop immediately.
        uniform.value = allowed
            ? fixedTime !== undefined
                ? density
                : uniform.value +
                  (density - uniform.value) * (1 - Math.exp(-delta * 2))
            : 0;
        if (Math.abs(uniform.value - density) < 0.0005) uniform.value = density;
        else requestRender('morning-mist-fade');
        mesh.visible = allowed && uniform.value > morningMistVisibleDensity;
        updateGameProfileMetadata({
            morningMistCount: mesh.visible ? anchors.length : 0,
        });
    });
    useEffect(() => {
        updateGameProfileMetadata({
            morningMistCapacity: morningMistCaps[tier],
        });
        return () =>
            updateGameProfileMetadata({
                morningMistCapacity: 0,
                morningMistCount: 0,
            });
    }, [tier]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    return <primitive object={mesh} />;
}
