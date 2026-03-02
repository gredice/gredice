import { calculatePlantsPerField } from '@gredice/js/plants';
import { animated, useSpring } from '@react-spring/three';
import { usePlantSort } from '../../hooks/usePlantSorts';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';

export function RaisedBedPlantField({
    field,
    orientation,
    blockIndex,
}: {
    field: {
        positionIndex: number;
        plantSortId: number | null | undefined;
        plantSowDate?: string | null;
    };
    orientation: RaisedBedOrientation;
    blockIndex: number;
}) {
    const { positionIndex, plantSortId, plantSowDate } = field;
    const { data: sortData } = usePlantSort(plantSortId);
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetY =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05; // 0.285 is the distance between rows of blocks
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierY = orientation === 'vertical' ? 0.27 : 0.285;

    const { plantsPerRow, totalPlants } = calculatePlantsPerField(
        sortData?.information?.plant.attributes?.seedingDistance,
    );
    const seedsCount = totalPlants;

    const seedMap = [
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0.13, offset: 0.03, scale: 1.8 },
        { multiplier: 0.09, offset: 0.025, scale: 1.6 },
        { multiplier: 0.07, offset: 0.0225, scale: 1.4 },
    ];

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
            {Array.from({ length: seedsCount }).map((_, index) => {
                const position = [
                    Math.floor(index / plantsPerRow) *
                        seedMap[plantsPerRow].multiplier -
                        plantsPerRow * seedMap[plantsPerRow].offset,
                    0,
                    (index % plantsPerRow) * seedMap[plantsPerRow].multiplier -
                        plantsPerRow * seedMap[plantsPerRow].offset,
                ] as const;
                return (
                    <mesh
                        // biome-ignore lint/suspicious/noArrayIndexKey: Array generated items, can use index
                        key={index}
                        castShadow
                        receiveShadow
                        position={position}
                        scale={seedMap[plantsPerRow].scale}
                        geometry={nodes.Seed.geometry}
                    >
                        <animated.meshStandardMaterial
                            color={seedColor}
                            transparent
                            {...seedOpacityToMax}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}
