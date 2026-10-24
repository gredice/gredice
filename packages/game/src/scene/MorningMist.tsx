import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useEntityBlockInstances } from '../entities/EntityInstancesBlock';
import { useBlockData } from '../hooks/useBlockData';
import { getRainCoveredCells } from '../rain/rainRippleState';
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

export function MorningMist({
    stacks,
    gardenId,
    tier,
    enabled,
    timeOfDay,
    weather,
}: {
    stacks: Stack[] | undefined;
    gardenId?: number;
    tier: GameQualityProfileTier;
    enabled: boolean;
    timeOfDay: number;
    weather: EnvironmentWeather | undefined;
}) {
    const { data: blockData } = useBlockData();
    const instances = useEntityBlockInstances({
        stacks,
        names: morningMistSurfaceNames,
    });
    const snow = useGameState((state) => state.snowCoverage);
    const dragging = useGameState((state) => state.activeDragPreview !== null);
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const anchors = useMemo(
        () =>
            createMorningMistAnchors({
                instances: blockData ? (instances ?? []) : [],
                blockData: blockData ?? [],
                coveredCells: getRainCoveredCells(
                    stacks ?? [],
                    blockData ?? [],
                ),
                gardenId,
                tier,
            }),
        [blockData, instances, stacks, gardenId, tier],
    );
    const mesh = useMemo(
        () => createMorningMistMesh(anchors, time),
        [anchors, time],
    );
    const allowed =
        enabled && visible && !dragging && !reducedMotion && anchors.length > 0;
    const density = allowed
        ? resolveMorningMistDensity(timeOfDay, weather, snow)
        : 0;

    useSceneTimeInvalidation(
        'morning-mist',
        density > 0 && fixedTime === undefined,
        20,
    );
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
        mesh.visible = allowed && uniform.value > 0.001;
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
