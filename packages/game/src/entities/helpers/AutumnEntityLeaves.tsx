import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { useAutumnState } from '../../hooks/useAutumnState';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useAutumnSources } from '../../scene/AutumnSources';
import { getAutumnAccumulationYear } from '../../scene/autumnAccumulation';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { useEntityBlockInstances } from '../EntityInstancesBlock';
import { AutumnLeafBatch } from '../groundDecorations/AutumnLeafBatch';
import { createAutumnEntityBatches } from './autumnEntityPlacements';
import { autumnLeafEntityNames } from './autumnLeafSurfaces';

export function AutumnEntityLeaves({
    stacks,
    tier,
}: {
    stacks: Stack[] | undefined;
    tier: GameQualityProfileTier;
}) {
    const instances = useEntityBlockInstances({
        stacks,
        names: autumnLeafEntityNames,
    });
    const autumn = useAutumnState();
    const sources = useAutumnSources();
    const { data: garden } = useCurrentGarden();
    const year = getAutumnAccumulationYear(useLiveTime());
    const snow = useGameState(
        (state) => Math.round(state.snowCoverage * 20) / 20,
    );
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const batches = useMemo(() => {
        const position = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.getWorldPosition(position);
            return { id, x: position.x, z: position.z };
        });
        return createAutumnEntityBatches({
            instances: instances ?? [],
            trees,
            amount: disabled ? 0 : autumn.settledLeafAmount,
            snow,
            tier,
            year,
            gardenId: garden?.id,
        });
    }, [
        instances,
        sources,
        disabled,
        autumn.settledLeafAmount,
        snow,
        tier,
        year,
        garden?.id,
    ]);
    const count = batches.reduce(
        (sum, batch) => sum + batch.instances.length,
        0,
    );
    useEffect(() => {
        updateGameProfileMetadata({ autumnEntityLeafClusters: count });
        return () => updateGameProfileMetadata({ autumnEntityLeafClusters: 0 });
    }, [count]);
    return batches.map((batch) => (
        <AutumnLeafBatch key={batch.key} batch={batch} kind="entity" />
    ));
}
