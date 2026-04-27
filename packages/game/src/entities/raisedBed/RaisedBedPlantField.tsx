import { calculatePlantsPerField } from '@gredice/js/plants';
import { animated, useSpring } from '@react-spring/three';
import { useMemo } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import {
    calculateInGamePlantGeneration,
    getPlantLifecycleWindowDays,
    resolveInGamePlantPreset,
} from '../../generators/plant/lib/inGamePlantPresets';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { useSnapshotTime } from '../../hooks/useSnapshotTime';
import { useGameState } from '../../useGameState';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { RaisedBedGeneratedPlantBatch } from './RaisedBedGeneratedPlantBatch';

export function RaisedBedPlantField({
    field,
    orientation,
    blockIndex,
}: {
    field: {
        positionIndex: number;
        plantSortId: number | null | undefined;
        plantStatus?: string | null;
        plantSowDate?: string | null;
    };
    orientation: RaisedBedOrientation;
    blockIndex: number;
}) {
    const { positionIndex, plantSortId, plantSowDate } = field;
    const { data: sortData } = usePlantSort(plantSortId);
    const flags = useGameFlags();
    const isMock = useGameState((state) => state.isMock);
    const currentTime = useSnapshotTime();
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetY =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05; // 0.285 is the distance between rows of blocks
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierY = orientation === 'vertical' ? 0.27 : 0.285;

    const { plantsPerRow, totalPlants } = calculatePlantsPerField(
        sortData?.information?.plant.attributes?.seedingDistance,
    );
    const safePlantsPerRow = Math.max(plantsPerRow, 1);
    const seedsCount = totalPlants;
    const seedMap = [
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0.13, offset: 0.03, scale: 1.8 },
        { multiplier: 0.09, offset: 0.025, scale: 1.6 },
        { multiplier: 0.07, offset: 0.0225, scale: 1.4 },
    ];
    const seedLayout = seedMap[safePlantsPerRow] ?? seedMap[seedMap.length - 1];
    const fieldSlots = useMemo(() => {
        return Array.from({ length: seedsCount }, (_, index) => {
            return [
                Math.floor(index / safePlantsPerRow) * seedLayout.multiplier -
                    safePlantsPerRow * seedLayout.offset,
                0,
                (index % safePlantsPerRow) * seedLayout.multiplier -
                    safePlantsPerRow * seedLayout.offset,
            ] as const;
        });
    }, [
        safePlantsPerRow,
        seedLayout.multiplier,
        seedLayout.offset,
        seedsCount,
    ]);
    const resolvedPlantPreset = useMemo(() => {
        return resolveInGamePlantPreset([
            sortData?.information.name,
            sortData?.information.plant.information?.name,
            sortData?.information.plant.information?.latinName,
        ]);
    }, [
        sortData?.information.name,
        sortData?.information.plant.information?.latinName,
        sortData?.information.plant.information?.name,
    ]);
    const lifecycleWindowDays = getPlantLifecycleWindowDays({
        germinationWindowMax:
            sortData?.information.plant.attributes?.germinationWindowMax,
        growthWindowMax:
            sortData?.information.plant.attributes?.growthWindowMax,
        harvestWindowMax:
            sortData?.information.plant.attributes?.harvestWindowMax,
    });
    const plantGeneration =
        plantSowDate && resolvedPlantPreset
            ? calculateInGamePlantGeneration({
                  currentTime,
                  sowDate: plantSowDate,
                  lifecycleWindowDays,
                  growthMultiplier: resolvedPlantPreset.growthMultiplier,
              })
            : 0;
    const shouldRenderGeneratedPlants =
        Boolean(flags.enablePlantGeneratorFlag || isMock) &&
        Boolean(resolvedPlantPreset) &&
        Boolean(plantSowDate) &&
        (field.plantStatus === 'sprouted' ||
            field.plantStatus === 'ready' ||
            field.plantStatus === 'harvested');
    const plantInstanceScale = resolvedPlantPreset
        ? resolvedPlantPreset.instanceScale *
          Math.max(0.72, 1 - Math.max(0, safePlantsPerRow - 2) * 0.12)
        : 0;
    const generatedPlantInstances = useMemo(() => {
        if (!resolvedPlantPreset) {
            return [];
        }

        return fieldSlots.map((position, index) => ({
            generation: plantGeneration,
            position: [position[0], 0.02, position[2]] as const,
            scale: plantInstanceScale,
            seed: `${plantSortId ?? 'sort'}:${positionIndex}:${blockIndex}:${index}`,
        }));
    }, [
        blockIndex,
        fieldSlots,
        plantGeneration,
        plantInstanceScale,
        plantSortId,
        positionIndex,
        resolvedPlantPreset,
    ]);

    const seedColor = plantSowDate ? 'black' : '#6495ED';
    const seedOpacityToMax = useSpring({
        from: { opacity: 1 },
        to: [{ opacity: 0.5 }, { opacity: 1 }],
        duration: 1000,
        loop: true,
        cancel: Boolean(plantSowDate),
    });

    // TODO: Move to seed block/part
    const { nodes } = useGameGLTF();
    const { row, col } = getGridPositionFromIndex(positionIndex, orientation);
    const fieldPosition = [
        col * multiplierX - offsetX,
        -0.75,
        (2 - row) * multiplierY - offsetY,
    ] as const;

    // If no plant sort is defined, don't render
    if (!plantSortId) {
        return null;
    }

    return (
        <group position={fieldPosition}>
            {shouldRenderGeneratedPlants && resolvedPlantPreset ? (
                <RaisedBedGeneratedPlantBatch
                    definition={resolvedPlantPreset.definition}
                    instances={generatedPlantInstances}
                />
            ) : (
                fieldSlots.map((position) => {
                    const slotKey = `${plantSortId ?? 'sort'}:${positionIndex}:${position[0].toFixed(3)}:${position[2].toFixed(3)}`;

                    return (
                        <mesh
                            key={slotKey}
                            castShadow
                            receiveShadow
                            position={position}
                            scale={seedLayout.scale}
                            geometry={nodes.Seed.geometry}
                        >
                            <animated.meshStandardMaterial
                                color={seedColor}
                                transparent
                                {...seedOpacityToMax}
                            />
                        </mesh>
                    );
                })
            )}
        </group>
    );
}
