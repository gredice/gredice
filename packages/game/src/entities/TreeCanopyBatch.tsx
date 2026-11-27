import { useEffect, useMemo } from 'react';
import { useAutumnFoliageGeometry } from '../hooks/useAutumnFoliageGeometry';
import { useAutumnState } from '../hooks/useAutumnState';
import { useSeasonState } from '../hooks/useSeasonState';
import {
    type getAutumnCanopyStage,
    getAutumnTreeCanopyStage,
    resolveTreeFoliageColorProgress,
} from '../scene/autumnCanopy';
import { getAutumnPaletteSeed } from '../scene/autumnPalette';
import { useIdleBreathingUniforms } from '../scene/IdleBreathingMotion';
import { bindIdleBreathingMaterial } from '../scene/idleBreathing';
import { useSnowOverlayVisible } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from './EntityInstancesBlock';
import { treeEntityScale } from './treeEntityScale';

export function TreeCanopyBatch({
    instances,
    palette,
    stage,
    renderSnow,
    snowOverlayMinCoverage,
}: {
    instances: EntityBlockInstance[];
    palette: string;
    stage: ReturnType<typeof getAutumnCanopyStage>;
    renderSnow: boolean;
    snowOverlayMinCoverage: number;
}) {
    const { nodes, materials } = useGameGLTF('Tree');
    const autumn = useAutumnState();
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const season = useSeasonState();
    const progress = disabled
        ? 0
        : resolveTreeFoliageColorProgress(
              autumn.foliageColorProgress,
              season.season,
          );
    const selected = useMemo(
        () =>
            instances.filter(
                (instance) =>
                    getAutumnPaletteSeed(instance.block.id) === palette &&
                    // A bare tree has no crown, so it is in no batch.
                    getAutumnTreeCanopyStage(
                        disabled ? 1 : autumn.leafRetention,
                        instance.block.id,
                    ) === stage,
            ),
        [instances, palette, stage, disabled, autumn.leafRetention],
    );
    const snowLoaded = useSnowOverlayVisible({
        coverageMultiplier: snowPresets.treeCanopyInner.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
    });
    // Crown and sprigs share one pivot and phase so they breathe together.
    // Snow overlays do not breathe, so a snowy crown holds still.
    const breathing = useIdleBreathingUniforms(
        'canopy',
        nodes.Tree_1_2.geometry,
        !(renderSnow && snowLoaded),
    );
    const material = useMemo(() => {
        const value = materials['Material.Leaves'].clone();
        value.color.set('white');
        value.vertexColors = true;
        bindIdleBreathingMaterial(value, breathing);
        return value;
    }, [materials, breathing]);
    useEffect(() => () => material.dispose(), [material]);
    const sprigMaterial = useMemo(() => {
        if (stage !== 'full') return null;
        const value = materials['Material.GrassPart'].clone();
        value.color.set('white');
        value.vertexColors = true;
        bindIdleBreathingMaterial(value, breathing);
        return value;
    }, [materials, stage, breathing]);
    useEffect(() => () => sprigMaterial?.dispose(), [sprigMaterial]);
    const geometry = useAutumnFoliageGeometry(
        stage === 'full'
            ? nodes.Tree_1_2.geometry
            : stage === 'thinning'
              ? nodes.Tree_AutumnThinning.geometry
              : nodes.Tree_AutumnSparse.geometry,
        nodes.Tree_1_2.geometry,
        materials['Material.Leaves'].color,
        progress,
        palette,
    );
    const sprigGeometry = useAutumnFoliageGeometry(
        nodes.Tree_1_3.geometry,
        nodes.Tree_1_2.geometry,
        materials['Material.GrassPart'].color,
        progress,
        palette,
    );
    return (
        <>
            <EntityInstancesGeometry
                instanceKey={`Tree:canopy:${palette}:${stage}`}
                instances={selected}
                geometry={geometry}
                material={material}
                scale={treeEntityScale}
                castShadow
                receiveShadow
                renderSnow={renderSnow}
                snow={snowPresets.treeCanopyInner}
                snowLift={0.002}
                snowOverlayMinCoverage={snowOverlayMinCoverage}
            />
            {sprigMaterial && (
                <EntityInstancesGeometry
                    instanceKey={`Tree:sprigs:${palette}`}
                    instances={selected}
                    geometry={sprigGeometry}
                    material={sprigMaterial}
                    scale={treeEntityScale}
                    castShadow
                    receiveShadow
                />
            )}
        </>
    );
}
