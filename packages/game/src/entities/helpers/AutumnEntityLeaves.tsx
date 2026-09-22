import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { useAutumnState } from '../../hooks/useAutumnState';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useAutumnParts } from '../../scene/AutumnParts';
import { useAutumnSources } from '../../scene/AutumnSources';
import { getAutumnAccumulationYear } from '../../scene/autumnAccumulation';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { useEntityBlockInstances } from '../EntityInstancesBlock';
import { AutumnLeafBatch } from '../groundDecorations/AutumnLeafBatch';
import { AutumnPartLeafBatch } from './AutumnPartLeafBatch';
import { createAutumnEntityAllocation } from './autumnEntityPlacements';
import { autumnLeafEntityNames } from './autumnLeafSurfaces';
import { createClosedGardenBoxLidCandidates } from './gardenBoxLidTransform';

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
    const boxInstances = useEntityBlockInstances({
        stacks,
        name: 'GardenBox',
    });
    const autumn = useAutumnState();
    const sources = useAutumnSources();
    const registeredParts = useAutumnParts();
    const { data: garden } = useCurrentGarden();
    const year = getAutumnAccumulationYear(useLiveTime());
    const snow = useGameState(
        (state) => Math.round(state.snowCoverage * 20) / 20,
    );
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    // Drag previews move rendered parts without replacing their registration.
    const activeDragPreview = useGameState((state) => state.activeDragPreview);
    const hoveredGardenBoxBlockId = useGameState(
        (state) => state.activeDragPreview?.hoveredGardenBoxBlockId ?? null,
    );
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    // The preview changes an imperative Three.js world matrix without changing
    // the registration object; sample it again on each preview state change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: activeDragPreview invalidates the imperative world-matrix snapshot.
    const liveParts = useMemo(
        () =>
            registeredParts.map((part) => {
                part.object.updateWorldMatrix(true, false);
                return { ...part, matrix: part.object.matrixWorld.clone() };
            }),
        [registeredParts, activeDragPreview],
    );
    const allocation = useMemo(() => {
        const position = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.getWorldPosition(position);
            return { id, x: position.x, z: position.z };
        });
        const registeredBlockIds = new Set(
            registeredParts
                .filter((part) => part.partId === 'GardenBox_Lid_HingeOrigin')
                .map((part) => part.blockId),
        );
        const openBlockIds = new Set(
            [hoveredGardenBoxBlockId, openGardenBoxBlockId].filter(
                (id): id is string => id !== null,
            ),
        );
        const parts = [
            ...liveParts,
            ...createClosedGardenBoxLidCandidates({
                instances: boxInstances ?? [],
                openBlockIds,
                registeredBlockIds,
            }),
        ];
        return createAutumnEntityAllocation({
            instances: instances ?? [],
            parts,
            trees,
            amount: disabled ? 0 : autumn.settledLeafAmount,
            snow,
            tier,
            year,
            gardenId: garden?.id,
        });
    }, [
        instances,
        boxInstances,
        sources,
        registeredParts,
        liveParts,
        hoveredGardenBoxBlockId,
        openGardenBoxBlockId,
        disabled,
        autumn.settledLeafAmount,
        snow,
        tier,
        year,
        garden?.id,
    ]);
    const blockCount = allocation.blocks.reduce(
        (sum, batch) => sum + batch.instances.length,
        0,
    );
    const renderedPartCounts = useRef(new Map<number, number>());
    const reportPartCount = useCallback(
        (variant: number, count: number) => {
            renderedPartCounts.current.set(variant, count);
            updateGameProfileMetadata({
                autumnEntityLeafClusters:
                    blockCount +
                    [...renderedPartCounts.current.values()].reduce(
                        (sum, value) => sum + value,
                        0,
                    ),
            });
        },
        [blockCount],
    );
    useEffect(() => {
        updateGameProfileMetadata({
            autumnEntityLeafClusters:
                blockCount +
                [...renderedPartCounts.current.values()].reduce(
                    (sum, value) => sum + value,
                    0,
                ),
        });
        return () => updateGameProfileMetadata({ autumnEntityLeafClusters: 0 });
    }, [blockCount]);
    return (
        <>
            {allocation.blocks.map((batch) => (
                <AutumnLeafBatch key={batch.key} batch={batch} kind="entity" />
            ))}
            {[...allocation.parts.entries()].map(([variant, placements]) => (
                <AutumnPartLeafBatch
                    key={variant}
                    variant={variant}
                    placements={placements}
                    onCount={reportPartCount}
                    amount={disabled ? 0 : autumn.settledLeafAmount}
                    snow={snow}
                />
            ))}
        </>
    );
}
