import { useEffect, useMemo } from 'react';
import { useAutumnFoliageGeometry } from '../hooks/useAutumnFoliageGeometry';
import { useAutumnState } from '../hooks/useAutumnState';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import { getAutumnPaletteSeed } from '../scene/autumnPalette';
import { bushTextureColor } from '../scene/bushFoliage';
import { snowPresets } from '../snow/snowPresets';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from './EntityInstancesBlock';

export function BushCanopyBatch({
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
    const { nodes, materials } = useGameGLTF('Bush');
    const autumn = useAutumnState();
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const progress = disabled ? 0 : autumn.foliageColorProgress;
    const selected = useMemo(
        () =>
            instances.filter(
                (instance) =>
                    getAutumnPaletteSeed(instance.block.id) === palette &&
                    getAutumnCanopyStage(
                        disabled ? 1 : autumn.leafRetention,
                        instance.block.id,
                    ) === stage,
            ),
        [instances, palette, stage, disabled, autumn.leafRetention],
    );
    const material = useMemo(() => {
        const value = materials['Material.ColorPaletteMain'].clone();
        value.color.set('white');
        value.vertexColors = true;
        return value;
    }, [materials]);
    useEffect(() => () => material.dispose(), [material]);
    const sprigMaterial = useMemo(() => {
        if (stage !== 'full') return null;
        const value = materials['Material.GrassPart'].clone();
        value.color.set('white');
        value.vertexColors = true;
        return value;
    }, [materials, stage]);
    useEffect(() => () => sprigMaterial?.dispose(), [sprigMaterial]);
    const geometry = useAutumnFoliageGeometry(
        stage === 'full'
            ? nodes.Bush_1_1.geometry
            : stage === 'thinning'
              ? nodes.Bush_AutumnThinning.geometry
              : nodes.Bush_AutumnSparse.geometry,
        nodes.Bush_1_1.geometry,
        materials['Material.ColorPaletteMain'].color,
        progress,
        palette,
        bushTextureColor,
    );
    const sprigGeometry = useAutumnFoliageGeometry(
        nodes.Bush_1_2.geometry,
        nodes.Bush_1_1.geometry,
        materials['Material.GrassPart'].color,
        progress,
        palette,
    );
    return (
        <>
            <EntityInstancesGeometry
                instanceKey={`Bush:canopy:${palette}:${stage}`}
                instances={selected}
                geometry={geometry}
                material={material}
                scale={[0.5, 0.5, 0.5]}
                castShadow
                receiveShadow
                renderSnow={renderSnow}
                snow={snowPresets.bushCore}
                snowLift={0.002}
                snowOverlayMinCoverage={snowOverlayMinCoverage}
            />
            {sprigMaterial && (
                <EntityInstancesGeometry
                    instanceKey={`Bush:sprigs:${palette}`}
                    instances={selected}
                    geometry={sprigGeometry}
                    material={sprigMaterial}
                    scale={[0.5, 0.5, 0.5]}
                    castShadow
                    receiveShadow
                    renderSnow={renderSnow}
                    snow={snowPresets.bushFoliage}
                    snowLift={0.002}
                    snowOverlayMinCoverage={snowOverlayMinCoverage}
                />
            )}
        </>
    );
}
