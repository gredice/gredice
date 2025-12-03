import { Instance, Instances, MeshWobbleMaterial } from '@react-three/drei';
import { useMemo } from 'react';
import {
    type BufferGeometry,
    type Material,
    MeshStandardMaterial,
} from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { type SnowMaterialOptions, SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';

function EntityGrassInstances({ stacks }: { stacks: Stack[] | undefined }) {
    const { nodes, materials } = useGameGLTF();
    const { data: blockData } = useBlockData();
    const pickupBlock = useGameState((state) => state.pickupBlock);

    const grassBlockData = stacks
        ?.filter(
            (s) =>
                (!pickupBlock || !s.blocks.includes(pickupBlock)) &&
                s.blocks.some(
                    (b) =>
                        b.name === 'Block_Grass' ||
                        b.name === 'Block_Grass_Angle',
                ),
        )
        .flatMap((s) =>
            s.blocks
                ?.filter(
                    (b) =>
                        b.name === 'Block_Grass' ||
                        b.name === 'Block_Grass_Angle',
                )
                .map((b) => {
                    const y = getStackHeight(blockData, s, b);
                    const atAngle = b.name === 'Block_Grass_Angle';
                    return {
                        id: b.id,
                        atAngle,
                        position: [
                            s.position.x,
                            y + (atAngle ? 0.2 : 0.2),
                            s.position.z,
                        ] as [number, number, number],
                        rotation: b.rotation || 0,
                    };
                }),
        );
    type GrassEntry = NonNullable<typeof grassBlockData>[number];
    const limit = Math.max((grassBlockData?.length ?? 0) + 1, 100);

    const renderGrassInstances = (
        predicate: (data: GrassEntry) => boolean,
        keyPrefix: string,
    ) =>
        (grassBlockData?.filter(predicate) ?? []).map((data) => (
            <Instance
                key={`grass-block-${keyPrefix}-${data.id}`}
                position={data.position}
                rotation={[0, data.rotation * (Math.PI / 2), 0]}
            />
        ));

    const renderGrassSnow = (
        predicate: (data: GrassEntry) => boolean,
        keyPrefix: string,
        geometry: BufferGeometry,
        options: SnowMaterialOptions,
        yLift: number,
    ) =>
        (grassBlockData?.filter(predicate) ?? []).map((data) => (
            <group
                key={`grass-snow-${keyPrefix}-${data.id}`}
                position={[
                    data.position[0],
                    data.position[1] + yLift,
                    data.position[2],
                ]}
                rotation={[0, data.rotation * (Math.PI / 2), 0]}
            >
                <SnowOverlay geometry={geometry} {...options} />
            </group>
        ));

    return (
        <>
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_1_2.geometry}
                material={nodes.Block_Grass_1_2.material}
                receiveShadow
                castShadow
            >
                {renderGrassInstances((data) => !data.atAngle, 'flat-top')}
            </Instances>
            {renderGrassSnow(
                (data) => !data.atAngle,
                'flat',
                nodes.Block_Grass_1_2.geometry,
                snowPresets.grassFlat,
                0.01,
            )}
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_Angle_1_2.geometry}
                material={nodes.Block_Grass_Angle_1_2.material}
                receiveShadow
                castShadow
            >
                {renderGrassInstances((data) => data.atAngle, 'angle-top')}
            </Instances>
            {renderGrassSnow(
                (data) => data.atAngle,
                'angle',
                nodes.Block_Grass_Angle_1_2.geometry,
                snowPresets.grassAngle,
                0.003,
            )}
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_1_1.geometry}
                receiveShadow
                castShadow
            >
                <MeshWobbleMaterial
                    {...materials['Material.GrassPart']}
                    factor={0.01}
                    speed={4}
                />
                {grassBlockData
                    ?.filter((data) => !data.atAngle)
                    .map((data) => (
                        <Instance
                            key={`grass-block-${data.id}`}
                            position={data.position}
                            rotation={[0, data.rotation * (Math.PI / 2), 0]}
                        />
                    ))}
            </Instances>
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_Angle_1_1.geometry}
                receiveShadow
                castShadow
            >
                <MeshWobbleMaterial
                    {...materials['Material.GrassPart']}
                    factor={0.01}
                    speed={4}
                />
                {grassBlockData
                    ?.filter((data) => data.atAngle)
                    .map((data) => (
                        <Instance
                            key={`grass-block-${data.id}`}
                            position={data.position}
                            rotation={[0, data.rotation * (Math.PI / 2), 0]}
                        />
                    ))}
            </Instances>
        </>
    );
}

function EntityInstancesBlock({
    stacks,
    name,
    yOffset,
    snowLift = 0,
    scale,
    geometry,
    material,
    snow,
}: {
    stacks: Stack[] | undefined;
    name: string;
    yOffset?: number;
    snowLift?: number;
    scale?: [number, number, number];
    geometry: BufferGeometry;
    material: Material | Material[];
    snow?: SnowMaterialOptions;
}) {
    const { data: blockData } = useBlockData();
    const pickupBlock = useGameState((state) => state.pickupBlock);

    const blockInstances = stacks
        ?.filter(
            (stack) =>
                (!pickupBlock || !stack.blocks.includes(pickupBlock)) &&
                stack.blocks.some((b) => b.name === name),
        )
        .flatMap((stack) =>
            stack.blocks
                ?.filter((block) => block.name === name)
                .map((block) => {
                    const y = getStackHeight(blockData, stack, block);
                    return {
                        id: block.id,
                        position: [
                            stack.position.x,
                            y + (yOffset ?? 0),
                            stack.position.z,
                        ] as const,
                        rotation: block.rotation || 0,
                    };
                }),
        );

    const limit = Math.max((blockInstances?.length ?? 0) + 10, 100);

    const renderInstances = (suffix: string) =>
        (blockInstances ?? []).map((data) => (
            <Instance
                key={`block-${name}-${suffix}-${data.id}`}
                position={data.position}
                scale={scale}
                rotation={[0, data.rotation * (Math.PI / 2), 0]}
            />
        ));

    const renderSnowOverlays = () =>
        !snow
            ? null
            : (blockInstances ?? []).map((data) => (
                  <group
                      key={`block-${name}-snow-${data.id}`}
                      position={[
                          data.position[0],
                          data.position[1] + (snowLift || 0.003),
                          data.position[2],
                      ]}
                      rotation={[0, data.rotation * (Math.PI / 2), 0]}
                      scale={scale}
                  >
                      <SnowOverlay geometry={geometry} {...snow} />
                  </group>
              ));

    return (
        <>
            <Instances
                limit={limit}
                geometry={geometry}
                receiveShadow
                castShadow
                material={material}
            >
                {renderInstances('base')}
            </Instances>
            {renderSnowOverlays()}
        </>
    );
}

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
            <EntityGrassInstances stacks={stacks} />
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
