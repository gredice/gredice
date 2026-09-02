import { Html } from '@react-three/drei';
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
import { useOperations } from '../hooks/useOperations';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import type { GLTFResult } from '../models/GameAssets';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getRaisedBedFootprintSegments } from '../utils/raisedBedBlocks';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useWaterBlockMaterial } from './BlockWater';
import { getCactusVariantConfig } from './Cactus';
import {
    chunkMeshInstances,
    type MeshInstanceChunk,
} from './chunkedMeshGeometry';
import { dryGroundBaseColor } from './dryGroundPalette';
import {
    type EntityBlockInstance,
    EntityInstancesBlock,
    type EntityInstancesBlockBaseProps,
    EntityInstancesGeometry,
    useEntityBlockInstances,
} from './EntityInstancesBlock';
import {
    hasIndexedEntityBlocks,
    useEntityBlockInstanceIndex,
} from './entityBlockInstanceIndex';
import { fenceExtensionName, fenceVariantNames } from './Fence';
import type { FenceConnectionShape } from './fenceConnections';
import { GardenFlowerModel } from './helpers/GardenFlowerModel';
import {
    type GroundPatchSurface,
    useGroundPatchMaterial,
} from './helpers/groundPatchMaterial';
import { HoverOutline } from './helpers/HoverOutline';
import { resolveEntityNeighbors } from './helpers/useEntityNeighbors';
import { resolveFenceConnectionState } from './helpers/useFenceConnectionState';
import {
    polishedStoneFenceExtensionName,
    polishedStoneFenceVariantNames,
} from './PolishedStoneFence';
import { RaisedBedFields } from './raisedBed/RaisedBedFields';
import { RaisedBedFieldVisualBatches } from './raisedBed/RaisedBedFieldVisualBatches';
import { RaisedBedHarvestBaskets } from './raisedBed/RaisedBedHarvestBasket';
import { RaisedBedInsectProtectionMeshes } from './raisedBed/RaisedBedInsectProtectionMeshes';
import {
    getRaisedBedSoilWetPatches,
    resolveRaisedBedWateringVisualRewards,
} from './raisedBed/raisedBedSoilWetPatches';
import { stoneFenceExtensionNames, stoneFenceVariantNames } from './StoneFence';
import { swampGroundBaseColor } from './swampGroundPalette';
import {
    whiteFenceExtensionName,
    whiteFencePoleName,
    whiteFenceVariantNames,
} from './WhiteFence';
import {
    getWaterBlockColumnSurfaceY,
    getWaterBlockDepthSamples,
    type WaterBlockDepthSamples,
} from './waterBlockDepth';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
} from './waterBlockFoam';
import { createMergedWaterSideGeometry } from './waterBlockGeometry';
import {
    getWaterBlockCenterY,
    getWaterBlockVisualHeight,
} from './waterBlockHeight';
import {
    getWaterBlockStyle,
    type WaterBlockStyle,
    waterBlockNames,
    waterBlockStyles,
} from './waterBlockNames';
import { isWaterBlockTopSurfaceVisible } from './waterBlockSurface';
import {
    chunkWaterTopInstances,
    createWaterTopChunkGeometry,
    type WaterTopChunkInstance,
} from './waterChunkGeometry';
import { smoothWaterTopDepthSamples } from './waterDepthSmoothing';
import {
    resolveWaterShoreDepthSamples,
    resolveWaterShoreDepths,
} from './waterShoreDepth';
import { defaultGameWoodColor } from './woodPalette';

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
type WaterBlockInstance = EntityBlockInstance & {
    depth: number;
    depthSamples: WaterBlockDepthSamples;
    shoreDepthSamples?: WaterBlockDepthSamples;
    style: WaterBlockStyle;
    surfaceY: number;
    waterHeight: number;
};
type StyledWaterTopChunkInstance = WaterTopChunkInstance & {
    style: WaterBlockStyle;
};

const emptyWaterDepthSamples: WaterBlockDepthSamples = [0, 0, 0, 0];

const terrainVariationAssetParts = [
    {
        assetName: 'BlockStone',
        blockName: 'Block_Stone',
        nodeNames: ['Block_Stone_Large', 'Block_Stone_Mid', 'Block_Stone_Dark'],
        weatherSurface: true,
    },
    {
        assetName: 'BlockStoneAngle',
        blockName: 'Block_Stone_Angle',
        nodeNames: [
            'Block_Stone_Angle_Large',
            'Block_Stone_Angle_Mid',
            'Block_Stone_Angle_Dark',
        ],
        weatherSurface: false,
    },
    {
        assetName: 'BlockGravel',
        blockName: 'Block_Gravel',
        nodeNames: [
            'Block_Gravel_Base',
            'Block_Gravel_Pieces_Light',
            'Block_Gravel_Pieces_Dark',
        ],
        weatherSurface: true,
    },
    {
        assetName: 'BlockGravelAngle',
        blockName: 'Block_Gravel_Angle',
        nodeNames: [
            'Block_Gravel_Angle_Base',
            'Block_Gravel_Angle_Pieces_Light',
            'Block_Gravel_Angle_Pieces_Dark',
        ],
        weatherSurface: false,
    },
    {
        assetName: 'BlockStoneStairs',
        blockName: 'Block_Stone_Stairs',
        nodeNames: [
            'Block_Stone_Stairs_Large',
            'Block_Stone_Stairs_Mid',
            'Block_Stone_Stairs_Dark',
        ],
        weatherSurface: false,
    },
    {
        assetName: 'BlockStoneStairsCorner',
        blockName: 'Block_Stone_Stairs_Corner',
        nodeNames: [
            'Block_Stone_Stairs_Corner_Large',
            'Block_Stone_Stairs_Corner_Mid',
            'Block_Stone_Stairs_Corner_Dark',
        ],
        weatherSurface: false,
    },
    {
        assetName: 'BlockStoneStairsCorner',
        blockName: 'Block_Stone_Stairs_Half',
        nodeNames: [
            'Block_Stone_Stairs_Corner_Large',
            'Block_Stone_Stairs_Corner_Mid',
            'Block_Stone_Stairs_Corner_Dark',
        ],
        weatherSurface: false,
    },
    {
        assetName: 'BlockPolishedStone',
        blockName: 'Block_Polished_Stone',
        nodeNames: ['Block_Polished_Stone'],
        weatherSurface: true,
    },
    {
        assetName: 'BlockPolishedStoneAngle',
        blockName: 'Block_Polished_Stone_Angle',
        nodeNames: ['Block_Polished_Stone_Angle'],
        weatherSurface: false,
    },
    {
        assetName: 'BlockPolishedStoneStairs',
        blockName: 'Block_Polished_Stone_Stairs',
        nodeNames: ['Block_Polished_Stone_Stairs'],
        weatherSurface: false,
    },
    {
        assetName: 'BlockPolishedStoneStairsCorner',
        blockName: 'Block_Polished_Stone_Stairs_Corner',
        nodeNames: ['Block_Polished_Stone_Stairs_Corner'],
        weatherSurface: false,
    },
] as const satisfies readonly {
    assetName: GameAssetName;
    blockName: string;
    nodeNames: readonly (keyof GLTFResult['nodes'])[];
    weatherSurface: boolean;
}[];

const gardenBoxTooltipDurationMs = 3600;
const gardenBoxTooltipYOffset = 1.25;

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
    'Block_Dry_Ground',
    'Block_Dry_Ground_Angle',
    'Block_Dry_Ground_Corner',
    'Block_Dry_Ground_Reverse_Corner',
    'Block_Swamp_Ground',
    'Block_Swamp_Ground_Angle',
    'Block_Stone',
    'Block_Stone_Angle',
    'Block_Gravel',
    'Block_Gravel_Angle',
    'Block_Polished_Stone',
    'Block_Polished_Stone_Angle',
    'Block_Polished_Stone_Stairs',
    'Block_Polished_Stone_Stairs_Corner',
    'Block_Stone_Stairs',
    'Block_Stone_Stairs_Corner',
    'Block_Stone_Stairs_Half',
    ...waterBlockNames,
    'Raised_Bed',
    'Shade',
    'Fence',
    'WhiteFence',
    'StoneFence',
    'PolishedStoneFence',
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
    const instanceIndex = useEntityBlockInstanceIndex(props.stacks);
    const hasInstances = hasIndexedEntityBlocks(instanceIndex, props.name);

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
                staticOpaqueCacheGroup="base-terrain"
                geometry={nodes.Block_Ground_1.geometry}
                material={groundMaterial11}
                snow={{
                    maxThickness: 0.22,
                    slopeExponent: 3.2,
                    noiseScale: 1.7,
                }}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <EntityInstancesGeometry
                instanceKey="Block_Ground_2"
                instances={evenVariantInstances}
                staticOpaqueCacheGroup="base-terrain"
                geometry={nodes.Block_Ground_2.geometry}
                material={groundMaterial21}
                snow={{
                    maxThickness: 0.22,
                    slopeExponent: 3.2,
                    noiseScale: 1.7,
                }}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
        </>
    );
}

function TerrainVariationInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const dryGroundMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: dryGroundBaseColor,
                metalness: 0,
                roughness: 1,
            }),
        [],
    );
    const swampGroundMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: swampGroundBaseColor,
                metalness: 0,
                roughness: 1,
            }),
        [],
    );

    return (
        <>
            <AssetBlock
                assetName="BlockSand"
                stacks={stacks}
                name="Block_Dry_Ground"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dryDirt"
                renderRainWetOverlay
                weatherSurface="base-ground"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_1.geometry}
                material={() => dryGroundMaterial}
                snow={snowPresets.sand}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockSandAngle"
                stacks={stacks}
                name="Block_Dry_Ground_Angle"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dryDirt"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Angle_1.geometry}
                material={() => dryGroundMaterial}
                snow={snowPresets.sandAngle}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Dry_Ground_Corner"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dryDirt"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Corner_1.geometry}
                material={() => dryGroundMaterial}
                snow={snowPresets.sandCorner}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Dry_Ground_Reverse_Corner"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dryDirt"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) =>
                    gltf.nodes.Block_Sand_Reverse_Corner_1.geometry
                }
                material={() => dryGroundMaterial}
                snow={snowPresets.sandReverseCorner}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockSand"
                stacks={stacks}
                name="Block_Swamp_Ground"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="swampDirt"
                renderRainWetOverlay
                weatherSurface="base-ground"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_1.geometry}
                material={() => swampGroundMaterial}
                snow={snowPresets.sand}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockSandAngle"
                stacks={stacks}
                name="Block_Swamp_Ground_Angle"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="swampDirt"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Angle_1.geometry}
                material={() => swampGroundMaterial}
                snow={snowPresets.sandAngle}
                snowLift={0.003}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            {terrainVariationAssetParts.flatMap((part) =>
                part.nodeNames.map((nodeName) => (
                    <AssetBlock
                        key={`${part.blockName}:${nodeName}`}
                        assetName={part.assetName}
                        stacks={stacks}
                        name={part.blockName}
                        staticOpaqueCacheGroup="base-terrain"
                        renderRainWetOverlay
                        weatherSurface={
                            part.weatherSurface ? 'base-ground' : undefined
                        }
                        geometry={(gltf) => gltf.nodes[nodeName].geometry}
                        material={(gltf) => gltf.nodes[nodeName].material}
                        snow={snowPresets.stone}
                        snowLift={0.002}
                        renderStableChunksAsMergedGeometry
                        {...commonSnowProps}
                    />
                )),
            )}
        </>
    );
}

function WaterBlockInstances({ stacks }: { stacks: Stack[] | undefined }) {
    const { data: blockData } = useBlockData();
    const baseWaterInstances = useEntityBlockInstances({
        names: waterBlockNames,
        stacks,
    });
    const waterInstances = useMemo(
        () =>
            baseWaterInstances?.map((instance): WaterBlockInstance => {
                const waterHeight = getWaterBlockVisualHeight({
                    block: instance.block,
                    blockData,
                    stack: instance.stack,
                });
                const previewYOffset =
                    instance.position[1] - instance.stackHeight;

                const depthSamples = getWaterBlockDepthSamples({
                    block: instance.block,
                    blockData,
                    stack: instance.stack,
                });

                return {
                    ...instance,
                    depth: Math.max(...depthSamples),
                    depthSamples,
                    style:
                        getWaterBlockStyle(instance.block.name) ?? 'standard',
                    surfaceY: getWaterBlockColumnSurfaceY({
                        block: instance.block,
                        blockData,
                        stack: instance.stack,
                    }),
                    position: [
                        instance.position[0],
                        getWaterBlockCenterY({
                            block: instance.block,
                            blockData,
                            stack: instance.stack,
                        }) + previewYOffset,
                        instance.position[2],
                    ],
                    waterHeight,
                };
            }),
        [baseWaterInstances, blockData],
    );
    const topSurfaceInstances = useMemo(() => {
        const topInstances =
            waterInstances
                ?.filter(isWaterBlockTopSurfaceVisible)
                .map((instance): StyledWaterTopChunkInstance => {
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

                    return {
                        foamCorners,
                        foamEdges,
                        depthSamples: instance.depthSamples,
                        position: instance.position,
                        rotation: 0,
                        shoreDepth: 0,
                        style: instance.style,
                        surfaceY: instance.surfaceY,
                        waterHeight: instance.waterHeight,
                    };
                }) ?? [];
        const shoreDepths = resolveWaterShoreDepths(topInstances);
        const smoothedTopInstances = smoothWaterTopDepthSamples(
            topInstances.map((instance, index) => ({
                ...instance,
                shoreDepth: shoreDepths[index] ?? 0,
            })),
        );
        const shoreDepthSamples =
            resolveWaterShoreDepthSamples(smoothedTopInstances);

        return smoothedTopInstances.map((instance, index) => ({
            ...instance,
            shoreDepthSamples:
                shoreDepthSamples[index] ?? emptyWaterDepthSamples,
        }));
    }, [blockData, stacks, waterInstances]);
    const sideSurfaceInstances = useMemo(() => {
        const samplesByColumn = new Map<string, WaterTopChunkInstance>();

        for (const instance of topSurfaceInstances) {
            samplesByColumn.set(waterColumnSampleKey(instance), instance);
        }

        return (
            waterInstances?.map((instance): WaterBlockInstance => {
                const sampledSurface = samplesByColumn.get(
                    waterColumnSampleKey(instance),
                );

                return sampledSurface
                    ? {
                          ...instance,
                          depthSamples: sampledSurface.depthSamples,
                          shoreDepthSamples: sampledSurface.shoreDepthSamples,
                      }
                    : instance;
            }) ?? []
        );
    }, [topSurfaceInstances, waterInstances]);

    if (!waterInstances?.length) {
        return null;
    }

    return (
        <>
            {waterBlockStyles.map((style) => (
                <WaterBlockStyleInstances
                    key={style}
                    allSideInstances={sideSurfaceInstances}
                    sideInstances={sideSurfaceInstances}
                    style={style}
                    topInstances={topSurfaceInstances}
                />
            ))}
        </>
    );
}

function WaterBlockStyleInstances({
    allSideInstances,
    sideInstances,
    style,
    topInstances,
}: {
    allSideInstances: WaterBlockInstance[];
    sideInstances: WaterBlockInstance[];
    style: WaterBlockStyle;
    topInstances: StyledWaterTopChunkInstance[];
}) {
    const styledTopInstances = useMemo(
        () => topInstances.filter((instance) => instance.style === style),
        [style, topInstances],
    );
    const styledSideInstances = useMemo(
        () => sideInstances.filter((instance) => instance.style === style),
        [sideInstances, style],
    );

    return (
        <>
            {styledTopInstances.length > 0 ? (
                <WaterBlockTopChunks
                    instances={styledTopInstances}
                    style={style}
                />
            ) : null}
            {styledSideInstances.length > 0 ? (
                <WaterBlockMergedSides
                    allInstances={allSideInstances}
                    instances={styledSideInstances}
                    style={style}
                />
            ) : null}
        </>
    );
}

function waterColumnSampleKey({
    position,
    surfaceY,
}: Pick<WaterTopChunkInstance, 'position' | 'surfaceY'>) {
    return `${position[0]}|${position[2]}|${surfaceY.toFixed(6)}`;
}

const mergedWaterSideFoamEdges = new Vector4(0, 0, 0, 0);
const mergedWaterTopFoamEdges = new Vector4(0, 0, 0, 0);
const mergedWaterTopFoamCorners = new Vector4(0, 0, 0, 0);

function WaterBlockTopChunks({
    instances,
    style,
}: {
    instances: StyledWaterTopChunkInstance[];
    style: WaterBlockStyle;
}) {
    const chunks = useMemo(
        () => chunkWaterTopInstances(instances),
        [instances],
    );
    const material = useWaterBlockMaterial(
        mergedWaterTopFoamEdges,
        false,
        mergedWaterTopFoamCorners,
        {
            style,
            useFoamAttributes: true,
            useWaterDepthAttribute: true,
            useShoreDepthAttribute: true,
            useLocalPositionAttribute: true,
        },
    );

    return chunks.map((chunk) => (
        <WaterBlockTopChunk
            key={`Block_Water_Top:${style}:${chunk.key}`}
            chunk={chunk}
            material={material}
        />
    ));
}

function WaterBlockTopChunk({
    chunk,
    material,
}: {
    chunk: MeshInstanceChunk<StyledWaterTopChunkInstance>;
    material: ReturnType<typeof useWaterBlockMaterial>;
}) {
    const geometry = useMemo(
        () => createWaterTopChunkGeometry(chunk.instances),
        [chunk.instances],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);

    if ((geometry.getIndex()?.count ?? 0) === 0) {
        return null;
    }

    return (
        <mesh
            castShadow={false}
            receiveShadow
            geometry={geometry}
            material={material}
            name={`WaterTopChunk:${chunk.key}:count:${chunk.instances.length}`}
            renderOrder={1}
            raycast={() => null}
        />
    );
}

function WaterBlockMergedSides({
    allInstances,
    instances,
    style,
}: {
    allInstances: WaterBlockInstance[];
    instances: WaterBlockInstance[];
    style: WaterBlockStyle;
}) {
    const material = useWaterBlockMaterial(
        mergedWaterSideFoamEdges,
        false,
        undefined,
        {
            style,
            useWaterDepthAttribute: true,
            useShoreDepthAttribute: true,
        },
    );
    const chunks = useMemo(() => chunkMeshInstances(instances), [instances]);

    return chunks.map((chunk) => (
        <WaterBlockMergedSideChunk
            key={`Block_Water_Sides:${style}:${chunk.key}`}
            allInstances={allInstances}
            chunk={chunk}
            material={material}
        />
    ));
}

function WaterBlockMergedSideChunk({
    allInstances,
    chunk,
    material,
}: {
    allInstances: WaterBlockInstance[];
    chunk: MeshInstanceChunk<WaterBlockInstance>;
    material: ReturnType<typeof useWaterBlockMaterial>;
}) {
    const geometry = useMemo(
        () =>
            createMergedWaterSideGeometry(chunk.instances, {
                neighborInstances: allInstances,
            }),
        [allInstances, chunk.instances],
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
            name={`WaterSideChunk:${chunk.key}:count:${chunk.instances.length}`}
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
    anchorPosition: EntityBlockInstance['position'];
    blockIndex: number;
    blockOffset: number;
    shape: RaisedBedShapeKey;
};

export function resolveRaisedBedInstances(
    instance: EntityBlockInstance,
): RaisedBedResolvedInstance[] {
    return getRaisedBedFootprintSegments(instance.block.rotation).map(
        (segment) => ({
            ...instance,
            anchorPosition: instance.position,
            blockIndex: segment.blockIndex,
            blockOffset: segment.blockOffset,
            id: `${instance.id}:segment:${segment.blockIndex.toString()}`,
            position: [
                instance.position[0] + segment.offset.x,
                instance.position[1],
                instance.position[2] + segment.offset.z,
            ],
            rotation: segment.shapeRotation,
            shape: 'Raised_Bed_U',
        }),
    );
}

function RaisedBedInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const { data: currentGarden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const currentTime = useSnapshotTime();
    const raisedBedInstances = useEntityBlockInstances({
        name: 'Raised_Bed',
        stacks,
        yOffset: 1,
    });
    const instances = useMemo(
        () => raisedBedInstances?.flatMap(resolveRaisedBedInstances),
        [raisedBedInstances],
    );
    const raisedBedFieldVisualBlocks = useMemo(
        () =>
            instances?.map((instance) => ({
                blockId: instance.block.id,
                blockIndex: instance.blockIndex,
                chunkPosition: instance.anchorPosition,
                position: instance.position,
            })) ?? [],
        [instances],
    );
    const raisedBedContextByBlockId = useMemo(() => {
        const context = new Map<
            string,
            {
                raisedBed: NonNullable<
                    typeof currentGarden
                >['raisedBeds'][number];
            }
        >();

        if (!currentGarden) {
            return context;
        }

        for (const raisedBed of currentGarden.raisedBeds) {
            if (raisedBed.blockId) {
                context.set(raisedBed.blockId, { raisedBed });
            }
        }

        return context;
    }, [currentGarden]);
    const raisedBedInsectProtectionMeshBlocks = useMemo(
        () =>
            instances?.flatMap((instance) => {
                const context = raisedBedContextByBlockId.get(
                    instance.block.id,
                );
                if (!context) {
                    return [];
                }

                return [
                    {
                        blockIndex: instance.blockIndex,
                        blockOffset: instance.blockOffset,
                        position: instance.position,
                        raisedBedId: context.raisedBed.id,
                    },
                ];
            }) ?? [],
        [instances, raisedBedContextByBlockId],
    );
    const wateringRewardsByRaisedBedId = useMemo(() => {
        const rewards = new Map<
            number,
            ReturnType<typeof resolveRaisedBedWateringVisualRewards>
        >();

        if (!currentGarden) {
            return rewards;
        }

        for (const raisedBed of currentGarden.raisedBeds) {
            rewards.set(
                raisedBed.id,
                resolveRaisedBedWateringVisualRewards({
                    operations,
                    raisedBed,
                }),
            );
        }

        return rewards;
    }, [currentGarden, operations]);
    const soilWetPatches = useMemo(
        () =>
            instances?.flatMap((instance) => {
                const context = raisedBedContextByBlockId.get(
                    instance.block.id,
                );

                if (!context) {
                    return [];
                }

                return getRaisedBedSoilWetPatches({
                    blockIndex: instance.blockIndex,
                    blockOffset: instance.blockOffset,
                    blockPosition: instance.position,
                    currentTime,
                    raisedBed: context.raisedBed,
                    visualRewards:
                        wateringRewardsByRaisedBedId.get(
                            context.raisedBed.id,
                        ) ?? [],
                });
            }) ?? [],
        [
            currentTime,
            instances,
            raisedBedContextByBlockId,
            wateringRewardsByRaisedBedId,
        ],
    );
    const raisedBedSoilMaterial = useGroundPatchMaterial(
        materials[dirtMaterialName],
        'raisedBedSoil',
        { wetPatches: soilWetPatches },
    );

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
                        ? materials[planksMaterialName]
                        : raisedBedSoilMaterial;
                const shape2Material =
                    shape2 === 'Raised_Bed_O_2'
                        ? raisedBedSoilMaterial
                        : materials[planksMaterialName];

                return (
                    <Suspense key={shape} fallback={null}>
                        <EntityInstancesGeometry
                            instanceKey={shape1}
                            instances={shapeInstances}
                            geometry={nodes[shape1].geometry}
                            material={shape1Material}
                            staticOpaqueCacheGroup={
                                shape1 === 'Raised_Bed_O_1'
                                    ? 'static-props'
                                    : undefined
                            }
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
                            material={shape2Material}
                            staticOpaqueCacheGroup={
                                shape2 === 'Raised_Bed_O_2'
                                    ? undefined
                                    : 'static-props'
                            }
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
            {instances.map((instance) => (
                <group
                    key={`Raised_Bed-fields-${instance.id}`}
                    position={instance.position}
                >
                    <RaisedBedFields
                        blockId={instance.block.id}
                        blockIndex={instance.blockIndex}
                        blockOffset={instance.blockOffset}
                        generatedPlantsHandledExternally
                    />
                </group>
            ))}
            <RaisedBedFieldVisualBatches blocks={raisedBedFieldVisualBlocks} />
            <RaisedBedInsectProtectionMeshes
                blocks={raisedBedInsectProtectionMeshBlocks}
            />
            <RaisedBedHarvestBaskets />
            <RaisedBedHoverOutlines instances={instances} nodes={nodes} />
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
}: {
    instances: RaisedBedResolvedInstance[];
    nodes: GLTFResult['nodes'];
}) {
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );

    if (hasActiveDragPreview || hoveredBlock?.name !== 'Raised_Bed') {
        return null;
    }

    return instances.map((instance) => {
        if (instance.block.id !== hoveredBlock.id) {
            return null;
        }

        const [shape1, shape2] = raisedBedShapeParts[instance.shape];

        return (
            <HoverOutline
                key={`Raised_Bed-hover-${instance.id}`}
                hovered
                maskContentKey={instance.id}
            >
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

type FenceKey = (typeof fenceVariantNames)[keyof typeof fenceVariantNames];
type WhiteFenceKey =
    | (typeof whiteFenceVariantNames)[keyof typeof whiteFenceVariantNames]
    | typeof whiteFencePoleName;
type PolishedStoneFenceKey =
    (typeof polishedStoneFenceVariantNames)[keyof typeof polishedStoneFenceVariantNames];

function resolveConnectedFenceInstance(
    instance: EntityBlockInstance,
    stacks: Stack[] | undefined,
) {
    const state = resolveFenceConnectionState(
        stacks,
        instance.stack,
        instance.block,
        instance.rotation,
    );

    return {
        extensionInstances: state.extensionRotations.map(
            (extensionRotation) => ({
                ...mapInstanceRotation(instance, extensionRotation),
                id: `${instance.id}:fence-extension:${extensionRotation}`,
            }),
        ),
        hasAdjacentFence: state.hasAdjacentFence,
        instance: mapInstanceRotation(instance, state.connection.rotation),
        shape: state.connection.shape,
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
        resolveConnectedFenceInstance(instance, stacks),
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
                        .filter(({ shape }) => fenceVariantNames[shape] === key)
                        .map(({ instance }) => instance)}
                    geometry={nodes[key].geometry}
                    material={materials[planksMaterialName]}
                    staticOpaqueCacheGroup="static-props"
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.09,
                        slopeExponent: 2.9,
                        noiseScale: 3.3,
                    }}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesGeometry
                instanceKey={fenceExtensionName}
                instances={resolved.flatMap(
                    ({ extensionInstances }) => extensionInstances,
                )}
                geometry={nodes[fenceExtensionName].geometry}
                material={materials[planksMaterialName]}
                staticOpaqueCacheGroup="static-props"
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.09,
                    slopeExponent: 2.9,
                    noiseScale: 3.3,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

const fenceKeys = [
    fenceVariantNames.Solo,
    fenceVariantNames.Single,
    fenceVariantNames.Middle,
    fenceVariantNames.Corner,
    fenceVariantNames.T,
    fenceVariantNames.Cross,
] satisfies FenceKey[];

function LoadedWhiteFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('WhiteFence');
    const instances = useEntityBlockInstances({
        name: 'WhiteFence',
        stacks,
        yOffset: 1,
    });
    const resolved = instances?.map((instance) =>
        resolveConnectedFenceInstance(instance, stacks),
    );

    if (!resolved?.length) {
        return null;
    }

    return (
        <>
            {whiteFenceKeys.map((key) => (
                <EntityInstancesGeometry
                    key={key}
                    instanceKey={key}
                    instances={resolved
                        .filter(({ hasAdjacentFence, shape }) => {
                            const variant =
                                shape === 'Solo' && hasAdjacentFence
                                    ? whiteFencePoleName
                                    : whiteFenceVariantNames[shape];
                            return variant === key;
                        })
                        .map(({ instance }) => instance)}
                    geometry={nodes[key].geometry}
                    material={materials['Material.WhitePaint']}
                    staticOpaqueCacheGroup="static-props"
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.035,
                        slopeExponent: 2.9,
                        noiseScale: 3.3,
                    }}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesGeometry
                instanceKey={whiteFenceExtensionName}
                instances={resolved.flatMap(
                    ({ extensionInstances }) => extensionInstances,
                )}
                geometry={nodes[whiteFenceExtensionName].geometry}
                material={materials['Material.WhitePaint']}
                staticOpaqueCacheGroup="static-props"
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.035,
                    slopeExponent: 2.9,
                    noiseScale: 3.3,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

function WhiteFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const instanceIndex = useEntityBlockInstanceIndex(stacks);
    const hasInstances = hasIndexedEntityBlocks(instanceIndex, 'WhiteFence');

    if (!hasInstances) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedWhiteFenceInstances stacks={stacks} {...commonSnowProps} />
        </Suspense>
    );
}

const whiteFenceKeys = [
    whiteFenceVariantNames.Solo,
    whiteFenceVariantNames.Single,
    whiteFenceVariantNames.Middle,
    whiteFenceVariantNames.Corner,
    whiteFenceVariantNames.T,
    whiteFenceVariantNames.Cross,
    whiteFencePoleName,
] satisfies WhiteFenceKey[];

function LoadedStoneFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes } = useGameGLTF('StoneFence');
    const instances = useEntityBlockInstances({
        name: 'StoneFence',
        stacks,
        yOffset: 1,
    });
    const resolved = instances?.map((instance) =>
        resolveConnectedFenceInstance(instance, stacks),
    );

    if (!resolved?.length) {
        return null;
    }

    return (
        <>
            {stoneFenceShapes.flatMap((shape) =>
                stoneFenceVariantNames[shape].map((key) => (
                    <EntityInstancesGeometry
                        key={key}
                        instanceKey={key}
                        instances={resolved
                            .filter((item) => item.shape === shape)
                            .map(({ instance }) => instance)}
                        geometry={nodes[key].geometry}
                        material={nodes[key].material}
                        staticOpaqueCacheGroup="static-props"
                        renderRainWetOverlay
                        snow={{
                            maxThickness: 0.05,
                            slopeExponent: 2.9,
                            noiseScale: 3.3,
                        }}
                        {...commonSnowProps}
                    />
                )),
            )}
            {stoneFenceExtensionNames.map((key) => (
                <EntityInstancesGeometry
                    key={key}
                    instanceKey={key}
                    instances={resolved.flatMap(
                        ({ extensionInstances }) => extensionInstances,
                    )}
                    geometry={nodes[key].geometry}
                    material={nodes[key].material}
                    staticOpaqueCacheGroup="static-props"
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.05,
                        slopeExponent: 2.9,
                        noiseScale: 3.3,
                    }}
                    {...commonSnowProps}
                />
            ))}
        </>
    );
}

function StoneFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const instanceIndex = useEntityBlockInstanceIndex(stacks);
    const hasInstances = hasIndexedEntityBlocks(instanceIndex, 'StoneFence');

    if (!hasInstances) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedStoneFenceInstances stacks={stacks} {...commonSnowProps} />
        </Suspense>
    );
}

const stoneFenceShapes = [
    'Solo',
    'Single',
    'Middle',
    'Corner',
    'T',
    'Cross',
] satisfies FenceConnectionShape[];

function LoadedPolishedStoneFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const { nodes, materials } = useGameGLTF('PolishedStoneFence');
    const instances = useEntityBlockInstances({
        name: 'PolishedStoneFence',
        stacks,
        yOffset: 1,
    });
    const resolved = instances?.map((instance) =>
        resolveConnectedFenceInstance(instance, stacks),
    );

    if (!resolved?.length) {
        return null;
    }

    return (
        <>
            {polishedStoneFenceKeys.map((key) => (
                <EntityInstancesGeometry
                    key={key}
                    instanceKey={key}
                    instances={resolved
                        .filter(
                            ({ shape }) =>
                                polishedStoneFenceVariantNames[shape] === key,
                        )
                        .map(({ instance }) => instance)}
                    geometry={nodes[key].geometry}
                    material={materials['Material.PolishedStoneFence.Surface']}
                    staticOpaqueCacheGroup="static-props"
                    renderRainWetOverlay
                    snow={{
                        maxThickness: 0.035,
                        slopeExponent: 2.9,
                        noiseScale: 3.3,
                    }}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesGeometry
                instanceKey={polishedStoneFenceExtensionName}
                instances={resolved.flatMap(
                    ({ extensionInstances }) => extensionInstances,
                )}
                geometry={nodes[polishedStoneFenceExtensionName].geometry}
                material={materials['Material.PolishedStoneFence.Surface']}
                staticOpaqueCacheGroup="static-props"
                renderRainWetOverlay
                snow={{
                    maxThickness: 0.035,
                    slopeExponent: 2.9,
                    noiseScale: 3.3,
                }}
                {...commonSnowProps}
            />
        </>
    );
}

function PolishedStoneFenceInstances({
    stacks,
    ...commonSnowProps
}: { stacks: Stack[] | undefined } & CommonWeatherProps) {
    const instanceIndex = useEntityBlockInstanceIndex(stacks);
    const hasInstances = hasIndexedEntityBlocks(
        instanceIndex,
        'PolishedStoneFence',
    );

    if (!hasInstances) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedPolishedStoneFenceInstances
                stacks={stacks}
                {...commonSnowProps}
            />
        </Suspense>
    );
}

const polishedStoneFenceKeys = [
    polishedStoneFenceVariantNames.Solo,
    polishedStoneFenceVariantNames.Single,
    polishedStoneFenceVariantNames.Middle,
    polishedStoneFenceVariantNames.Corner,
    polishedStoneFenceVariantNames.T,
    polishedStoneFenceVariantNames.Cross,
] satisfies PolishedStoneFenceKey[];

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
                staticOpaqueCacheGroup="static-props"
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
            <GardenBoxTooltip instances={bodyInstances} />
        </>
    );
}

function GardenBoxTooltip({ instances }: { instances: EntityBlockInstance[] }) {
    const tooltip = useGameState((state) => state.gardenBoxTooltip);
    const clearGardenBoxTooltip = useGameState(
        (state) => state.clearGardenBoxTooltip,
    );
    const tooltipSequence = tooltip?.sequence;

    useEffect(() => {
        if (tooltipSequence === undefined) {
            return;
        }

        const timeout = window.setTimeout(
            clearGardenBoxTooltip,
            gardenBoxTooltipDurationMs,
        );

        return () => window.clearTimeout(timeout);
    }, [clearGardenBoxTooltip, tooltipSequence]);

    if (!tooltip) {
        return null;
    }

    const tooltipInstance = instances.find(
        (instance) => instance.block.id === tooltip.blockId,
    );

    if (!tooltipInstance) {
        return null;
    }

    const position: [number, number, number] = [
        tooltipInstance.position[0],
        tooltipInstance.position[1] + gardenBoxTooltipYOffset,
        tooltipInstance.position[2],
    ];

    return (
        <Html
            center
            position={position}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[60, 0]}
        >
            <div
                aria-live="polite"
                className="relative max-w-[min(14rem,70vw)] rounded-md border border-red-200 bg-white/95 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-red-800 shadow-md backdrop-blur-sm dark:border-red-800/80 dark:bg-neutral-950/95 dark:text-red-100"
                role="status"
            >
                {tooltip.message}
                <span className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-red-200 bg-white/95 dark:border-red-800/80 dark:bg-neutral-950/95" />
            </div>
        </Html>
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
    const instanceIndex = useEntityBlockInstanceIndex(stacks);

    return (
        <>
            {potConfigs
                .filter((config) =>
                    hasIndexedEntityBlocks(instanceIndex, config.name),
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
    const cushionMaterial = useMemo(
        () => (
            <meshStandardMaterial
                color="#b80718"
                metalness={0}
                roughness={0.94}
                side={DoubleSide}
            />
        ),
        [],
    );
    const seamMaterial = useMemo(
        () => (
            <meshStandardMaterial
                color="#6b0610"
                metalness={0}
                roughness={0.92}
                side={DoubleSide}
            />
        ),
        [],
    );

    return (
        <>
            <EntityInstancesGeometry
                instanceKey="CatPillow_Cushion"
                instances={instances}
                geometry={nodes.CatPillow_Cushion.geometry}
                materialNode={cushionMaterial}
                staticOpaqueCacheGroup="static-props"
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
                materialNode={seamMaterial}
                staticOpaqueCacheGroup="static-props"
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
                    staticOpaqueCacheGroup="static-props"
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
                    staticOpaqueCacheGroup="static-props"
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
                staticOpaqueCacheGroup="static-props"
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
    const woodMaterial = useMemo(
        () => (
            <meshStandardMaterial
                color={defaultGameWoodColor}
                metalness={0}
                roughness={0.9}
                side={DoubleSide}
            />
        ),
        [],
    );
    const roofMaterial = useMemo(
        () => (
            <meshStandardMaterial
                color="#2f3437"
                metalness={0}
                roughness={0.62}
                side={DoubleSide}
            />
        ),
        [],
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
                    staticOpaqueCacheGroup="static-props"
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
                    staticOpaqueCacheGroup="static-props"
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
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dirt"
                yOffset={1}
                geometry={(gltf) => gltf.nodes.Block_Ground_Angle_1.geometry}
                material={(gltf) => gltf.nodes.Block_Ground_Angle_1.material}
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.2,
                    noiseScale: 1.8,
                }}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Ground_Corner"
                staticOpaqueCacheGroup="base-terrain"
                groundPatch="dirt"
                yOffset={1}
                geometry={(gltf) => gltf.nodes.Block_Ground_Corner_1.geometry}
                material={(gltf) => gltf.nodes.Block_Ground_Corner_1.material}
                snow={{
                    maxThickness: 0.18,
                    slopeExponent: 2.2,
                    noiseScale: 1.8,
                }}
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Ground_Reverse_Corner"
                staticOpaqueCacheGroup="base-terrain"
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
                renderStableChunksAsMergedGeometry
                {...commonSnowProps}
            />
            <AssetBlock
                assetName="Composter"
                stacks={stacks}
                name="Composter"
                staticOpaqueCacheGroup="static-props"
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
                staticOpaqueCacheGroup="static-props"
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
                    maxThickness: 0.08,
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
            <TerrainVariationInstances stacks={stacks} {...commonSnowProps} />
            <SimpleAdditionalInstances stacks={stacks} {...commonSnowProps} />
            <WaterBlockInstances stacks={stacks} />
            <RaisedBedInstances stacks={stacks} {...commonSnowProps} />
            <ShadeInstances stacks={stacks} {...commonSnowProps} />
            <FenceInstances stacks={stacks} {...commonSnowProps} />
            <WhiteFenceInstances stacks={stacks} {...commonSnowProps} />
            <StoneFenceInstances stacks={stacks} {...commonSnowProps} />
            <PolishedStoneFenceInstances stacks={stacks} {...commonSnowProps} />
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
