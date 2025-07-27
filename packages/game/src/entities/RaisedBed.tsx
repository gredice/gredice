import { animated } from "@react-spring/three";
import { models } from "../data/models";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useEntityNeighbors } from "./helpers/useEntityNeighbors";
import { useHoveredBlockStore } from "../controls/SelectableGroup";
import { HoverOutline } from "./helpers/HoverOutline";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { usePlantSort } from "../hooks/usePlantSorts";

export function RaisedBedPlantField({ positionIndex, plantSortId }: { positionIndex: number, plantSortId: number }) {
    const { data: sortData } = usePlantSort(plantSortId);
    const offsetX = 0.28;
    const offsetY = 0.28;
    const multiplierX = 0.27;
    const multiplierY = 0.27;

    let plantsPerRow = Math.floor(30 / (sortData?.information.plant.attributes?.seedingDistance ?? 30));
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${sortData?.information.plant.information?.name}. Setting to 1.`);
        plantsPerRow = 1;
    }
    const seedsCount = plantsPerRow * plantsPerRow;

    const seedMap = [
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0, offset: 0, scale: 2 },
        { multiplier: 0.13, offset: 0.03, scale: 1.8 },
        { multiplier: 0.09, offset: 0.025, scale: 1.6 },
        { multiplier: 0.07, offset: 0.0225, scale: 1.4 }
    ];

    const seedColor = 'black';

    const { nodes }: any = useGameGLTF(models.GameAssets.url);
    const resolvedPositionX = Math.floor(positionIndex / 3);
    const resolvedPositionY = positionIndex % 3;
    const fieldPosition = [
        (resolvedPositionX) * multiplierX - offsetX,
        -0.75,
        (2 - resolvedPositionY) * multiplierY - offsetY
    ] as const;
    return (
        <group position={fieldPosition}>
            {Array.from({ length: seedsCount }).map((_, index) => {
                const position = [
                    Math.floor(index / plantsPerRow) * seedMap[plantsPerRow].multiplier - plantsPerRow * seedMap[plantsPerRow].offset,
                    0,
                    (index % plantsPerRow) * seedMap[plantsPerRow].multiplier - plantsPerRow * seedMap[plantsPerRow].offset
                ] as const;
                return (
                    <mesh
                        key={index}
                        castShadow
                        receiveShadow
                        position={position}
                        scale={seedMap[plantsPerRow].scale}
                        geometry={nodes.Seed.geometry}
                    >
                        <meshStandardMaterial color={seedColor} transparent />
                    </mesh>
                );
            })}
        </group>
    );
}

export function RiasedBedFields({ blockId }: { blockId: string }) {
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = currentGarden?.raisedBeds?.find(rb => rb.blockId === blockId);

    return (
        <>
            {raisedBed?.fields?.map(field => (
                <>
                    {field.plantSortId && (
                        <RaisedBedPlantField
                            key={field.id}
                            positionIndex={field.positionIndex}
                            plantSortId={field.plantSortId} />
                    )}
                </>
            ))}
        </>
    );
}

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url)
    const currentStackHeight = useStackHeight(stack, block);
    const hovered = useHoveredBlockStore(state => state.hoveredBlock) === block;

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = "O";
    let shapeRotation = 0;
    const neighbors = useEntityNeighbors(stack, block);
    if (neighbors.total === 1) {
        shape = "U";

        if (neighbors.n) {
            shapeRotation = 0;
        } else if (neighbors.e) {
            shapeRotation = 1;
        } else if (neighbors.s) {
            shapeRotation = 2;
        } else if (neighbors.w) {
            shapeRotation = 3;
        }
    } else if (neighbors.total === 2) {
        if ((neighbors.n && neighbors.s) ||
            (neighbors.e && neighbors.w)) {
            shape = "I";

            if (neighbors.n && neighbors.s) {
                shapeRotation = 1;
            } else {
                shapeRotation = 0;
            }
        } else {
            shape = "L";

            if (neighbors.n && neighbors.e) {
                shapeRotation = 0;
            } else if (neighbors.e && neighbors.s) {
                shapeRotation = 1;
            } else if (neighbors.s && neighbors.w) {
                shapeRotation = 2;
            } else {
                shapeRotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        shape = "O"
    }

    return (
        <>
            <animated.group
                position={stack.position.clone().setY(currentStackHeight + 1)}
                rotation={[0, shapeRotation * (Math.PI / 2), 0]}>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Raised_Bed_${shape}_2`].geometry}
                    material={materials['Material.Planks']}
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Raised_Bed_${shape}_1`].geometry}
                    material={materials['Material.Dirt']}
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
            </animated.group>
            <group position={stack.position.clone().setY(currentStackHeight + 1)}>
                <RiasedBedFields blockId={block.id} />
            </group>
        </>
    );
}
