import { useMemo } from 'react';
import { useAutumnState } from '../hooks/useAutumnState';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import { autumnPaletteSeeds } from '../scene/autumnPalette';
import { useAutumnInstanceSources } from '../scene/useAutumnInstanceSources';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    EntityInstancesGeometry,
    useEntityBlockInstances,
} from './EntityInstancesBlock';
import { TreeCanopyBatch } from './TreeCanopyBatch';

export function TreeCanopyInstances({
    stacks,
    renderSnow = true,
    snowOverlayMinCoverage = 0.02,
}: {
    stacks: Stack[] | undefined;
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
}) {
    const instances = useEntityBlockInstances({
        name: 'Tree',
        stacks,
        yOffset: 0.5,
    });
    const { nodes, materials } = useGameGLTF('Tree');
    useAutumnInstanceSources(instances);
    const autumn = useAutumnState();
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const sparse = useMemo(
        () =>
            instances?.filter(
                (instance) =>
                    getAutumnCanopyStage(
                        disabled ? 1 : autumn.leafRetention,
                        instance.block.id,
                    ) !== 'full',
            ),
        [instances, disabled, autumn.leafRetention],
    );
    if (!instances?.length) return null;
    return (
        <>
            {autumnPaletteSeeds.flatMap((palette) =>
                (['full', 'thinning', 'sparse'] as const).map((stage) => (
                    <TreeCanopyBatch
                        key={`${palette}:${stage}`}
                        instances={instances}
                        palette={palette}
                        stage={stage}
                        renderSnow={renderSnow}
                        snowOverlayMinCoverage={snowOverlayMinCoverage}
                    />
                )),
            )}
            <EntityInstancesGeometry
                instanceKey="Tree:branches"
                instances={sparse}
                geometry={nodes.Tree_AutumnBranches.geometry}
                material={materials['Material.Planks']}
                scale={[0.125, 0.5, 0.125]}
                castShadow
                receiveShadow
            />
        </>
    );
}
