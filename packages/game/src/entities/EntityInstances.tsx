import { Instance, Instances, MeshWobbleMaterial } from '@react-three/drei';
import type { BufferGeometry, Material } from 'three';
import { useBlockData } from '../hooks/useBlockData';
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
    const limit = Math.max((grassBlockData?.length ?? 0) + 1, 100);

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
                geometry={nodes.Block_Grass_Angle_1_2.geometry}
                material={nodes.Block_Grass_Angle_1_2.material}
                receiveShadow
                castShadow
            >
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
    scale,
    geometry,
    material,
}: {
    stacks: Stack[] | undefined;
    name: string;
    yOffset?: number;
    scale?: [number, number, number];
    geometry: BufferGeometry;
    material: Material | Material[];
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

    return (
        <Instances
            limit={limit}
            geometry={geometry}
            receiveShadow
            castShadow
            material={material}
        >
            {blockInstances?.map((data) => (
                <Instance
                    key={`block-${name}-${data.id}`}
                    position={data.position}
                    scale={scale}
                    rotation={[0, data.rotation * (Math.PI / 2), 0]}
                />
            ))}
        </Instances>
    );
}

export function EntityInstances({ stacks }: { stacks: Stack[] | undefined }) {
    const { nodes, materials } = useGameGLTF();
    return (
        <>
            <EntityGrassInstances stacks={stacks} />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand"
                yOffset={0.2}
                geometry={nodes.Block_Sand_1.geometry}
                material={nodes.Block_Sand_1.material}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Block_Sand_Angle"
                yOffset={0.2}
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={nodes.Block_Sand_Angle_1.material}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Pine"
                yOffset={1}
                scale={[0.09, 1, 0.09]}
                geometry={nodes.Tree_2.geometry}
                material={nodes.Tree_2.material}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Shovel_Small"
                geometry={nodes.Shovel_Small.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Mulch_Hey"
                geometry={nodes.Mulch_Hey.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Mulch_Coconut"
                geometry={nodes.Mulch_Coconut.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Mulch_Wood"
                geometry={nodes.Mulch_Wood.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Tulip"
                geometry={nodes.Tulip.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="BaleHey"
                geometry={nodes.BaleHey.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
            <EntityInstancesBlock
                stacks={stacks}
                name="Stick"
                geometry={nodes.Stick.geometry}
                material={nodes.Stick.material}
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
