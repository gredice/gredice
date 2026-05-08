import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from '../scene/gameQuality';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import { EntityInstancesBlock } from './EntityInstancesBlock';
import { GroundBlockDecorations } from './groundDecorations/GroundBlockDecorations';

export const instancedBlockNames = [
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Snow',
    'Block_Snow_Angle',
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
];

const instancedSnowOverlayCounts = {
    BaleHey: 1,
    Block_Grass: 1,
    Block_Grass_Angle: 1,
    Block_Sand: 1,
    Block_Sand_Angle: 1,
    Block_Snow: 1,
    Block_Snow_Angle: 1,
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
    Tree: 1,
    Tulip: 1,
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
    const { nodes, materials } = useGameGLTF();
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const isEditMode = useGameState((state) => state.mode) === 'edit';
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

    // In edit mode, blocks are rendered by EntityFactory with proper controls
    if (isEditMode) {
        return null;
    }

    return (
        <>
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Grass"
                yOffset={0.2}
                geometry={nodes.Block_Grass_1_2.geometry}
                material={nodes.Block_Grass_1_2.material}
                snow={snowPresets.grassFlat}
                snowLift={0.01}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Grass_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Grass_Angle_1_2.geometry}
                material={nodes.Block_Grass_Angle_1_2.material}
                snow={snowPresets.grassAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={nodes.Block_Sand_1.material}
                snow={snowPresets.sand}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={nodes.Block_Sand_Angle_1.material}
                snow={snowPresets.sandAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Snow"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={snowMaterial}
                snow={snowPresets.snow}
                snowLift={0.003}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Snow_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={snowMaterial}
                snow={snowPresets.snowAngle}
                snowLift={0.003}
                {...commonSnowProps}
            />
            {shouldRenderGroundDecorations && (
                <GroundBlockDecorations
                    density={qualityProfile.groundDecorationDensity}
                    stacks={stacks}
                />
            )}
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_1.geometry}
                material={nodes.Tree_1_1.material}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_2.geometry}
                material={nodes.Tree_1_2.material}
                snow={snowPresets.treeCanopyInner}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_3.geometry}
                material={nodes.Tree_1_3.material}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Pine"
                yOffset={1}
                scale={[0.09, 1, 0.09]}
                geometry={nodes.Tree_2.geometry}
                material={nodes.Tree_2.material}
                snow={snowPresets.pine}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="ShovelSmall"
                yOffset={-0.1}
                geometry={nodes.Shovel_Small.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.tool}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchHey"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Hey.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchCoconut"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Coconut.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchWood"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Wood.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tulip"
                geometry={nodes.Tulip.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.tulip}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_1.geometry}
                material={materials['Material.ColorPaletteMain']}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushCore}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_2.geometry}
                material={materials['Material.Leaves']}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushFoliage}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="BaleHey"
                geometry={nodes.BaleHey.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.hay}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneSmall"
                geometry={nodes.Stone_Small.geometry}
                material={materials['Material.Stone']}
                scale={[0.165, 0.165, 0.165]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneMedium"
                geometry={nodes.Stone_Medium.geometry}
                material={materials['Material.Stone']}
                scale={[0.236, 0.269, 0.205]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneLarge"
                geometry={nodes.Stone_Large.geometry}
                material={materials['Material.Stone']}
                scale={[0.263, 0.426, 0.291]}
                snow={snowPresets.stone}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Stick"
                geometry={nodes.Stick.geometry}
                material={nodes.Stick.material}
                snow={snowPresets.tool}
                snowLift={0.002}
                {...commonSnowProps}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Seed"
                geometry={nodes.Seed.geometry}
                material={nodes.Seed.material}
            />
        </>
    );
}
