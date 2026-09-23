import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';
import { useEntityBlockInstances } from '../EntityInstancesBlock';
import { AutumnLeafBatch } from '../groundDecorations/AutumnLeafBatch';
import { AutumnPartLeafBatch } from './AutumnPartLeafBatch';
import {
    createAutumnEntityAllocation,
    getAutumnVisibleSurfaceCount,
} from './autumnEntityPlacements';
import {
    autumnLeafEntityNames,
    autumnLeafSurfaces,
} from './autumnLeafSurfaces';
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
    const hoveredGardenBoxBlockId = useGameState(
        (state) => state.activeDragPreview?.hoveredGardenBoxBlockId ?? null,
    );
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    const [densityRevision, setDensityRevision] = useState(0);
    // Density changes are discrete. A scene spring may cross a tree-influence
    // threshold after React sampled an earlier matrix, including from zero.
    // biome-ignore lint/correctness/useExhaustiveDependencies: densityRevision invalidates the imperative world-matrix snapshot.
    const liveParts = useMemo(
        () =>
            registeredParts.map((part) => {
                part.object.updateWorldMatrix(true, false);
                return { ...part, matrix: part.object.matrixWorld.clone() };
            }),
        [registeredParts, densityRevision],
    );
    const boxCandidates = useMemo(() => {
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
        return createClosedGardenBoxLidCandidates({
            instances: boxInstances ?? [],
            openBlockIds,
            registeredBlockIds,
        });
    }, [
        boxInstances,
        registeredParts,
        hoveredGardenBoxBlockId,
        openGardenBoxBlockId,
    ]);
    const sampledDensity = useRef<string | null>(null);
    useFrame(() => {
        const position = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.updateWorldMatrix(true, false);
            object.getWorldPosition(position);
            return { id, x: position.x, z: position.z };
        });
        const amount = disabled ? 0 : autumn.settledLeafAmount;
        const signature = [
            ...(instances ?? []).map((instance) => {
                const surfaces = autumnLeafSurfaces[instance.block.name];
                if (
                    !surfaces ||
                    instance.stack.blocks
                        .slice(instance.blockIndex + 1)
                        .some((above) => above.name.startsWith('Block_'))
                )
                    return `${instance.block.id}:0`;
                const offsets =
                    instance.block.name === 'Raised_Bed'
                        ? getRaisedBedFootprintSegments(instance.rotation).map(
                              (segment) => segment.offset,
                          )
                        : [{ x: 0, z: 0 }];
                return `${instance.block.id}:${offsets
                    .map((offset) =>
                        getAutumnVisibleSurfaceCount(
                            surfaces.length,
                            instance.position[0] + offset.x,
                            instance.position[2] + offset.z,
                            trees,
                            amount,
                            snow,
                        ),
                    )
                    .join(',')}`;
            }),
            ...registeredParts.map((part) => {
                if (!part.eligible || part.covered)
                    return `${part.blockId}:${part.partId}:0`;
                part.object.updateWorldMatrix(true, false);
                const origin = position.setFromMatrixPosition(
                    part.object.matrixWorld,
                );
                return `${part.blockId}:${part.partId}:${getAutumnVisibleSurfaceCount(
                    part.surfaces.length,
                    origin.x,
                    origin.z,
                    trees,
                    amount,
                    snow,
                )}`;
            }),
            ...boxCandidates.map((part) => {
                const origin = position.setFromMatrixPosition(part.matrix);
                return `${part.blockId}:${part.partId}:${part.eligible && !part.covered ? getAutumnVisibleSurfaceCount(part.surfaces.length, origin.x, origin.z, trees, amount, snow) : 0}`;
            }),
        ].join('|');
        if (
            sampledDensity.current !== null &&
            sampledDensity.current !== signature
        )
            setDensityRevision((value) => value + 1);
        sampledDensity.current = signature;
    }, -2);
    const allocation = useMemo(() => {
        const position = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.updateWorldMatrix(true, false);
            object.getWorldPosition(position);
            return { id, x: position.x, z: position.z };
        });
        return createAutumnEntityAllocation({
            instances: instances ?? [],
            parts: [...liveParts, ...boxCandidates],
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
        liveParts,
        boxCandidates,
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
