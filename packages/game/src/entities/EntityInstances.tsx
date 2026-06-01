import { Suspense, useEffect, useMemo } from 'react';
import { DoubleSide, type Material, MeshStandardMaterial } from 'three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from '../scene/gameQuality';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    AdditionalEntityInstances,
    additionalInstancedBlockNames,
} from './AdditionalEntityInstances';
import {
    EntityInstancesBlock,
    type EntityInstancesBlockBaseProps,
} from './EntityInstancesBlock';
import { GroundBlockDecorations } from './groundDecorations/GroundBlockDecorations';
import { tulipBouquetStems } from './tulipBouquet';

export const instancedBlockNames = [
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Grass_Corner',
    'Block_Grass_Reverse_Corner',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Sand_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Corner',
    'Block_Snow_Reverse_Corner',
    'Bush',
    'Pine',
    'Tree',
    'ShovelSmall',
    'MulchHey',
    'MulchCoconut',
    'MulchWood',
    'Tulip',
    'BaleHey',
    'Stick',
    'Seed',
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
    'DesertStoneSmall',
    'DesertStoneMedium',
    'DesertStoneLarge',
    ...additionalInstancedBlockNames,
];

const instancedSnowOverlayCounts = {
    BaleHey: 1,
    Block_Grass: 1,
    Block_Grass_Angle: 1,
    Block_Grass_Corner: 1,
    Block_Grass_Reverse_Corner: 1,
    Block_Sand: 1,
    Block_Sand_Angle: 1,
    Block_Sand_Corner: 1,
    Block_Sand_Reverse_Corner: 1,
    Block_Snow: 1,
    Block_Snow_Angle: 1,
    Block_Snow_Corner: 1,
    Block_Snow_Reverse_Corner: 1,
    Bush: 2,
    MulchCoconut: 1,
    MulchHey: 1,
    MulchWood: 1,
    Pine: 1,
    ShovelSmall: 1,
    Stick: 1,
    StoneLarge: 1,
    StoneMedium: 1,
    StoneSmall: 1,
    DesertStoneLarge: 1,
    DesertStoneMedium: 1,
    DesertStoneSmall: 1,
    Block_Ground: 1,
    Block_Ground_Angle: 1,
    Block_Ground_Corner: 1,
    Block_Ground_Reverse_Corner: 1,
    Bucket: 3,
    CatPillow: 2,
    Cat_Pillow: 2,
    Composter: 2,
    DeadTreeStump: 4,
    DeadTreeTall: 7,
    Fence: 1,
    GardenBox: 2,
    GiftBox_BlueWhite: 3,
    GiftBox_GoldRed: 3,
    GiftBox_GreenGold: 3,
    GiftBox_PurpleSilver: 3,
    GiftBox_RedWhite: 3,
    GiftBox_WhiteGreen: 3,
    PotBulbousNeck: 2,
    PotHourglass: 2,
    PotLowBowl: 2,
    PotNarrowFootBowl: 2,
    PotRoundedBowl: 2,
    PotSquatRidged: 2,
    PotStraightShortTub: 2,
    PotTallSlenderCone: 2,
    PotTallTapered: 2,
    PotWideLippedCup: 2,
    Raised_Bed: 2,
    Shade: 1,
    Stool: 1,
    WateringCan: 7,
    WaterWell: 4,
    Tree: 1,
    Tulip: tulipBouquetStems.length * 2,
} satisfies Partial<Record<(typeof instancedBlockNames)[number], number>>;

function getInstancedSnowOverlayCount(blockName: string) {
    const count = Reflect.get(instancedSnowOverlayCounts, blockName);
    return typeof count === 'number' ? count : 0;
}

function countInstancedSnowOverlays(stacks: Stack[] | undefined) {
    if (!stacks) {
        return 0;
    }

    return stacks.reduce(
        (sum, stack) =>
            sum +
            stack.blocks.reduce(
                (blockSum, block) =>
                    blockSum + getInstancedSnowOverlayCount(block.name),
                0,
            ),
        0,
    );
}

type EntityInstancesAssetBlockProps = Omit<
    EntityInstancesBlockBaseProps,
    'geometry'
> & {
    assetName: GameAssetName;
    geometry: (gltf: GLTFResult) => EntityInstancesBlockBaseProps['geometry'];
    material: (gltf: GLTFResult) => Material | Material[];
};

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

function LoadedEntityInstancesAssetBlock({
    assetName,
    geometry,
    material,
    ...props
}: EntityInstancesAssetBlockProps) {
    const gltf = useGameGLTF(assetName);

    return (
        <EntityInstancesBlock
            {...props}
            geometry={geometry(gltf)}
            material={material(gltf)}
        />
    );
}

function EntityInstancesAssetBlock(props: EntityInstancesAssetBlockProps) {
    const hasInstances = hasRenderableBlockInstance({
        name: props.name,
        stacks: props.stacks,
    });

    if (!hasInstances) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedEntityInstancesAssetBlock {...props} />
        </Suspense>
    );
}

export function EntityInstances({
    quality,
    renderGroundDecorations,
    stacks,
    renderDetails = true,
}: {
    quality?: GameQualityProfile;
    renderGroundDecorations?: boolean;
    stacks: Stack[] | undefined;
    renderDetails?: boolean;
}) {
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const snowOverlaysVisible =
        snowCoverage >= qualityProfile.snowOverlayMinCoverage;
    const instancedSnowOverlayCount = snowOverlaysVisible
        ? countInstancedSnowOverlays(stacks)
        : 0;
    const shouldRenderGroundDecorations =
        (renderGroundDecorations ?? renderDetails) &&
        qualityProfile.groundDecorationDensity > 0;
    const snowMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#FFFFFF',
                roughness: 1,
                metalness: 0,
            }),
        [],
    );
    const desertStoneBodyMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#d86a2f',
                roughness: 0.88,
                metalness: 0,
            }),
        [],
    );
    const desertStoneGrooveMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#a04322',
                roughness: 0.94,
                metalness: 0,
                side: DoubleSide,
            }),
        [],
    );

    useEffect(() => {
        const metadata = {
            groundDecorationDensity: qualityProfile.groundDecorationDensity,
            instancedSnowOverlayCount,
            snowOverlayMinCoverage: qualityProfile.snowOverlayMinCoverage,
        };

        updateGameProfileMetadata(
            shouldRenderGroundDecorations
                ? metadata
                : { ...metadata, groundDecorationCount: 0 },
        );
    }, [
        instancedSnowOverlayCount,
        qualityProfile.groundDecorationDensity,
        qualityProfile.snowOverlayMinCoverage,
        shouldRenderGroundDecorations,
    ]);

    const commonSnowProps = {
        renderSnow: snowOverlaysVisible,
        snowOverlayMinCoverage: qualityProfile.snowOverlayMinCoverage,
    };

    return (
        <>
            <EntityInstancesAssetBlock
                assetName="BlockGrass"
                stacks={stacks}
                name="Block_Grass"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Grass_1_2.geometry}
                material={(gltf) => gltf.nodes.Block_Grass_1_2.material}
                snow={snowPresets.grassFlat}
                snowLift={0.01}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockGrassAngle"
                stacks={stacks}
                name="Block_Grass_Angle"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Grass_Angle_1_2.geometry}
                material={(gltf) => gltf.nodes.Block_Grass_Angle_1_2.material}
                snow={snowPresets.grassAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Grass_Corner"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Grass_Corner_1_1.geometry}
                material={(gltf) => gltf.nodes.Block_Grass_Corner_1_1.material}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Grass_Corner"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Grass_Corner_1_2.geometry}
                material={(gltf) => gltf.nodes.Block_Grass_Corner_1_2.material}
                snow={snowPresets.grassCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Grass_Reverse_Corner"
                yOffset={0.2}
                geometry={(gltf) =>
                    gltf.nodes.Block_Grass_Reverse_Corner_1_1.geometry
                }
                material={(gltf) =>
                    gltf.nodes.Block_Grass_Reverse_Corner_1_1.material
                }
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Grass_Reverse_Corner"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) =>
                    gltf.nodes.Block_Grass_Reverse_Corner_1_2.geometry
                }
                material={(gltf) =>
                    gltf.nodes.Block_Grass_Reverse_Corner_1_2.material
                }
                snow={snowPresets.grassReverseCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockSand"
                stacks={stacks}
                name="Block_Sand"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_1.geometry}
                material={(gltf) => gltf.nodes.Block_Sand_1.material}
                snow={snowPresets.sand}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockSandAngle"
                stacks={stacks}
                name="Block_Sand_Angle"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Angle_1.geometry}
                material={(gltf) => gltf.nodes.Block_Sand_Angle_1.material}
                snow={snowPresets.sandAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Sand_Corner"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Corner_1.geometry}
                material={(gltf) => gltf.nodes.Block_Sand_Corner_1.material}
                snow={snowPresets.sandCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Sand_Reverse_Corner"
                renderRainWetOverlay
                yOffset={0.2}
                geometry={(gltf) =>
                    gltf.nodes.Block_Sand_Reverse_Corner_1.geometry
                }
                material={(gltf) =>
                    gltf.nodes.Block_Sand_Reverse_Corner_1.material
                }
                snow={snowPresets.sandReverseCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockSand"
                stacks={stacks}
                name="Block_Snow"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_1.geometry}
                material={() => snowMaterial}
                snow={snowPresets.snow}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockSandAngle"
                stacks={stacks}
                name="Block_Snow_Angle"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Angle_1.geometry}
                material={() => snowMaterial}
                snow={snowPresets.snowAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainCorner"
                stacks={stacks}
                name="Block_Snow_Corner"
                yOffset={0.2}
                geometry={(gltf) => gltf.nodes.Block_Sand_Corner_1.geometry}
                material={() => snowMaterial}
                snow={snowPresets.snowCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BlockTerrainReverseCorner"
                stacks={stacks}
                name="Block_Snow_Reverse_Corner"
                yOffset={0.2}
                geometry={(gltf) =>
                    gltf.nodes.Block_Sand_Reverse_Corner_1.geometry
                }
                material={() => snowMaterial}
                snow={snowPresets.snowReverseCorner}
                snowLift={0.003}
                {...commonSnowProps}
            />
            {shouldRenderGroundDecorations && (
                <GroundBlockDecorations
                    density={qualityProfile.groundDecorationDensity}
                    stacks={stacks}
                />
            )}
            <EntityInstancesAssetBlock
                assetName="Tree"
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={(gltf) => gltf.nodes.Tree_1_1.geometry}
                material={(gltf) => gltf.nodes.Tree_1_1.material}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Tree"
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={(gltf) => gltf.nodes.Tree_1_2.geometry}
                material={(gltf) => gltf.nodes.Tree_1_2.material}
                snow={snowPresets.treeCanopyInner}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Tree"
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={(gltf) => gltf.nodes.Tree_1_3.geometry}
                material={(gltf) => gltf.nodes.Tree_1_3.material}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Pine"
                stacks={stacks}
                name="Pine"
                yOffset={1}
                scale={[0.09, 1, 0.09]}
                geometry={(gltf) => gltf.nodes.Tree_2.geometry}
                material={(gltf) => gltf.nodes.Tree_2.material}
                snow={snowPresets.pine}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="ShovelSmall"
                stacks={stacks}
                name="ShovelSmall"
                yOffset={-0.1}
                geometry={(gltf) => gltf.nodes.Shovel_Small.geometry}
                material={(gltf) => gltf.nodes.Shovel_Small.material}
                snow={snowPresets.tool}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="MulchHey"
                stacks={stacks}
                name="MulchHey"
                scale={[3, 3, 3]}
                geometry={(gltf) => gltf.nodes.Mulch_Hey.geometry}
                material={(gltf) => gltf.nodes.Mulch_Hey.material}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="MulchCoconut"
                stacks={stacks}
                name="MulchCoconut"
                scale={[3, 3, 3]}
                geometry={(gltf) => gltf.nodes.Mulch_Coconut.geometry}
                material={(gltf) => gltf.nodes.Mulch_Coconut.material}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="MulchWood"
                stacks={stacks}
                name="MulchWood"
                scale={[3, 3, 3]}
                geometry={(gltf) => gltf.nodes.Mulch_Wood.geometry}
                material={(gltf) => gltf.nodes.Mulch_Wood.material}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            {tulipBouquetStems.map((stem) => (
                <EntityInstancesAssetBlock
                    key={`Tulip-${stem.key}`}
                    assetName="Tulip"
                    stacks={stacks}
                    name="Tulip"
                    localPosition={stem.position}
                    localRotation={stem.rotation}
                    scale={stem.scale}
                    geometry={(gltf) => gltf.nodes.Tulip.geometry}
                    material={(gltf) => gltf.nodes.Tulip.material}
                    snow={snowPresets.tulip}
                    snowLift={0.002}
                    {...commonSnowProps}
                />
            ))}
            {tulipBouquetStems.map((stem) => (
                <EntityInstancesAssetBlock
                    key={`TulipLeaves-${stem.key}`}
                    assetName="Tulip"
                    stacks={stacks}
                    name="Tulip"
                    localPosition={stem.position}
                    localRotation={stem.rotation}
                    scale={stem.scale}
                    geometry={(gltf) => gltf.nodes.Tulip_Leaves.geometry}
                    material={(gltf) => gltf.nodes.Tulip_Leaves.material}
                    snow={snowPresets.tulip}
                    snowLift={0.002}
                    {...commonSnowProps}
                />
            ))}
            <EntityInstancesAssetBlock
                assetName="Bush"
                stacks={stacks}
                name="Bush"
                geometry={(gltf) => gltf.nodes.Bush_1_1.geometry}
                material={(gltf) => gltf.nodes.Bush_1_1.material}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushCore}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Bush"
                stacks={stacks}
                name="Bush"
                geometry={(gltf) => gltf.nodes.Bush_1_2.geometry}
                material={(gltf) => gltf.nodes.Bush_1_2.material}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushFoliage}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="BaleHey"
                stacks={stacks}
                name="BaleHey"
                geometry={(gltf) => gltf.nodes.BaleHey.geometry}
                material={(gltf) => gltf.nodes.BaleHey.material}
                snow={snowPresets.hay}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="StoneSmall"
                stacks={stacks}
                name="StoneSmall"
                geometry={(gltf) => gltf.nodes.Stone_Small.geometry}
                material={(gltf) => gltf.nodes.Stone_Small.material}
                scale={[0.165, 0.165, 0.165]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="StoneMedium"
                stacks={stacks}
                name="StoneMedium"
                geometry={(gltf) => gltf.nodes.Stone_Medium.geometry}
                material={(gltf) => gltf.nodes.Stone_Medium.material}
                scale={[0.236, 0.269, 0.205]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="StoneLarge"
                stacks={stacks}
                name="StoneLarge"
                geometry={(gltf) => gltf.nodes.Stone_Large.geometry}
                material={(gltf) => gltf.nodes.Stone_Large.material}
                scale={[0.263, 0.426, 0.291]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneSmall"
                stacks={stacks}
                name="DesertStoneSmall"
                geometry={(gltf) => gltf.nodes.DesertStoneSmall_Body.geometry}
                material={() => desertStoneBodyMaterial}
                scale={[0.165, 0.165, 0.165]}
                renderRainWetOverlay
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneSmall"
                stacks={stacks}
                name="DesertStoneSmall"
                geometry={(gltf) =>
                    gltf.nodes.DesertStoneSmall_Crevices.geometry
                }
                material={() => desertStoneGrooveMaterial}
                scale={[0.165, 0.165, 0.165]}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneMedium"
                stacks={stacks}
                name="DesertStoneMedium"
                geometry={(gltf) => gltf.nodes.DesertStoneMedium_Body.geometry}
                material={() => desertStoneBodyMaterial}
                scale={[0.236, 0.269, 0.205]}
                renderRainWetOverlay
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneMedium"
                stacks={stacks}
                name="DesertStoneMedium"
                geometry={(gltf) =>
                    gltf.nodes.DesertStoneMedium_Crevices.geometry
                }
                material={() => desertStoneGrooveMaterial}
                scale={[0.236, 0.269, 0.205]}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneLarge"
                stacks={stacks}
                name="DesertStoneLarge"
                geometry={(gltf) => gltf.nodes.DesertStoneLarge_Body.geometry}
                material={() => desertStoneBodyMaterial}
                scale={[0.263, 0.426, 0.291]}
                renderRainWetOverlay
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="DesertStoneLarge"
                stacks={stacks}
                name="DesertStoneLarge"
                geometry={(gltf) =>
                    gltf.nodes.DesertStoneLarge_Crevices.geometry
                }
                material={() => desertStoneGrooveMaterial}
                scale={[0.263, 0.426, 0.291]}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Stick"
                stacks={stacks}
                name="Stick"
                geometry={(gltf) => gltf.nodes.Stick.geometry}
                material={(gltf) => gltf.nodes.Stick.material}
                snow={snowPresets.tool}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesAssetBlock
                assetName="Seed"
                stacks={stacks}
                name="Seed"
                geometry={(gltf) => gltf.nodes.Seed.geometry}
                material={(gltf) => gltf.nodes.Seed.material}
            />
            <Suspense fallback={null}>
                <AdditionalEntityInstances
                    stacks={stacks}
                    {...commonSnowProps}
                />
            </Suspense>
        </>
    );
}
