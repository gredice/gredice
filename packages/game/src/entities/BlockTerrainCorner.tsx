import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { BlockSurfaceDecorationSprites } from './groundDecorations/BlockSurfaceDecorationSprites';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGroundCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Ground_Corner_1_1.geometry}
                material={nodes.Block_Ground_Corner_1_1.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Ground_Corner_1_1.geometry}
                maxThickness={0.18}
                slopeExponent={1.7}
                noiseScale={1.8}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Ground_Corner_1_2.geometry}
                material={nodes.Block_Ground_Corner_1_2.material}
            />
        </animated.group>
    );
}

export function BlockGrassCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainCorner');
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
                geometry={nodes.Block_Grass_Corner_1_2.geometry}
                material={nodes.Block_Grass_Corner_1_2.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Grass_Corner_1_2.geometry}
                {...snowPresets.grassCorner}
            />
            <BlockSurfaceDecorationSprites block={block} surface="grass" />
        </animated.group>
    );
}

export function BlockSandCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainCorner');
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
                geometry={nodes.Block_Sand_Corner_1.geometry}
                material={nodes.Block_Sand_Corner_1.material}
            />
            <SnowOverlay
                geometry={nodes.Block_Sand_Corner_1.geometry}
                {...snowPresets.sandCorner}
            />
            <BlockSurfaceDecorationSprites block={block} surface="sand" />
        </animated.group>
    );
}

export function BlockSnowCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainCorner');
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
                geometry={nodes.Block_Sand_Corner_1.geometry}
            >
                <meshStandardMaterial
                    color={'#FFFFFF'}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.Block_Sand_Corner_1.geometry}
                {...snowPresets.snowCorner}
            />
        </animated.group>
    );
}
