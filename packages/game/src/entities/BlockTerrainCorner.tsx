import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { BlockSurfaceDecorationSprites } from './groundDecorations/BlockSurfaceDecorationSprites';
import {
    useGroundPatchMaterial,
    useGroundPatchStandardMaterial,
} from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGroundCorner({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockTerrainCorner');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const groundMaterial1 = useGroundPatchMaterial(
        nodes.Block_Ground_Corner_1.material,
        'dirt',
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Ground_Corner_1.geometry}
                material={groundMaterial1}
            />
            <SnowOverlay
                geometry={nodes.Block_Ground_Corner_1.geometry}
                maxThickness={0.18}
                slopeExponent={1.7}
                noiseScale={1.8}
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
    const grassMaterial1 = useGroundPatchMaterial(
        nodes.Block_Grass_Corner_1_1.material,
        'grass',
    );
    const grassMaterial2 = useGroundPatchMaterial(
        nodes.Block_Grass_Corner_1_2.material,
        'grass',
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Grass_Corner_1_1.geometry}
                material={grassMaterial1}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Grass_Corner_1_2.geometry}
                material={grassMaterial2}
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
    const sandMaterial = useGroundPatchMaterial(
        nodes.Block_Sand_Corner_1.material,
        'sand',
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Corner_1.geometry}
                material={sandMaterial}
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
    const snowMaterial = useGroundPatchStandardMaterial({
        color: '#f0f7ff',
        metalness: 0,
        roughness: 1,
        surface: 'snow',
    });

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Corner_1.geometry}
                material={snowMaterial}
            />
            <SnowOverlay
                geometry={nodes.Block_Sand_Corner_1.geometry}
                {...snowPresets.snowCorner}
            />
        </animated.group>
    );
}
