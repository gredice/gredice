import { useMemo } from 'react';
import { useAutumnState } from '../hooks/useAutumnState';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import { autumnPaletteSeeds } from '../scene/autumnPalette';
import { useAutumnInstanceSources } from '../scene/useAutumnInstanceSources';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import { BushCanopyBatch } from './BushCanopyBatch';
import {
    EntityInstancesGeometry,
    useEntityBlockInstances,
} from './EntityInstancesBlock';

export function BushCanopyInstances({
    stacks,
    renderSnow = true,
    snowOverlayMinCoverage = 0.02,
}: {
    stacks: Stack[] | undefined;
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
}) {
    const instances = useEntityBlockInstances({
        name: 'Bush',
        stacks,
        yOffset: 0,
    });
    const { nodes, materials } = useGameGLTF('Bush');
    useAutumnInstanceSources(instances, 'bush');
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
                    <BushCanopyBatch
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
                instanceKey="Bush:branches"
                instances={sparse}
                geometry={nodes.Bush_AutumnBranches.geometry}
                material={materials['Material.BushBranches']}
                scale={[0.5, 0.5, 0.5]}
                castShadow
                receiveShadow
            />
        </>
    );
}
