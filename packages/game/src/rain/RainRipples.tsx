import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useEntityBlockInstances } from '../entities/EntityInstancesBlock';
import { isWaterBlockName } from '../entities/waterBlockNames';
import { useBlockData } from '../hooks/useBlockData';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../scene/gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import {
    useRainSurfaceIntensityUniform,
    useRainSurfacePuddleStrengthUniform,
    useRainSurfaceWetnessState,
} from '../scene/WeatherSurfaceUniformProvider';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { createRainRippleMesh } from './rainRippleMesh';
import {
    createRainRippleAnchors,
    getRainCoveredCells,
    rainRippleCaps,
    rainRippleSurfaceNames,
    rainRipplesEnabled,
} from './rainRippleState';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(reducedMotionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(reducedMotionQuery).matches;
}

export function RainRipples({
    stacks,
    gardenId,
    tier,
    enabled = true,
    snow = 0,
}: {
    stacks: Stack[] | undefined;
    gardenId?: number;
    tier: GameQualityProfileTier;
    enabled?: boolean;
    snow?: number;
}) {
    const { data: blockData } = useBlockData();
    const instances = useEntityBlockInstances({
        stacks,
        names: rainRippleSurfaceNames,
    });
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const raining = useGameState((state) => state.rainSurfaceIntensity > 0.66);
    const waterRaining = useGameState(
        (state) => state.rainSurfaceIntensity >= 0.08,
    );
    const rain = useRainSurfaceIntensityUniform();
    const dragging = useGameState((state) => state.activeDragPreview !== null);
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const { active, wetnessUniform } = useRainSurfaceWetnessState({
        drySpeed: 1.8,
        wetSpeed: 5,
        intensityMultiplier: 1,
        minimumWetness: 0.6,
    });
    const puddleStrength = useRainSurfacePuddleStrengthUniform();
    const allowed = rainRipplesEnabled({
        enabled: enabled && !dragging,
        reducedMotion,
        snow: Math.max(snow, snowCoverage),
        tier,
    });
    const coveredCells = useMemo(
        () => getRainCoveredCells(stacks ?? [], blockData ?? []),
        [stacks, blockData],
    );
    const groundActive = raining && active;
    const anchors = useMemo(
        () =>
            createRainRippleAnchors({
                instances: blockData
                    ? (instances ?? []).filter(
                          (instance) =>
                              groundActive ||
                              isWaterBlockName(instance.block.name),
                      )
                    : [],
                blockData: blockData ?? [],
                coveredCells,
                gardenId,
                tier,
            }),
        [blockData, instances, coveredCells, gardenId, tier, groundActive],
    );
    const mesh = useMemo(
        () =>
            createRainRippleMesh({
                anchors,
                time,
                rain,
                wetness: wetnessUniform,
                puddleStrength,
            }),
        [anchors, time, rain, wetnessUniform, puddleStrength],
    );
    const showing =
        allowed &&
        (groundActive || waterRaining) &&
        visible &&
        anchors.length > 0;
    useSceneTimeInvalidation(
        'rain-ripples',
        showing && fixedTime === undefined,
    );
    useEffect(() => {
        updateGameProfileMetadata({
            rainRippleCapacity: rainRippleCaps[tier],
            rainRippleCount: showing ? anchors.length : 0,
        });
        return () =>
            updateGameProfileMetadata({
                rainRippleCapacity: 0,
                rainRippleCount: 0,
            });
    }, [anchors.length, showing, tier]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    return <primitive object={mesh} visible={showing} />;
}
