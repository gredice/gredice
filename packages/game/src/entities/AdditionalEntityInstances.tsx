import { type ReactNode, Suspense, useEffect, useMemo } from 'react';
import {
    Color,
    DoubleSide,
    type Material,
    MeshStandardMaterial,
    Vector4,
} from 'three';
import type { BufferGeometry } from 'three/src/Three.Core.js';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import type { GameAssetName } from '../data/models';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { GLTFResult } from '../models/GameAssets';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getConnectedRaisedBedBlockIds } from '../utils/raisedBedBlocks';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useWaterBlockMaterial } from './BlockWater';
import { getCactusVariantConfig } from './Cactus';
import {
    type EntityBlockInstance,
    EntityInstancesBlock,
    type EntityInstancesBlockBaseProps,
    EntityInstancesGeometry,
    useEntityBlockInstances,
} from './EntityInstancesBlock';
import { GardenFlowerModel } from './helpers/GardenFlowerModel';
import {
    type GroundPatchSurface,
    useGroundPatchMaterial,
} from './helpers/groundPatchMaterial';
import { HoverOutline } from './helpers/HoverOutline';
import { resolveEntityNeighbors } from './helpers/useEntityNeighbors';
import { RaisedBedFields } from './raisedBed/RaisedBedFields';
import { RaisedBedGeneratedPlantFieldBatches } from './raisedBed/RaisedBedGeneratedPlantFieldBatches';
import { RaisedBedHarvestBasketForBlock } from './raisedBed/RaisedBedHarvestBasket';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
} from './waterBlockFoam';
import {
    createMergedWaterSideGeometry,
    createWaterBlockGeometry,
} from './waterBlockGeometry';

type CommonWeatherProps = Pick<
    EntityInstancesBlockBaseProps,
    'renderSnow' | 'snowOverlayMinCoverage'
>;

type ScaleTuple = [number, number, number];
type ScaleInput = number | ScaleTuple | { x: number; y: number; z: number };
type RotationTuple = [number, number, number];
type AssetBlockMaterialProps =
    | {
          groundPatch?: GroundPatchSurface;
          material: (gltf: GLTFResult) => Material | Material[];
          materialNode?: never;
      }
    | {
          groundPatch?: never;
          material?: never;
          materialNode: ReactNode;
      };
type AssetBlockProps = Omit<EntityInstancesBlockBaseProps, 'geometry'> &
    AssetBlockMaterialProps & {
        assetName: GameAssetName;
        geometry: (gltf: GLTFResult) => BufferGeometry;
    };

type LoadedAssetBlockMaterialProps = Omit<
    EntityInstancesBlockBaseProps,
    'geometry'
> & {
    geometry: BufferGeometry;
    gltf: GLTFResult;
    groundPatch?: GroundPatchSurface;
    material: (gltf: GLTFResult) => Material | Material[];
};

const potBlockNames = [
    'PotLowBowl',
    'PotRoundedBowl',
    'PotBulbousNeck',
    'PotTallTapered',
    'PotHourglass',
    'PotStraightShortTub',
    'PotNarrowFootBowl',
    'PotSquatRidged',
    'PotTallSlenderCone',
    'PotWideLippedCup',
] as const;

const cactusBlockNames = [
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
] as const;

const deadTreeBlockNames = ['DeadTreeTall', 'DeadTreeStump'] as const;

const giftBoxConfigs = {
    GiftBox_RedWhite: {
        boxColor: '#ff0000',
        ribbonColor: '#ffffff',
        boxMetalness: 0.5,
        boxRoughness: 1,
    },
    GiftBox_GreenGold: {
        boxColor: '#228B22',
        ribbonColor: '#FFD700',
        boxMetalness: 0.3,
        boxRoughness: 0.7,
    },
    GiftBox_BlueWhite: {
        boxColor: '#1E90FF',
        ribbonColor: '#FFFFFF',
        boxMetalness: 0.3,
        boxRoughness: 0.7,
    },
    GiftBox_PurpleSilver: {
        boxColor: '#8B008B',
        ribbonColor: '#C0C0C0',
        boxMetalness: 0.3,
        boxRoughness: 0.7,
    },
    GiftBox_GoldRed: {
        boxColor: '#FFD700',
        ribbonColor: '#DC143C',
        boxMetalness: 0.7,
        boxRoughness: 0.3,
    },
    GiftBox_WhiteGreen: {
        boxColor: '#FFFFFF',
        ribbonColor: '#006400',
        boxMetalness: 0.3,
        boxRoughness: 0.7,
    },
} satisfies Record<
    string,
    {
        boxColor: string;
        ribbonColor: string;
        boxMetalness: number;
        boxRoughness: number;
    }
>;

export const additionalInstancedBlockNames = [
    'Block_Ground',
    'Block_Ground_Angle',
    'Block_Ground_Corner',
    'Block_Ground_Reverse_Corner',
    'Block_Water',
    'Raised_Bed',
    'Shade',
    'Fence',
    'GardenBox',
    'Stool',
    'Bucket',
    'WateringCan',
    'WaterWell',
    'BirdHouse',
    'CatPillow',
    'Cat_Pillow',
    'Composter',
    'Snowman',
    ...potBlockNames,
    ...cactusBlockNames,
    ...deadTreeBlockNames,
    ...Object.keys(giftBoxConfigs),
];

function hasRenderableBlockInstance({
    name,
    stacks,
}: {
    name: string;
    stacks: Stack[] | undefined;
}) {
    return (
        stacks?.some((stack) =>
            stack.blocks.some((block) => block.name === name),
        ) ?? false
    );
}

function LoadedAssetBlock({ assetName, geometry, ...props }: AssetBlockProps) {
    const gltf = useGameGLTF(assetName);
    const resolvedGeometry = geometry(gltf);

    if (props.material) {
        const { groundPatch, material, ...blockProps } = props;

        return (
            <LoadedAssetBlockMaterial
                {...blockProps}
                geometry={resolvedGeometry}
                gltf={gltf}
                groundPatch={groundPatch}
                material={material}
            />
        );
    }

    return (
        <EntityInstancesBlock
            {...props}
            geometry={resolvedGeometry}
            materialNode={props.materialNode}
        />
    );
}

function LoadedAssetBlockMaterial({
    geometry,
    gltf,
    groundPatch,
    material,
    ...props
}: LoadedAssetBlockMaterialProps) {
    const patchedMaterial = useGroundPatchMaterial(material(gltf), groundPatch);

    return (
        <EntityInstancesBlock
            {...props}
            geometry={geometry}
            material={patchedMaterial}
        />
    );
}

function AssetBlock(props: AssetBlockProps) {
    const hasInstances = hasRenderableBlockInstance({
        name: props.name,
        stacks: props.stacks,
    });

    if (!hasInstances) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedAssetBlock {...props} />
        </Suspense>
    );
}

function toScaleTuple(scale: ScaleInput): ScaleTuple {
    if (typeof scale === 'number') {
        return [scale, scale, scale];
    }

    if (Array.isArray(scale)) {
        return scale;
    }

    return [scale.x, scale.y, scale.z];
}

function multiplyScale(left: ScaleInput, right: ScaleInput) {
    const leftTuple = toScaleTuple(left);
    const rightTuple = toScaleTuple(right);

    return [
        leftTuple[0] * rightTuple[0],
        leftTuple[1] * rightTuple[1],
        leftTuple[2] * rightTuple[2],
    ] satisfies ScaleTuple;
}

function scaledPosition(
    position: { x: number; y: number; z: number },
    scale: ScaleInput,
) {
    const scaleTuple = toScaleTuple(scale);

    return [
        position.x * scaleTuple[0],
        position.y * scaleTuple[1],
        position.z * scaleTuple[2],
    ] satisfies ScaleTuple;
}

function rotationTuple(rotation: { x: number; y: number; z: number }) {
    return [rotation.x, rotation.y, rotation.z] satisfies RotationTuple;
}

function transformNode(
    node: GLTFResult['nodes'][keyof GLTFResult['nodes']],
    groupScale: ScaleInput,
    localScale: ScaleInput = 1,
) {
    return {
        localPosition: scaledPosition(node.position, groupScale),
        localRotation: rotationTuple(node.rotation),
        scale: multiplyScale(groupScale, multiplyScale(node.scale, localScale)),
    };
}

function mapInstanceRotation(
    instance: EntityBlockInstance,
    rotation: number,
): EntityBlockInstance {
    return { ...instance, rotation };
}

const planksMaterialName = 'Material.Planks';
const dirtMaterialName = 'Material.Dirt';
const metalMaterialName = 'Material.Metal';

function InstancedWaterSurfaceMaterial() {
    const waterColor = useGameState((state) => state.waterColors.shallow);

    return (
        <meshStandardMaterial
            color={waterColor}
            depthWrite={false}
            metalness={0.35}
            opacity={0.58}
            roughness={0.24}
            side={DoubleSide}
            transparent
        />
    );
}

function BlockGroundInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('BlockGround');
    const groundMaterial11 = useGroundPatchMaterial(
        nodes.Block_Ground_1.material,
        'dirt',
    );
    const groundMaterial21 = useGroundPatchMaterial(
        nodes.Block_Ground_2.material,
        'dirt',
    );
    const groundInstances = useEntityBlockInstances({
        name: 'Block_Ground',
        stacks,
        yOffset: 1,
    });
    const oddVariantInstances = groundInstances?.filter(
        (instance) => (instance.block.variant ?? 1) % 2 !== 0,
    );
    const evenVariantInstances = groundInstances?.filter(
        (instance) => (instance.block.variant ?? 1) % 2 === 0,
    );

    return (
        <>
            <EntityInstancesGeometry
                instanceKey="Block_Ground_1"
                instances={oddVariantInstances}
                geometry={nodes.Block_Ground_1.geometry}
                material={groundMaterial11}
                snow={{
                    maxThickness: 0.22,
                    slopeExponent: 3.2,
                    noiseScale: 1.7,
                }}
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey="Block_Ground_2"
                instances={evenVariantInstances}
                geometry={nodes.Block_Ground_2.geometry}
                material={groundMaterial21}
                snow={{
                    maxThickness: 0.22,
                    slopeExponent: 3.2,
                    noiseScale: 1.7,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

function WaterBlockInstances({ stacks }: { stacks: Stack[] | undefined }) {
    const { data: blockData } = useBlockData();
    const waterInstances = useEntityBlockInstances({
        name: 'Block_Water',
        stacks,
        yOffset: 0.14,
    });

    if (!waterInstances?.length) {
        return null;
    }

    const topSurfaceInstances = waterInstances.filter(isWaterTopSurfaceVisible);
    const groupedInstances = resolveWaterBlockInstanceGroups({
        blockData,
        instances: topSurfaceInstances,
        stacks,
    });

    return (
        <>
            {groupedInstances.map((mask) => (
                <WaterBlockMaskInstances
                    key={`Block_Water-${mask.key}`}
                    foamCorners={mask.foamCorners}
                    foamEdges={mask.foamEdges}
                    instances={mask.instances}
                    maskKey={mask.key}
                />
            ))}
            <WaterBlockMergedSides instances={waterInstances} />
        </>
    );
}

function isWaterTopSurfaceVisible(instance: EntityBlockInstance) {
    return instance.blockIndex === instance.stack.blocks.length - 1;
}

function foamEdgeKey(foamEdges: Vector4) {
    return `${foamEdges.x}${foamEdges.y}${foamEdges.z}${foamEdges.w}`;
}

function waterFoamMaskKey({
    foamCorners,
    foamEdges,
}: {
    foamCorners: Vector4;
    foamEdges: Vector4;
}) {
    return `${foamEdgeKey(foamEdges)}-${foamEdgeKey(foamCorners)}`;
}

function resolveWaterBlockInstanceGroups({
    blockData,
    instances,
    stacks,
}: {
    blockData: Parameters<typeof resolveWaterFoamEdges>[0]['blockData'];
    instances: EntityBlockInstance[];
    stacks: Stack[] | undefined;
}) {
    const groupedInstances = new Map<
        string,
        {
            foamCorners: Vector4;
            foamEdges: Vector4;
            instances: EntityBlockInstance[];
            key: string;
        }
    >();

    for (const instance of instances) {
        const foamEdges = resolveWaterFoamEdges({
            block: instance.block,
            blockData,
            stack: instance.stack,
            stacks,
        });
        const foamCorners = resolveWaterFoamCorners({
            block: instance.block,
            blockData,
            stack: instance.stack,
            stacks,
        });
        const key = waterFoamMaskKey({ foamCorners, foamEdges });
        const group = groupedInstances.get(key);

        if (group) {
            group.instances.push(instance);
        } else {
            groupedInstances.set(key, {
                foamCorners,
                foamEdges,
                instances: [instance],
                key,
            });
        }
    }

    return [...groupedInstances.values()];
}

function WaterBlockMaskInstances({
    foamCorners,
    foamEdges,
    instances,
    maskKey,
}: {
    foamCorners: Vector4;
    foamEdges: Vector4;
    instances: EntityBlockInstance[];
    maskKey: string;
}) {
    const material = useWaterBlockMaterial(foamEdges, true, foamCorners);
    const geometry = useMemo(
        () => createWaterBlockGeometry(foamEdges, { includeSides: false }),
        [foamEdges],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);

    if (instances.length === 0) {
        return null;
    }

    return (
        <EntityInstancesGeometry
            instanceKey={`Block_Water-${maskKey}`}
            instances={instances}
            geometry={geometry}
            material={material}
            castShadow={false}
            renderOrder={1}
        />
    );
}

const mergedWaterSideFoamEdges = new Vector4(0, 0, 0, 0);

function WaterBlockMergedSides({
    instances,
}: {
    instances: EntityBlockInstance[];
}) {
    const material = useWaterBlockMaterial(mergedWaterSideFoamEdges, false);
    const geometry = useMemo(
        () => createMergedWaterSideGeometry(instances),
        [instances],
    );
    const hasSideFaces = (geometry.getIndex()?.count ?? 0) > 0;

    useEffect(() => () => geometry.dispose(), [geometry]);

    if (!hasSideFaces) {
        return null;
    }

    return (
        <mesh
            castShadow={false}
            receiveShadow={false}
            geometry={geometry}
            material={material}
            renderOrder={1}
            raycast={() => null}
        />
    );
}

type RaisedBedShapeKey =
    | 'Raised_Bed_O'
    | 'Raised_Bed_L'
    | 'Raised_Bed_I'
    | 'Raised_Bed_U';

type RaisedBedResolvedInstance = EntityBlockInstance & {
    shape: RaisedBedShapeKey;
};

function resolveRaisedBedInstance(
    instance: EntityBlockInstance,
    stacks: Stack[] | undefined,
): RaisedBedResolvedInstance {
    const neighbors = resolveEntityNeighbors(
        stacks,
        instance.stack,
        instance.block,
    );
    let shape: RaisedBedShapeKey = 'Raised_Bed_O';
    let shapeRotation = 0;
    const overlapOffset = { x: 0, z: 0 };

    if (neighbors.total === 1) {
        shape = 'Raised_Bed_U';

        if (neighbors.n) {
            shapeRotation = 0;
            overlapOffset.x = 0.05;
        } else if (neighbors.e) {
            shapeRotation = 1;
            overlapOffset.z = -0.05;
        } else if (neighbors.s) {
            shapeRotation = 2;
            overlapOffset.x = -0.05;
        } else if (neighbors.w) {
            shapeRotation = 3;
            overlapOffset.z = 0.05;
        }
    } else if (neighbors.total === 2) {
        if ((neighbors.n && neighbors.s) || (neighbors.e && neighbors.w)) {
            shape = 'Raised_Bed_I';
            shapeRotation = neighbors.n && neighbors.s ? 1 : 0;
        } else {
            shape = 'Raised_Bed_L';
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
    }

    return {
        ...instance,
        position: [
            instance.position[0] + overlapOffset.x,
            instance.position[1],
            instance.position[2] + overlapOffset.z,
        ],
        rotation: shapeRotation,
        shape,
    };
}

function RaisedBedInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const instances = useEntityBlockInstances({
        name: 'Raised_Bed',
        stacks,
        yOffset: 1,
    })?.map((instance) => resolveRaisedBedInstance(instance, stacks));

    if (!instances?.length) {
        return null;
    }

    return (
        <>
            {raisedBedShapeKeys.map((shape) => {
                const shapeInstances = instances.filter(
                    (instance) => instance.shape === shape,
                );
                const shape1 = `${shape}_1` as keyof GLTFResult['nodes'];
                const shape2 = `${shape}_2` as keyof GLTFResult['nodes'];
                const shape1Material =
                    shape1 === 'Raised_Bed_O_1'
                        ? planksMaterialName
                        : dirtMaterialName;
                const shape2Material =
                    shape2 === 'Raised_Bed_O_2'
                        ? dirtMaterialName
                        : planksMaterialName;

                return (
                    <Suspense key={shape} fallback={null}>
                        <EntityInstancesGeometry
                            instanceKey={shape1}
                            instances={shapeInstances}
                            geometry={nodes[shape1].geometry}
                            material={materials[shape1Material]}
                            renderRainWetOverlay
                            snow={{
                                maxThickness: 0.16,
                                slopeExponent: 2.8,
                                noiseScale: 3,
                                coverageMultiplier: 0.9,
                            }}
                            {...commonSnowProps}
                        />
                        <EntityInstancesGeometry
                            instanceKey={shape2}
                            instances={shapeInstances}
                            geometry={nodes[shape2].geometry}
                            material={materials[shape2Material]}
                            renderRainWetOverlay
                            snow={{
                                maxThickness: 0.16,
                                slopeExponent: 2.8,
                                noiseScale: 3,
                                coverageMultiplier: 0.9,
                            }}
                            {...commonSnowProps}
                        />
                    </Suspense>
                );
            })}
            <RaisedBedGeneratedPlantFieldBatches
                blocks={instances.map((instance) => ({
                    blockId: instance.block.id,
                    position: instance.position,
                }))}
            />
            {instances.map((instance) => (
                <group
                    key={`Raised_Bed-fields-${instance.id}`}
                    position={instance.position}
                >
                    <RaisedBedFields
                        blockId={instance.block.id}
                        generatedPlantsHandledExternally
                    />
                </group>
            ))}
            {instances.map((instance) => (
                <RaisedBedHarvestBasketForBlock
                    key={`Raised_Bed-harvest-basket-${instance.id}`}
                    blockId={instance.block.id}
                />
            ))}
            <RaisedBedHoverOutlines
                instances={instances}
                nodes={nodes}
                stacks={stacks}
            />
        </>
    );
}

const raisedBedShapeKeys = [
    'Raised_Bed_O',
    'Raised_Bed_L',
    'Raised_Bed_I',
    'Raised_Bed_U',
] satisfies RaisedBedShapeKey[];

const raisedBedShapeParts = {
    Raised_Bed_O: ['Raised_Bed_O_1', 'Raised_Bed_O_2'],
    Raised_Bed_L: ['Raised_Bed_L_1', 'Raised_Bed_L_2'],
    Raised_Bed_I: ['Raised_Bed_I_1', 'Raised_Bed_I_2'],
    Raised_Bed_U: ['Raised_Bed_U_1', 'Raised_Bed_U_2'],
} satisfies Record<
    RaisedBedShapeKey,
    [keyof GLTFResult['nodes'], keyof GLTFResult['nodes']]
>;

function RaisedBedHoverOutlines({
    instances,
    nodes,
    stacks,
}: {
    instances: RaisedBedResolvedInstance[];
    nodes: GLTFResult['nodes'];
    stacks: Stack[] | undefined;
}) {
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );

    if (
        hasActiveDragPreview ||
        hoveredBlock?.name !== 'Raised_Bed' ||
        !stacks
    ) {
        return null;
    }

    const hoveredBlockIds = new Set(
        getConnectedRaisedBedBlockIds(stacks, hoveredBlock.id),
    );
    if (hoveredBlockIds.size === 0) {
        return null;
    }

    return instances.map((instance) => {
        if (!hoveredBlockIds.has(instance.block.id)) {
            return null;
        }

        const [shape1, shape2] = raisedBedShapeParts[instance.shape];

        return (
            <HoverOutline key={`Raised_Bed-hover-${instance.id}`} hovered>
                <group
                    position={instance.position}
                    rotation={[0, instance.rotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        geometry={nodes[shape1].geometry}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                    <mesh
                        geometry={nodes[shape2].geometry}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                </group>
            </HoverOutline>
        );
    });
}

type ShadeKey =
    | 'Shade_Solo'
    | 'Shade_Single_Left'
    | 'Shade_Single_Right'
    | 'Shade_N'
    | 'Shade_E'
    | 'Shade_W'
    | 'Shade_S'
    | 'Shade_Middle';

function resolveShadePieces(
    instance: EntityBlockInstance,
    stacks: Stack[] | undefined,
) {
    const neighbors = resolveEntityNeighbors(
        stacks,
        instance.stack,
        instance.block,
    );
    let realizedRotation = instance.rotation % 2;
    const pieces = new Set<ShadeKey>();

    if (neighbors.total === 1) {
        if (neighbors.n) {
            pieces.add('Shade_Single_Left');
            if (realizedRotation % 2 === 0) {
                pieces.add('Shade_S');
            } else {
                pieces.add('Shade_Single_Right');
                pieces.add('Shade_W');
                pieces.add('Shade_Middle');
            }
        } else if (neighbors.e) {
            pieces.add('Shade_Single_Left');
            if (realizedRotation % 2 === 1) {
                pieces.add('Shade_S');
            } else {
                pieces.add('Shade_Single_Right');
                pieces.add('Shade_E');
                pieces.add('Shade_Middle');
            }
        } else if (neighbors.s) {
            pieces.add('Shade_Single_Right');
            if (realizedRotation % 2 === 0) {
                pieces.add('Shade_N');
            } else {
                pieces.add('Shade_Single_Left');
                pieces.add('Shade_E');
                pieces.add('Shade_Middle');
            }
        } else if (neighbors.w) {
            pieces.add('Shade_Single_Right');
            if (realizedRotation % 2 === 1) {
                pieces.add('Shade_N');
            } else {
                pieces.add('Shade_Single_Left');
                pieces.add('Shade_W');
                pieces.add('Shade_Middle');
            }
        }
    } else if (neighbors.total >= 2) {
        let sides = 0;

        if (neighbors.n) {
            pieces.add('Shade_S');
            sides++;
        }
        if (neighbors.w) {
            pieces.add('Shade_W');
            sides++;
        }
        if (neighbors.e) {
            pieces.add('Shade_E');
            sides++;
        }
        if (neighbors.s) {
            pieces.add('Shade_N');
            sides++;
        }

        if (sides >= 3) {
            pieces.add('Shade_Middle');
        } else if (
            sides === 2 &&
            ((pieces.has('Shade_S') && pieces.has('Shade_E')) ||
                (pieces.has('Shade_N') && pieces.has('Shade_W')) ||
                (pieces.has('Shade_N') && pieces.has('Shade_E')) ||
                (pieces.has('Shade_S') && pieces.has('Shade_W')))
        ) {
            pieces.add('Shade_Middle');
        }

        realizedRotation = 0;
    }

    if (pieces.size === 0) {
        pieces.add('Shade_Solo');
    }

    return { pieces, rotation: realizedRotation };
}

function ShadeInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('Shade');
    const instances = useEntityBlockInstances({
        name: 'Shade',
        stacks,
        yOffset: 1,
    });
    const resolved = instances?.map((instance) => ({
        instance,
        shade: resolveShadePieces(instance, stacks),
    }));

    if (!resolved?.length) {
        return null;
    }

    return (
        <>
            {shadeKeys.map((key) => (
                <EntityInstancesGeometry
                    key={key}
                    instanceKey={key}
                    instances={resolved
                        .filter(({ shade }) => shade.pieces.has(key))
                        .map(({ instance, shade }) =>
                            mapInstanceRotation(instance, shade.rotation),
                        )}
                    geometry={nodes[key].geometry}
                    material={materials[planksMaterialName]}
                    snow={{
                        maxThickness: 0.03,
                        slopeExponent: 2.2,
                        noiseScale: 4,
                        coverageMultiplier: 0.35,
                    }}
                    {...commonSnowProps}
                />
            ))}
        </>
    );
}

const shadeKeys = [
    'Shade_Solo',
    'Shade_Single_Left',
    'Shade_Single_Right',
    'Shade_N',
    'Shade_E',
    'Shade_W',
    'Shade_S',
    'Shade_Middle',
] satisfies ShadeKey[];

type FenceKey =
    | 'Fence_Solo'
    | 'Fence_Single'
    | 'Fence_Middle'
    | 'Fence_Corner'
    | 'Fence_T'
    | 'Fence_Cross';

function resolveFenceVariant(
    instance: EntityBlockInstance,
    stacks: Stack[] | undefined,
) {
    const neighbors = resolveEntityNeighbors(
        stacks,
        instance.stack,
        instance.block,
    );
    let variant: FenceKey = 'Fence_Solo';
    let realizedRotation = instance.rotation % 4;

    if (neighbors.total === 1) {
        variant = 'Fence_Single';
        realizedRotation = neighbors.n
            ? 3
            : neighbors.s
              ? 1
              : neighbors.e
                ? 0
                : 2;
    } else if (neighbors.total === 2) {
        if (neighbors.n && neighbors.s) {
            variant = 'Fence_Middle';
            realizedRotation = 1;
        } else if (neighbors.e && neighbors.w) {
            variant = 'Fence_Middle';
            realizedRotation = 0;
        } else {
            variant = 'Fence_Corner';
            if (neighbors.n && neighbors.e) {
                realizedRotation = 0;
            } else if (neighbors.e && neighbors.s) {
                realizedRotation = 1;
            } else if (neighbors.s && neighbors.w) {
                realizedRotation = 2;
            } else if (neighbors.w && neighbors.n) {
                realizedRotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        variant = 'Fence_T';
        if (neighbors.n && neighbors.e && neighbors.s) {
            realizedRotation = 0;
        } else if (neighbors.e && neighbors.s && neighbors.w) {
            realizedRotation = 1;
        } else if (neighbors.s && neighbors.w && neighbors.n) {
            realizedRotation = 2;
        } else if (neighbors.w && neighbors.n && neighbors.e) {
            realizedRotation = 3;
        }
    } else if (neighbors.total === 4) {
        variant = 'Fence_Cross';
    }

    return {
        instance: mapInstanceRotation(instance, realizedRotation),
        variant,
    };
}

function FenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('Fence');
    const instances = useEntityBlockInstances({
        name: 'Fence',
        stacks,
        yOffset: 1,
    });
    const resolved = instances?.map((instance) =>
        resolveFenceVariant(instance, stacks),
    );

    if (!resolved?.length) {
        return null;
    }

    return (
        <>
            {fenceKeys.map((key) => (
                <EntityInstancesGeometry
                    key={key}
                    instanceKey={key}
                    instances={resolved
                        .filter(({ variant }) => variant === key)
                        .map(({ instance }) => instance)}
                    geometry={nodes[key].geometry}
                    material={materials[planksMaterialName]}
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.09,
                        slopeExponent: 2.9,
                        noiseScale: 3.3,
                    }}
                    {...commonSnowProps}
                />
            ))}
        </>
    );
}

const fenceKeys = [
    'Fence_Solo',
    'Fence_Single',
    'Fence_Middle',
    'Fence_Corner',
    'Fence_T',
    'Fence_Cross',
] satisfies FenceKey[];

function GardenBoxInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('GardenBox');
    const instances = useEntityBlockInstances({
        name: 'GardenBox',
        stacks,
    })?.map((instance) => mapInstanceRotation(instance, instance.rotation + 2));
    const hoveredGardenBoxBlockId = useGameState(
        (state) => state.activeDragPreview?.hoveredGardenBoxBlockId ?? null,
    );
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    const bodyInstances = instances ?? [];
    const openLidInstances = bodyInstances.filter(
        (instance) =>
            hoveredGardenBoxBlockId === instance.block.id ||
            openGardenBoxBlockId === instance.block.id,
    );
    const closedLidInstances = bodyInstances.filter(
        (instance) =>
            hoveredGardenBoxBlockId !== instance.block.id &&
            openGardenBoxBlockId !== instance.block.id,
    );

    if (bodyInstances.length === 0) {
        return null;
    }

    return (
        <>
            <EntityInstancesGeometry
                instanceKey="GardenBox_Body_Planks"
                instances={bodyInstances}
                geometry={nodes.GardenBox_Body_Planks.geometry}
                material={materials[planksMaterialName]}
                renderRainWetOverlay
                snow={snowPresets.giftBox}
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey="GardenBox_Lid_HingeOrigin-closed"
                instances={closedLidInstances}
                geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                material={materials[planksMaterialName]}
                localPosition={[0, 0.6, -0.38]}
                castShadow={false}
                renderRainWetOverlay
                snow={snowPresets.giftBox}
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey="GardenBox_Lid_HingeOrigin-open"
                instances={openLidInstances}
                geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                material={materials[planksMaterialName]}
                localPosition={[0, 0.6, -0.38]}
                localRotation={[-Math.PI / 2, 0, 0]}
                castShadow={false}
                renderRainWetOverlay
                snow={snowPresets.giftBox}
                {...commonSnowProps}
            />
            <GardenBoxHoverOutlines
                instances={bodyInstances}
                nodes={nodes}
                openGardenBoxBlockId={openGardenBoxBlockId}
                hoveredGardenBoxBlockId={hoveredGardenBoxBlockId}
            />
        </>
    );
}

function GardenBoxHoverOutlines({
    hoveredGardenBoxBlockId,
    instances,
    nodes,
    openGardenBoxBlockId,
}: {
    hoveredGardenBoxBlockId: string | null;
    instances: EntityBlockInstance[];
    nodes: GLTFResult['nodes'];
    openGardenBoxBlockId: string | null;
}) {
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: garden } = useCurrentGarden();

    if (isLocalSandbox || garden?.isSandbox) {
        return null;
    }

    return instances.map((instance) => {
        const lidOpen =
            hoveredGardenBoxBlockId === instance.block.id ||
            openGardenBoxBlockId === instance.block.id;
        const hovered =
            (!hasActiveDragPreview && hoveredBlock === instance.block) ||
            lidOpen;

        if (!hovered) {
            return null;
        }

        return (
            <HoverOutline
                key={`GardenBox-hover-${instance.id}`}
                hovered
                thickness={7}
                color="#f8fafc"
            >
                <group
                    position={instance.position}
                    rotation={[0, instance.rotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        geometry={nodes.GardenBox_Body_Planks.geometry}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                    <mesh
                        geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                        position={[0, 0.6, -0.38]}
                        rotation={lidOpen ? [-Math.PI / 2, 0, 0] : undefined}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                </group>
            </HoverOutline>
        );
    });
}

function PotInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    return (
        <>
            {potConfigs
                .filter((config) =>
                    hasRenderableBlockInstance({
                        name: config.name,
                        stacks,
                    }),
                )
                .map((config) => (
                    <Suspense key={config.name} fallback={null}>
                        <LoadedPotVariant
                            config={config}
                            stacks={stacks}
                            {...commonSnowProps}
                        />
                    </Suspense>
                ))}
        </>
    );
}

const potConfigs = [
    {
        name: 'PotLowBowl',
        assetName: 'PotLowBowl',
        potNode: 'PotVariant_01_Low_Bowl',
        soilNode: 'PotVariant_Soil_01',
        color: '#C56C45',
    },
    {
        name: 'PotRoundedBowl',
        assetName: 'PotRoundedBowl',
        potNode: 'PotVariant_02_Rounded_Bowl',
        soilNode: 'PotVariant_Soil_02',
        color: '#7D8F68',
    },
    {
        name: 'PotBulbousNeck',
        assetName: 'PotBulbousNeck',
        potNode: 'PotVariant_03_Bulbous_Neck',
        soilNode: 'PotVariant_Soil_03',
        color: '#B85A3E',
    },
    {
        name: 'PotTallTapered',
        assetName: 'PotTallTapered',
        potNode: 'PotVariant_04_Tall_Tapered',
        soilNode: 'PotVariant_Soil_04',
        color: '#D7A354',
    },
    {
        name: 'PotHourglass',
        assetName: 'PotHourglass',
        potNode: 'PotVariant_05_Hourglass',
        soilNode: 'PotVariant_Soil_05',
        color: '#637994',
    },
    {
        name: 'PotStraightShortTub',
        assetName: 'PotStraightShortTub',
        potNode: 'PotVariant_06_Straight_Short_Tub',
        soilNode: 'PotVariant_Soil_06',
        color: '#9B7656',
    },
    {
        name: 'PotNarrowFootBowl',
        assetName: 'PotNarrowFootBowl',
        potNode: 'PotVariant_07_Narrow_Foot_Bowl',
        soilNode: 'PotVariant_Soil_07',
        color: '#D18A5A',
    },
    {
        name: 'PotSquatRidged',
        assetName: 'PotSquatRidged',
        potNode: 'PotVariant_08_Squat_Ridged_Pot',
        soilNode: 'PotVariant_Soil_08',
        color: '#676F58',
    },
    {
        name: 'PotTallSlenderCone',
        assetName: 'PotTallSlenderCone',
        potNode: 'PotVariant_09_Tall_Slender_Cone',
        soilNode: 'PotVariant_Soil_09',
        color: '#C74E3A',
    },
    {
        name: 'PotWideLippedCup',
        assetName: 'PotWideLippedCup',
        potNode: 'PotVariant_10_Wide_Lipped_Cup',
        soilNode: 'PotVariant_Soil_10',
        color: '#C18B45',
    },
] satisfies {
    name: (typeof potBlockNames)[number];
    assetName: GameAssetName;
    potNode: keyof GLTFResult['nodes'];
    soilNode: keyof GLTFResult['nodes'];
    color: string;
}[];

function LoadedPotVariant({
    config,
    stacks,
    ...commonSnowProps
}: {
    config: (typeof potConfigs)[number];
    stacks: Stack[] | undefined;
} & CommonWeatherProps) {
    const { nodes } = useGameGLTF(config.assetName);

    return (
        <>
            <EntityInstancesBlock
                stacks={stacks}
                name={config.name}
                geometry={nodes[config.potNode].geometry}
                materialNode={
                    <meshStandardMaterial
                        color={config.color}
                        roughness={0.78}
                        metalness={0.02}
                    />
                }
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.035,
                    slopeExponent: 3.1,
                    noiseScale: 4,
                    coverageMultiplier: 0.45,
                }}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name={config.name}
                geometry={nodes[config.soilNode].geometry}
                materialNode={
                    <meshStandardMaterial
                        color="#3F2A1C"
                        roughness={0.95}
                        metalness={0}
                    />
                }
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.025,
                    slopeExponent: 2.2,
                    noiseScale: 3,
                    coverageMultiplier: 0.3,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

function CactusInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    return (
        <>
            {cactusBlockNames.map((name) => (
                <CactusVariantInstances
                    key={name}
                    name={name}
                    stacks={stacks}
                    {...commonSnowProps}
                />
            ))}
        </>
    );
}

function CactusVariantInstances({
    name,
    stacks,
    ...commonSnowProps
}: {
    name: (typeof cactusBlockNames)[number];
    stacks: Stack[] | undefined;
} & CommonWeatherProps) {
    const config = getCactusVariantConfig(name);
    const instances = useEntityBlockInstances({
        name,
        stacks,
        yOffset: -(config?.groundSink ?? 0),
    });

    if (!config || !instances?.length) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedCactusVariant
                config={config}
                instances={instances}
                name={name}
                {...commonSnowProps}
            />
        </Suspense>
    );
}

function LoadedCactusVariant({
    config,
    instances,
    name,
    ...commonSnowProps
}: {
    config: NonNullable<ReturnType<typeof getCactusVariantConfig>>;
    instances: EntityBlockInstance[];
    name: string;
} & CommonWeatherProps) {
    const { nodes } = useGameGLTF(config.assetName);
    const scaledInstances = instances.map((instance) => ({
        ...instance,
        position: instance.position,
    }));

    return (
        <>
            <EntityInstancesGeometry
                instanceKey={`${name}-body`}
                instances={scaledInstances}
                geometry={nodes[config.bodyNode].geometry}
                scale={config.scale}
                materialNode={
                    <meshStandardMaterial
                        color="#4a6411"
                        roughness={0.82}
                        metalness={0}
                    />
                }
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.04,
                    slopeExponent: 1.9,
                    noiseScale: 4.5,
                    coverageMultiplier: 0.55,
                }}
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey={`${name}-spines`}
                instances={scaledInstances}
                geometry={nodes[config.spineNode].geometry}
                scale={config.scale}
                materialNode={
                    <meshStandardMaterial
                        color="#8a5a2b"
                        roughness={0.78}
                        metalness={0}
                    />
                }
                {...commonSnowProps}
            />
            {instances.map((instance) => (
                <group
                    key={`${name}-flowers-${instance.id}`}
                    position={instance.position}
                    rotation={[0, instance.rotation * (Math.PI / 2), 0]}
                    scale={config.scale}
                >
                    {config.flowers.map((flower) => (
                        <GardenFlowerModel
                            key={`${config.assetName}-flower-${flower.id}`}
                            bloomOnly
                            petalColor={flower.color}
                            position={flower.position}
                            rotation={flower.rotation}
                            scale={flower.scale}
                        />
                    ))}
                </group>
            ))}
        </>
    );
}

const deadTreeConfigs = {
    DeadTreeTall: {
        assetName: 'DeadTreeTall',
        nodes: [
            'DeadTreeTall_Trunk',
            'DeadTreeTall_LeftBranch',
            'DeadTreeTall_LeftSubBranch',
            'DeadTreeTall_LeftTip',
            'DeadTreeTall_RightBranch',
            'DeadTreeTall_RightSubBranch',
            'DeadTreeTall_RightTip',
        ],
        scale: 0.92,
        groundSink: 0,
    },
    DeadTreeStump: {
        assetName: 'DeadTreeStump',
        nodes: [
            'DeadTreeStump_Trunk',
            'DeadTreeStump_BrokenTop',
            'DeadTreeStump_BrokenTop001',
            'DeadTreeStump_SideStub',
        ],
        scale: 0.95,
        groundSink: 0,
    },
} satisfies Record<
    (typeof deadTreeBlockNames)[number],
    {
        assetName: GameAssetName;
        nodes: (keyof GLTFResult['nodes'])[];
        scale: number;
        groundSink: number;
    }
>;

function DeadTreeInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    return (
        <>
            {deadTreeBlockNames.map((name) => (
                <Suspense key={name} fallback={null}>
                    <LoadedDeadTreeVariant
                        name={name}
                        stacks={stacks}
                        {...commonSnowProps}
                    />
                </Suspense>
            ))}
        </>
    );
}

function LoadedDeadTreeVariant({
    name,
    stacks,
    ...commonSnowProps
}: {
    name: (typeof deadTreeBlockNames)[number];
    stacks: Stack[] | undefined;
} & CommonWeatherProps) {
    const config = deadTreeConfigs[name];
    const { nodes } = useGameGLTF(config.assetName);

    return (
        <>
            {config.nodes.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <EntityInstancesBlock
                        key={`${name}-${nodeName}`}
                        stacks={stacks}
                        name={name}
                        geometry={node.geometry}
                        materialNode={
                            <meshStandardMaterial
                                color="#70401f"
                                roughness={0.86}
                                metalness={0}
                            />
                        }
                        yOffset={-config.groundSink}
                        renderRainWetOverlay
                        snow={{
                            maxThickness: 0.035,
                            slopeExponent: 1.8,
                            noiseScale: 4.2,
                            coverageMultiplier: 0.45,
                        }}
                        {...transformNode(node, config.scale)}
                        {...commonSnowProps}
                    />
                );
            })}
        </>
    );
}

function GiftBoxInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('GiftBox');

    return (
        <>
            {Object.entries(giftBoxConfigs).map(([name, config]) => (
                <Suspense key={name} fallback={null}>
                    <EntityInstancesBlock
                        stacks={stacks}
                        name={name}
                        geometry={nodes.GiftBox_Box.geometry}
                        yOffset={0.25}
                        materialNode={
                            <meshStandardMaterial
                                color={config.boxColor}
                                metalness={config.boxMetalness}
                                roughness={config.boxRoughness}
                            />
                        }
                        snow={snowPresets.giftBox}
                        {...commonSnowProps}
                    />
                    <EntityInstancesBlock
                        stacks={stacks}
                        name={name}
                        geometry={nodes.GiftBox_Strip.geometry}
                        yOffset={0.25}
                        materialNode={
                            <meshStandardMaterial
                                color={config.ribbonColor}
                                metalness={0.5}
                                roughness={0.3}
                            />
                        }
                        snow={snowPresets.giftBox}
                        {...commonSnowProps}
                    />
                    <EntityInstancesBlock
                        stacks={stacks}
                        name={name}
                        geometry={nodes.GiftBox_Bow.geometry}
                        yOffset={0.25}
                        localPosition={[0, 0.25, 0]}
                        localRotation={[0, -Math.PI / 4, 0]}
                        materialNode={
                            <meshStandardMaterial
                                color={config.ribbonColor}
                                metalness={0.5}
                                roughness={0.3}
                            />
                        }
                        snow={snowPresets.giftBox}
                        {...commonSnowProps}
                    />
                    <GiftBoxHoverOutlines
                        name={name}
                        nodes={nodes}
                        stacks={stacks}
                    />
                </Suspense>
            ))}
        </>
    );
}

function GiftBoxHoverOutlines({
    name,
    nodes,
    stacks,
}: {
    name: string;
    nodes: GLTFResult['nodes'];
    stacks: Stack[] | undefined;
}) {
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const instances = useEntityBlockInstances({
        name,
        stacks,
        yOffset: 0.25,
    });

    return instances?.map((instance) => {
        if (hasActiveDragPreview || hoveredBlock !== instance.block) {
            return null;
        }

        return (
            <HoverOutline key={`GiftBox-hover-${instance.id}`} hovered>
                <group
                    position={instance.position}
                    rotation={[0, instance.rotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        geometry={nodes.GiftBox_Box.geometry}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                    <mesh
                        geometry={nodes.GiftBox_Strip.geometry}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                    <mesh
                        geometry={nodes.GiftBox_Bow.geometry}
                        position={[0, 0.25, 0]}
                        rotation={[0, -Math.PI / 4, 0]}
                        raycast={() => null}
                    >
                        <meshBasicMaterial visible={false} />
                    </mesh>
                </group>
            </HoverOutline>
        );
    });
}

function CatPillowInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('CatPillow');
    const cushion = transformNode(nodes.CatPillow_Cushion, 0.62);
    const seam = transformNode(nodes.CatPillow_Seam, 0.62);
    const names = ['CatPillow', 'Cat_Pillow'];
    const instances = useEntityBlockInstances({ names, stacks });

    return (
        <>
            <EntityInstancesGeometry
                instanceKey="CatPillow_Cushion"
                instances={instances}
                geometry={nodes.CatPillow_Cushion.geometry}
                materialNode={
                    <meshStandardMaterial
                        color="#b80718"
                        metalness={0}
                        roughness={0.94}
                        side={DoubleSide}
                    />
                }
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.045,
                    slopeExponent: 2.4,
                    noiseScale: 3.2,
                    coverageMultiplier: 0.5,
                }}
                {...cushion}
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey="CatPillow_Seam"
                instances={instances}
                geometry={nodes.CatPillow_Seam.geometry}
                materialNode={
                    <meshStandardMaterial
                        color="#6b0610"
                        metalness={0}
                        roughness={0.92}
                        side={DoubleSide}
                    />
                }
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.025,
                    slopeExponent: 2.4,
                    noiseScale: 3.2,
                    coverageMultiplier: 0.42,
                }}
                {...seam}
                {...commonSnowProps}
            />
        </>
    );
}

function BucketInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    return (
        <>
            <AssetBlock
                assetName="Bucket"
                stacks={stacks}
                name="Bucket"
                scale={[0.3, 0.25, 0.3]}
                geometry={(gltf) => gltf.nodes.Bucket_1.geometry}
                materialNode={<InstancedWaterSurfaceMaterial />}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Bucket"
                stacks={stacks}
                name="Bucket"
                scale={[0.3, 0.25, 0.3]}
                geometry={(gltf) => gltf.nodes.Bucket_2.geometry}
                material={(gltf) => gltf.materials[metalMaterialName]}
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.06,
                    slopeExponent: 3.5,
                    noiseScale: 3.5,
                    coverageMultiplier: 0.5,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Bucket"
                stacks={stacks}
                name="Bucket"
                scale={[0.3, 0.25, 0.3]}
                geometry={(gltf) => gltf.nodes.Bucket_3.geometry}
                material={(gltf) => gltf.materials[planksMaterialName]}
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.08,
                    slopeExponent: 2.8,
                    noiseScale: 3.2,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Bucket"
                stacks={stacks}
                name="Bucket"
                scale={[1, 1, 1]}
                geometry={(gltf) => gltf.nodes['Bucket_-_Handle'].geometry}
                material={(gltf) => gltf.nodes['Bucket_-_Handle'].material}
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.04,
                    slopeExponent: 4.5,
                    noiseScale: 5,
                    coverageMultiplier: 0.4,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

function WateringCanInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('WateringCan');
    const metalMaterial = (
        <meshStandardMaterial
            color="#555555"
            metalness={0}
            roughness={0.5}
            side={DoubleSide}
        />
    );
    const groupScale = 0.35;

    return (
        <>
            {wateringCanBodyNodeNames.map((nodeName) => (
                <EntityInstancesBlock
                    key={nodeName}
                    stacks={stacks}
                    name="WateringCan"
                    geometry={nodes[nodeName].geometry}
                    materialNode={metalMaterial}
                    renderRainWetOverlay
                    snow={snowPresets.tool}
                    {...transformNode(nodes[nodeName], groupScale)}
                    {...commonSnowProps}
                />
            ))}
            {wateringCanTrimNodeNames.map((nodeName) => (
                <EntityInstancesBlock
                    key={nodeName}
                    stacks={stacks}
                    name="WateringCan"
                    geometry={nodes[nodeName].geometry}
                    materialNode={metalMaterial}
                    renderRainWetOverlay
                    snow={snowPresets.tool}
                    {...transformNode(nodes[nodeName], groupScale)}
                    {...commonSnowProps}
                />
            ))}
            {wateringCanDarkNodeNames.map((nodeName) => (
                <EntityInstancesBlock
                    key={nodeName}
                    stacks={stacks}
                    name="WateringCan"
                    geometry={nodes[nodeName].geometry}
                    materialNode={metalMaterial}
                    renderRainWetOverlay
                    snow={snowPresets.tool}
                    {...transformNode(nodes[nodeName], groupScale)}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesBlock
                stacks={stacks}
                name="WateringCan"
                geometry={nodes.WateringCan_Water.geometry}
                materialNode={<InstancedWaterSurfaceMaterial />}
                {...transformNode(nodes.WateringCan_Water, groupScale)}
                {...commonSnowProps}
            />
        </>
    );
}

const wateringCanBodyNodeNames = [
    'WateringCan_Body',
    'WateringCan_Spout',
] satisfies (keyof GLTFResult['nodes'])[];
const wateringCanTrimNodeNames = [
    'WateringCan_Base_Ring',
    'WateringCan_Fill_Rim',
    'WateringCan_Handle',
    'WateringCan_Rose_Head',
] satisfies (keyof GLTFResult['nodes'])[];
const wateringCanDarkNodeNames = [
    'WateringCan_Rose_Face_Dots',
] satisfies (keyof GLTFResult['nodes'])[];

function WaterWellInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('WaterWell');
    const groupScale = 0.78;

    return (
        <>
            {waterWellStoneNodeNames.map((nodeName) => (
                <EntityInstancesBlock
                    key={nodeName}
                    stacks={stacks}
                    name="WaterWell"
                    geometry={nodes[nodeName].geometry}
                    material={nodes[nodeName].material}
                    renderRainWetOverlay
                    snow={snowPresets.stone}
                    {...transformNode(nodes[nodeName], groupScale)}
                    {...commonSnowProps}
                />
            ))}
            {waterWellWoodNodeNames.map((nodeName) => (
                <EntityInstancesBlock
                    key={nodeName}
                    stacks={stacks}
                    name="WaterWell"
                    geometry={nodes[nodeName].geometry}
                    material={nodes[nodeName].material}
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.08,
                        slopeExponent: 2.8,
                        noiseScale: 3.2,
                        coverageMultiplier: 0.72,
                    }}
                    {...transformNode(nodes[nodeName], groupScale)}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesBlock
                stacks={stacks}
                name="WaterWell"
                geometry={nodes.WaterWell_Rope.geometry}
                material={nodes.WaterWell_Rope.material}
                renderRainWetOverlay
                {...transformNode(nodes.WaterWell_Rope, groupScale)}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="WaterWell"
                geometry={nodes.WaterWell_Water.geometry}
                materialNode={<InstancedWaterSurfaceMaterial />}
                castShadow={false}
                receiveShadow={false}
                {...transformNode(nodes.WaterWell_Water, groupScale)}
                {...commonSnowProps}
            />
        </>
    );
}

const waterWellStoneNodeNames = [
    'WaterWell_Stone_Mid',
    'WaterWell_Stone_Light',
    'WaterWell_Stone_Dark',
] satisfies (keyof GLTFResult['nodes'])[];
const waterWellWoodNodeNames = [
    'WaterWell_Wood_Frame',
] satisfies (keyof GLTFResult['nodes'])[];

function BirdHouseInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('BirdHouse');
    const instances = useEntityBlockInstances({
        name: 'BirdHouse',
        stacks,
    })?.map((instance) => mapInstanceRotation(instance, instance.rotation + 2));
    const woodMaterial = (
        <meshStandardMaterial
            color="#956247"
            metalness={0}
            roughness={0.9}
            side={DoubleSide}
        />
    );
    const roofMaterial = (
        <meshStandardMaterial
            color="#2f3437"
            metalness={0}
            roughness={0.62}
            side={DoubleSide}
        />
    );

    return (
        <>
            {birdHouseWoodNodes.map((nodeName) => (
                <EntityInstancesGeometry
                    key={nodeName}
                    instanceKey={nodeName}
                    instances={instances}
                    geometry={nodes[nodeName].geometry}
                    materialNode={woodMaterial}
                    renderRainWetOverlay
                    snow={{
                        maxThickness:
                            nodeName === 'Birdhouse_Center_Post' ? 0.04 : 0.08,
                        slopeExponent:
                            nodeName === 'Birdhouse_Center_Post' ||
                            nodeName === 'Birdhouse_Perch'
                                ? 4
                                : 2.8,
                        noiseScale: nodeName === 'Birdhouse_Perch' ? 4 : 3,
                        coverageMultiplier:
                            nodeName === 'Birdhouse_Center_Post'
                                ? 0.35
                                : nodeName === 'Birdhouse_Perch'
                                  ? 0.3
                                  : 1,
                    }}
                    {...commonSnowProps}
                />
            ))}
            {birdHouseRoofNodes.map((nodeName) => (
                <EntityInstancesGeometry
                    key={nodeName}
                    instanceKey={nodeName}
                    instances={instances}
                    geometry={nodes[nodeName].geometry}
                    materialNode={roofMaterial}
                    renderRainWetOverlay
                    snow={{
                        maxThickness:
                            nodeName === 'Birdhouse_Roof_Panels' ? 0.12 : 0.08,
                        slopeExponent:
                            nodeName === 'Birdhouse_Roof_Panels' ? 2.4 : 2.8,
                        noiseScale:
                            nodeName === 'Birdhouse_Roof_Panels' ? 2.8 : 3,
                    }}
                    {...commonSnowProps}
                />
            ))}
        </>
    );
}

const birdHouseWoodNodes = [
    'Birdhouse_Angled_Supports',
    'Birdhouse_Center_Post',
    'Birdhouse_Upper_Platform',
    'Birdhouse_Cabin_Walls',
    'Birdhouse_Perch',
] satisfies (keyof GLTFResult['nodes'])[];
const birdHouseRoofNodes = [
    'Birdhouse_Roof_Panels',
    'Birdhouse_Ridge_Cap',
] satisfies (keyof GLTFResult['nodes'])[];

function SimpleAdditionalInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const snowmanMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: new Color('#FFFFFF'),
                roughness: 1,
                metalness: 0,
            }),
        [],
    );

    return (
        <>
            <AssetBlock
                assetName="BlockGroundAngle"
                stacks={stacks}
                name="Block_Ground_Angle"
                groundPatch="dirt"
                yOffset={1}
                geometry={(gltf) => gltf.nodes.Block_Ground_Angle_1.geometry}
                material={(gltf) => gltf.nodes.Block_Ground_Angle_1.material}
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.2,
                    noiseScale: 1.8,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Ground_Corner"
                groundPatch="dirt"
                yOffset={1}
                geometry={(gltf) => gltf.nodes.Block_Ground_Corner_1.geometry}
                material={(gltf) => gltf.nodes.Block_Ground_Corner_1.material}
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.2,
                    noiseScale: 1.8,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Ground_Reverse_Corner"
                groundPatch="dirt"
                yOffset={1}
                geometry={(gltf) =>
                    gltf.nodes.Block_Ground_Reverse_Corner_1.geometry
                }
                material={(gltf) =>
                    gltf.nodes.Block_Ground_Reverse_Corner_1.material
                }
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.2,
                    noiseScale: 1.8,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Composter"
                stacks={stacks}
                name="Composter"
                geometry={(gltf) => gltf.nodes.Composter_1.geometry}
                material={(gltf) => gltf.materials[dirtMaterialName]}
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.6,
                    noiseScale: 2.4,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Composter"
                stacks={stacks}
                name="Composter"
                geometry={(gltf) => gltf.nodes.Composter_2.geometry}
                material={(gltf) => gltf.materials[planksMaterialName]}
                snow={{
                    maxThickness: 0.12,
                    slopeExponent: 2.8,
                    noiseScale: 3,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Stool"
                stacks={stacks}
                name="Stool"
                yOffset={1}
                geometry={(gltf) => gltf.nodes.Stool.geometry}
                material={(gltf) => gltf.materials[planksMaterialName]}
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.11,
                    slopeExponent: 2.9,
                    noiseScale: 3,
                }}
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Snowman"
                stacks={stacks}
                name="Snowman"
                yOffset={1.139}
                scale={0.36}
                geometry={(gltf) => gltf.nodes.Snowman.geometry}
                material={() => snowmanMaterial}
                {...commonSnowProps}
            />
        </>
    );
}

export function AdditionalEntityInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    return (
        <>
            <BlockGroundInstances stacks={stacks} {...commonSnowProps} />
            <SimpleAdditionalInstances stacks={stacks} {...commonSnowProps} />
            <WaterBlockInstances stacks={stacks} />
            <RaisedBedInstances stacks={stacks} {...commonSnowProps} />
            <ShadeInstances stacks={stacks} {...commonSnowProps} />
            <FenceInstances stacks={stacks} {...commonSnowProps} />
            <GardenBoxInstances stacks={stacks} {...commonSnowProps} />
            <BucketInstances stacks={stacks} {...commonSnowProps} />
            <WateringCanInstances stacks={stacks} {...commonSnowProps} />
            <WaterWellInstances stacks={stacks} {...commonSnowProps} />
            <BirdHouseInstances stacks={stacks} {...commonSnowProps} />
            <CatPillowInstances stacks={stacks} {...commonSnowProps} />
            <PotInstances stacks={stacks} {...commonSnowProps} />
            <CactusInstances stacks={stacks} {...commonSnowProps} />
            <DeadTreeInstances stacks={stacks} {...commonSnowProps} />
            <GiftBoxInstances stacks={stacks} {...commonSnowProps} />
        </>
    );
}
