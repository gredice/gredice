import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGroundReverseCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainReverseCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Ground_Reverse_Corner_1_1.geometry}
                material={nodes.Block_Ground_Reverse_Corner_1_1.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Ground_Reverse_Corner_1_1.geometry}
                maxThickness={0.18}
                slopeExponent={1.7}
                noiseScale={1.8}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Ground_Reverse_Corner_1_2.geometry}
                material={nodes.Block_Ground_Reverse_Corner_1_2.material}
            />
        </animated.group>
    );
}

export function BlockGrassReverseCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainReverseCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Grass_Reverse_Corner_1_1.geometry}
                material={nodes.Block_Grass_Reverse_Corner_1_1.material}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Grass_Reverse_Corner_1_2.geometry}
                material={nodes.Block_Grass_Reverse_Corner_1_2.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Grass_Reverse_Corner_1_2.geometry}
                {...snowPresets.grassReverseCorner}
            />
        </animated.group>
    );
}

export function BlockSandReverseCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainReverseCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Reverse_Corner_1.geometry}
                material={nodes.Block_Sand_Reverse_Corner_1.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Sand_Reverse_Corner_1.geometry}
                {...snowPresets.sandReverseCorner}
            />
        </animated.group>
    );
}

export function BlockSnowReverseCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainReverseCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Reverse_Corner_1.geometry}
            >
                <meshStandardMaterial
                    color={'#FFFFFF'}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.Block_Sand_Reverse_Corner_1.geometry}
                {...snowPresets.snowReverseCorner}
            />
        </animated.group>
    );
}
