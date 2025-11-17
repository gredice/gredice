import { animated, useSprings } from '@react-spring/three';
import { Instance, Instances, MeshWobbleMaterial } from '@react-three/drei';
import type { BufferGeometry, Material } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';
import {
    getStackEntranceDelay,
    getStackEntranceHeight,
    getStackRingDistance,
} from '../utils/stackEntranceAnimation';
import { useGameGLTF } from '../utils/useGameGLTF';

const AnimatedInstance = animated(Instance);

type InstancedBlock = {
    id: string;
    position: [number, number, number];
};

function useEntranceSprings(
    instances: InstancedBlock[] | undefined,
    enableEntranceAnimation?: boolean,
) {
    const count = instances?.length ?? 0;
    const [springs] = useSprings(
        count,
        (index) => {
            const instance = instances?.[index];
            if (!instance || !enableEntranceAnimation) {
                return {
                    from: { yOffset: 0, scaleValue: 1 },
                    to: { yOffset: 0, scaleValue: 1 },
                    immediate: true,
                };
            }

            const distance = getStackRingDistance({
                x: instance.position[0],
                z: instance.position[2],
            });

            return {
                from: {
                    yOffset: getStackEntranceHeight(distance),
                    scaleValue: 0.85,
                },
                to: {
                    yOffset: 0,
                    scaleValue: 1,
                },
                delay: getStackEntranceDelay({
                    x: instance.position[0],
                    z: instance.position[2],
                }),
                config: {
                    mass: 1,
                    tension: 230,
                    friction: 28,
                },
            };
        },
        [enableEntranceAnimation, instances],
    );

    return springs;
}

function EntityGrassInstances({
    stacks,
    enableEntranceAnimation,
}: {
    stacks: Stack[] | undefined;
    enableEntranceAnimation?: boolean;
}) {
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
                        id: String(b.id),
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
    const limit = Math.max((grassBlockData?.length ?? 0) + 1, 100);
    const springs = useEntranceSprings(grassBlockData, enableEntranceAnimation);
    const springMap = new Map(
        grassBlockData?.map((data, index) => [data.id, springs?.[index]]) ?? [],
    );

    const InstanceComponent = enableEntranceAnimation
        ? AnimatedInstance
        : Instance;

    return (
        <>
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_1_2.geometry}
                material={nodes.Block_Grass_1_2.material}
                receiveShadow
                castShadow
            >
                {grassBlockData
                    ?.filter((data) => !data.atAngle)
                    .map((data) => {
                        const spring = springMap.get(data.id);
                        const position =
                            enableEntranceAnimation && spring
                                ? spring.yOffset.to((offset) => [
                                      data.position[0],
                                      data.position[1] + offset,
                                      data.position[2],
                                  ])
                                : data.position;

                        const scale =
                            enableEntranceAnimation && spring
                                ? spring.scaleValue.to((value) => [
                                      value,
                                      value,
                                      value,
                                  ])
                                : undefined;

                        return (
                            <InstanceComponent
                                key={`grass-block-${data.id}`}
                                position={position}
                                rotation={[0, data.rotation * (Math.PI / 2), 0]}
                                scale={scale}
                            />
                        );
                    })}
            </Instances>
            <Instances
                limit={limit}
                geometry={nodes.Block_Grass_Angle_1_2.geometry}
                material={nodes.Block_Grass_Angle_1_2.material}
                receiveShadow
                castShadow
            >
                {grassBlockData
                    ?.filter((data) => data.atAngle)
                    .map((data) => {
                        const spring = springMap.get(data.id);
                        const position =
                            enableEntranceAnimation && spring
                                ? spring.yOffset.to((offset) => [
                                      data.position[0],
                                      data.position[1] + offset,
                                      data.position[2],
                                  ])
                                : data.position;

                        const scale =
                            enableEntranceAnimation && spring
                                ? spring.scaleValue.to((value) => [
                                      value,
                                      value,
                                      value,
                                  ])
                                : undefined;

                        return (
                            <InstanceComponent
                                key={`grass-block-${data.id}`}
                                position={position}
                                rotation={[0, data.rotation * (Math.PI / 2), 0]}
                                scale={scale}
                            />
                        );
                    })}
            </Instances>
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
                    .map((data) => {
                        const spring = springMap.get(data.id);
                        const position =
                            enableEntranceAnimation && spring
                                ? spring.yOffset.to((offset) => [
                                      data.position[0],
                                      data.position[1] + offset,
                                      data.position[2],
                                  ])
                                : data.position;

                        const scale =
                            enableEntranceAnimation && spring
                                ? spring.scaleValue.to((value) => [
                                      value,
                                      value,
                                      value,
                                  ])
                                : undefined;

                        return (
                            <InstanceComponent
                                key={`grass-block-${data.id}`}
                                position={position}
                                rotation={[0, data.rotation * (Math.PI / 2), 0]}
                                scale={scale}
                            />
                        );
                    })}
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
                    .map((data) => {
                        const spring = springMap.get(data.id);
                        const position =
                            enableEntranceAnimation && spring
                                ? spring.yOffset.to((offset) => [
                                      data.position[0],
                                      data.position[1] + offset,
                                      data.position[2],
                                  ])
                                : data.position;

                        const scale =
                            enableEntranceAnimation && spring
                                ? spring.scaleValue.to((value) => [
                                      value,
                                      value,
                                      value,
                                  ])
                                : undefined;

                        return (
                            <InstanceComponent
                                key={`grass-block-${data.id}`}
                                position={position}
                                rotation={[0, data.rotation * (Math.PI / 2), 0]}
                                scale={scale}
                            />
                        );
                    })}
            </Instances>
        </>
    );
}

function EntityInstancesBlock({
    stacks,
    name,
    yOffset,
    scale,
    geometry,
    material,
    enableEntranceAnimation,
}: {
    stacks: Stack[] | undefined;
    name: string;
    yOffset?: number;
    scale?: [number, number, number];
    geometry: BufferGeometry;
    material: Material | Material[];
    enableEntranceAnimation?: boolean;
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
                        id: String(block.id),
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
    const springs = useEntranceSprings(blockInstances, enableEntranceAnimation);
    const InstanceComponent = enableEntranceAnimation
        ? AnimatedInstance
        : Instance;

    return (
        <Instances
            limit={limit}
            geometry={geometry}
            receiveShadow
            castShadow
            material={material}
        >
            {blockInstances?.map((data, index) => {
                const spring = springs?.[index];
                const position =
                    enableEntranceAnimation && spring
                        ? spring.yOffset.to((offset) => [
                              data.position[0],
                              data.position[1] + offset,
                              data.position[2],
                          ])
                        : data.position;

                const scaleValue =
                    enableEntranceAnimation && spring
                        ? spring.scaleValue.to((value) =>
                              scale
                                  ? ([
                                        scale[0] * value,
                                        scale[1] * value,
                                        scale[2] * value,
                                    ] as [number, number, number])
                                  : ([value, value, value] as [
                                        number,
                                        number,
                                        number,
                                    ]),
                          )
                        : scale;

                return (
                    <InstanceComponent
                        key={`block-${name}-${data.id}`}
                        position={position}
                        scale={scaleValue}
                        rotation={[0, data.rotation * (Math.PI / 2), 0]}
                    />
                );
            })}
        </Instances>
    );
}

export function EntityInstances({
    stacks,
    enableEntranceAnimation,
}: {
    stacks: Stack[] | undefined;
    enableEntranceAnimation?: boolean;
}) {
    const { nodes, materials } = useGameGLTF();
    return (
        <>
            <EntityGrassInstances
                stacks={stacks}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={nodes.Block_Sand_1.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={nodes.Block_Sand_Angle_1.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_1.geometry}
                material={nodes.Tree_1_1.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_2.geometry}
                material={nodes.Tree_1_2.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tree"
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                geometry={nodes.Tree_1_3.geometry}
                material={nodes.Tree_1_3.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Pine"
                yOffset={1}
                scale={[0.09, 1, 0.09]}
                geometry={nodes.Tree_2.geometry}
                material={nodes.Tree_2.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="ShovelSmall"
                yOffset={-0.1}
                geometry={nodes.Shovel_Small.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchHey"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Hey.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchCoconut"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Coconut.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="MulchWood"
                scale={[3, 3, 3]}
                geometry={nodes.Mulch_Wood.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tulip"
                geometry={nodes.Tulip.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_1.geometry}
                material={materials['Material.ColorPaletteMain']}
                scale={[0.5, 0.5, 0.5]}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Bush"
                geometry={nodes.Bush_1_2.geometry}
                material={materials['Material.Leaves']}
                scale={[0.5, 0.5, 0.5]}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="BaleHey"
                geometry={nodes.BaleHey.geometry}
                material={materials['Material.ColorPaletteMain']}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneSmall"
                geometry={nodes.Stone_Small.geometry}
                material={materials['Material.Stone']}
                scale={[0.165, 0.165, 0.165]}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneMedium"
                geometry={nodes.Stone_Medium.geometry}
                material={materials['Material.Stone']}
                scale={[0.236, 0.269, 0.205]}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="StoneLarge"
                geometry={nodes.Stone_Large.geometry}
                material={materials['Material.Stone']}
                scale={[0.263, 0.426, 0.291]}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Stick"
                geometry={nodes.Stick.geometry}
                material={nodes.Stick.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Seed"
                geometry={nodes.Seed.geometry}
                material={nodes.Seed.material}
                enableEntranceAnimation={enableEntranceAnimation}
            />
        </>
    );
}
