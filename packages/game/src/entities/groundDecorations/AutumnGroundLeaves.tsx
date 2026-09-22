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
import { AutumnLeafBatch } from './AutumnLeafBatch';
import {
    createAutumnGroundBatches,
    getAutumnGroundBlocks,
} from './autumnGroundPlacements';
import type { GroundDecorationWeather } from './GroundDecorationInstances';

export function AutumnGroundLeaves({
    stacks,
    tier,
    weather,
}: {
    weather?: GroundDecorationWeather;
    stacks: Stack[] | undefined;
    tier: GameQualityProfileTier;
}) {
    const blocks = useMemo(() => getAutumnGroundBlocks(stacks), [stacks]);
    const names = useMemo(
        () => [...new Set(blocks.map(({ block }) => block.name))],
        [blocks],
    );
    const instances = useEntityBlockInstances({ stacks, names, yOffset: 0.2 });
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
        const allowed = new Set(blocks.map(({ block }) => block.id));
        const position = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.getWorldPosition(position);
            return { id, x: position.x, z: position.z };
        });
        return createAutumnGroundBatches({
            instances:
                instances?.filter(({ block }) => allowed.has(block.id)) ?? [],
            trees,
            amount: disabled ? 0 : autumn.settledLeafAmount,
            snow,
            tier,
            year,
            gardenId: garden?.id,
            windDirection: weather?.windDirection,
            windSpeed: weather?.windSpeed,
        });
    }, [
        blocks,
        instances,
        sources,
        disabled,
        autumn.settledLeafAmount,
        snow,
        tier,
        year,
        garden?.id,
        weather?.windDirection,
        weather?.windSpeed,
    ]);
    const count = batches.reduce(
        (sum, batch) => sum + batch.instances.length,
        0,
    );
    useEffect(() => {
        updateGameProfileMetadata({ autumnGroundLeafClusters: count });
        return () => updateGameProfileMetadata({ autumnGroundLeafClusters: 0 });
    }, [count]);
    return batches.map((batch) => (
        <AutumnLeafBatch key={batch.key} batch={batch} />
    ));
}
