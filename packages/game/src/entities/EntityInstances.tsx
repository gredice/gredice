import { MeshWobbleMaterial } from '@react-three/drei';
import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import { EntityInstancesBlock } from './EntityInstancesBlock';

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

export function EntityInstances({ stacks }: { stacks: Stack[] | undefined }) {
    const { nodes, materials } = useGameGLTF();
    const isEditMode = useGameState((state) => state.mode) === 'edit';
    const snowMaterial = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#FFFFFF',
                roughness: 1,
                metalness: 0,
            }),
        [],
    );

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
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Grass_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Grass_Angle_1_2.geometry}
                material={nodes.Block_Grass_Angle_1_2.material}
                snow={snowPresets.grassAngle}
                snowLift={0.003}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Grass"
                yOffset={0.2}
                geometry={nodes.Block_Grass_1_1.geometry}
                materialNode={
                    <MeshWobbleMaterial
                        {...materials['Material.GrassPart']}
                        factor={0.01}
                        speed={4}
                    />
                }
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Grass_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Grass_Angle_1_1.geometry}
                materialNode={
                    <MeshWobbleMaterial
                        {...materials['Material.GrassPart']}
                        factor={0.01}
                        speed={4}
                    />
                }
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={nodes.Block_Sand_1.material}
                snow={snowPresets.sand}
                snowLift={0.003}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={nodes.Block_Sand_Angle_1.material}
                snow={snowPresets.sandAngle}
                snowLift={0.003}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Snow"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={snowMaterial}
                snow={snowPresets.snow}
                snowLift={0.003}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Snow_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={snowMaterial}
                snow={snowPresets.snowAngle}
                snowLift={0.003}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_1.geometry}
                material={nodes.Tree_1_1.material}
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
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_3.geometry}
                material={nodes.Tree_1_3.material}
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
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="ShovelSmall"
                yOffset={-0.1}
                geometry={nodes.Shovel_Small.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.tool}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchHey"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Hey.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchCoconut"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Coconut.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchWood"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Wood.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.mulch}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tulip"
                geometry={nodes.Tulip.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.tulip}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_1.geometry}
                material={materials['Material.ColorPaletteMain']}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushCore}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_2.geometry}
                material={materials['Material.Leaves']}
                scale={[0.5, 0.5, 0.5]}
                snow={snowPresets.bushFoliage}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="BaleHey"
                geometry={nodes.BaleHey.geometry}
                material={materials['Material.ColorPaletteMain']}
                snow={snowPresets.hay}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneSmall"
                geometry={nodes.Stone_Small.geometry}
                material={materials['Material.Stone']}
                scale={[0.165, 0.165, 0.165]}
                snow={snowPresets.stone}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneMedium"
                geometry={nodes.Stone_Medium.geometry}
                material={materials['Material.Stone']}
                scale={[0.236, 0.269, 0.205]}
                snow={snowPresets.stone}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneLarge"
                geometry={nodes.Stone_Large.geometry}
                material={materials['Material.Stone']}
                scale={[0.263, 0.426, 0.291]}
                snow={snowPresets.stone}
                snowLift={0.002}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Stick"
                geometry={nodes.Stick.geometry}
                material={nodes.Stick.material}
                snow={snowPresets.tool}
                snowLift={0.002}
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
